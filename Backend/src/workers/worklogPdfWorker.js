import { db } from "../config/db.js";
import { renderWorklogPdf } from "../lib/pdf/worklogPdf.js";
import { uploadPdfToInbox } from "../lib/inbox.js";
import { connectFileToInvoice } from "../lib/invoiceFiles.js";
import { getTransporter } from "../lib/mail.js";


const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MIN = 5;

/**
 * Reads the "include attachments on send" flag for a customer.
 *
 * What it does:
 * - Loads a customer row either by local numeric id OR by external customer_id.
 * - If the customer is billed directly (bill_direct=1), it uses the customer's own flag.
 * - If not billed directly, it attempts to read the flag from the customer's owner (customer_owner).
 * - Returns true/false.
 */
async function getIncludeFlagForCustomer(companyId) {
  if (!companyId) return false;

  let customerRow = null;

  if (!Number.isNaN(Number(companyId))) {
    const [[rowById]] = await db.query(
      `SELECT include_attachments_on_send, bill_direct, customer_owner 
       FROM customer 
       WHERE id = ? 
       LIMIT 1`,
      [Number(companyId)]
    );
    customerRow = rowById;
  } else {
    const [[rowByExternal]] = await db.query(
      `SELECT include_attachments_on_send, bill_direct, customer_owner 
       FROM customer 
       WHERE customer_id = ? 
       LIMIT 1`,
      [String(companyId)]
    );
    customerRow = rowByExternal;
  }

  if (!customerRow) return false;

  if (Number(customerRow.bill_direct) === 1) {
    return !!Number(customerRow.include_attachments_on_send);
  }

  if (customerRow.customer_owner) {
    const [[ownerRow]] = await db.query(
      `SELECT include_attachments_on_send 
       FROM customer 
       WHERE id = ? 
       LIMIT 1`,
      [Number(customerRow.customer_owner)]
    );
    if (ownerRow) {
      return !!Number(ownerRow.include_attachments_on_send);
    }
  }

  return !!Number(customerRow.include_attachments_on_send);
}

/**
 * Reads customer language preference (sv/en).
 *
 * What it does:
 * - Looks up the customer either by local numeric id OR by external customer_id.
 * - Returns "en" or "sv".
 * - Defaults to "sv" if not set or invalid.
 */
async function getCustomerLanguage(companyId) {
  if (!companyId) return "sv";
  const key = Number.isNaN(Number(companyId)) ? "customer_id" : "id";
  const [[row]] = await db.query(
    `SELECT language FROM customer WHERE ${key} = ? LIMIT 1`,
    [Number.isNaN(Number(companyId)) ? String(companyId) : Number(companyId)]
  );
  return row?.language === "en" || row?.language === "sv" ? row.language : "sv";
}

/**
 * Fetches all customer emails that should receive a PDF for a specific invoice number.
 *
 * What it does:
 * - Finds the worklog_pdf row by invoice_number.
 * - Resolves the related customer.
 * - Returns a filtered list of email addresses from customer_email where send_pdf=1.
 */
export async function getPdfEmailsByInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber) return [];

  const [rows] = await db.query(
    `
    SELECT ce.email
    FROM worklog_pdf wp
    JOIN customer c
      ON wp.customer_id = c.id OR wp.customer_id = c.customer_id
    JOIN customer_email ce
      ON ce.customer_id = c.id
    WHERE wp.invoice_number = ?
      AND ce.send_pdf = 1
    `,
    [invoiceNumber]
  );

  return rows.map((r) => r.email.trim()).filter((e) => e.includes("@"));
}

/**
 * Processes exactly ONE queued PDF job.
 *
 * High-level flow:
 * 1) Pick one queued job from worklog_pdf_job using row locking.
 * 2) Generate a PDF from the job payload.
 * 3) Store/overwrite the PDF in the worklog_pdf table.
 * 4) If invoice_number exists: upload PDF to Fortnox inbox and connect it to the invoice.
 * 5) Mark the job as done.
 * 6) If the customer has email recipients: email the PDF (bcc).
 * 7) If anything fails: increment attempts and either re-queue (with delay) or mark failed.
 *
 * Return value:
 * - { picked: false } if no job was available
 * - { picked: true, ok: true/false, jobId } when a job was processed
 */
export async function processOneJob() {
  // 1) Pick one job
  const conn = await db.getConnection();
  let job = null;
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM worklog_pdf_job
       WHERE status='queued' AND run_after <= NOW()
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    if (!rows.length) {
      await conn.commit();
      return { picked: false };
    }

    job = rows[0];

    await conn.query(
      `UPDATE worklog_pdf_job SET status='processing', updated_at=NOW() WHERE id=?`,
      [job.id]
    );

    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    try {
      // Releases DB connection back to the pool
      conn.release();
    } catch {}
  }

  // 2) Execute the heavy job outside the transaction
  try {
    const payload = safeJson(job.payload_json) || {};
    const {
      customerName = "",
      rows = [],
      period = null,
      companyId = null,
      lang: langOverride = null,
    } = payload;

    const dbLang = await getCustomerLanguage(companyId);
    const lang =
      langOverride === "en" || langOverride === "sv" ? langOverride : dbLang;

    // Render the PDF document
    const { buffer, sha256_hex } = await renderWorklogPdf({
      invoiceNo: job.invoice_number ?? "pending",
      customer: customerName,
      rows,
      lang,
    });

    const fileName = `worklog-invoice-${
      job.invoice_number || job.invoice_id
    }.pdf`;
    const mime = "application/pdf";

    // Store PDF in DB (insert or update existing)
    await db.execute(
      `INSERT INTO worklog_pdf 
         (invoice_id, invoice_number, customer_id, period_from, period_to, file_name, mime, size_bytes, sha256_hex, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         invoice_number = VALUES(invoice_number),
         customer_id    = VALUES(customer_id),
         period_from    = VALUES(period_from),
         period_to      = VALUES(period_to),
         file_name      = VALUES(file_name),
         mime           = VALUES(mime),
         size_bytes     = VALUES(size_bytes),
         sha256_hex     = VALUES(sha256_hex),
         data           = VALUES(data),
         updated_at     = NOW()`,
      [
        job.invoice_id,
        job.invoice_number ?? null,
        companyId,
        period?.from ?? null,
        period?.to ?? null,
        fileName,
        mime,
        buffer.length,
        sha256_hex ?? null,
        buffer,
      ]
    );

    // If invoice exists: upload to Fortnox and connect file to invoice
    if (job.invoice_number) {
      const uploaded = await uploadPdfToInbox(fileName, buffer);
      const includeFlag = await getIncludeFlagForCustomer(companyId);
      await connectFileToInvoice(uploaded, job.invoice_number, includeFlag);

      await db.execute(
        `UPDATE worklog_pdf
           SET fortnox_archive_file_id = ?, fortnox_connected_at = NOW()
         WHERE invoice_id = ?`,
        [uploaded?.archiveFileId || null, job.invoice_id]
      );
    }

    // Mark job done
    await db.execute(
      `UPDATE worklog_pdf_job SET status='done', updated_at=NOW() WHERE id=?`,
      [job.id]
    );

    // Email PDF to recipients (if any)
    const mailTo = await getPdfEmailsByInvoiceNumber(job.invoice_number);

    if (mailTo.length > 0) {
      console.log(
        `[Mail] Skickar PDF till ${mailTo} för faktura ${job.invoice_number}`
      );

      const tx = getTransporter();

if (!tx) {
  console.log(
    `[MAIL DEV] Would send worklog PDF for invoice ${job.invoice_number} to:`,
    mailTo
  );
} else {
  const common = {
    from: process.env.SMTP_FROM || "TimeCore <no-reply@timecore.local>",
    bcc: mailTo,
    attachments: [
      {
        filename:
          dbLang === "en"
            ? `Work-report-invoice-${job.invoice_number}.pdf`
            : `Arbetsrapport-faktura-${job.invoice_number}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    ],
  };

  if (dbLang === "en") {
    await tx.sendMail({
      ...common,
      subject: `Work report for invoice ${job.invoice_number}`,
      text: `Hello!\n\nHere is the work report as a PDF for invoice ${job.invoice_number}.`,
      html: `
        <p>Hello!</p>
        <p>Here is the work report as a PDF for invoice <strong>${job.invoice_number}</strong>.</p>
        <p>Best regards,<br>TimeCore</p>
      `,
    });
  } else {
    await tx.sendMail({
      ...common,
      subject: `Arbetsrapport för faktura ${job.invoice_number}`,
      text: `Hej!\n\nHär kommer arbetsrapporten som PDF för faktura ${job.invoice_number}.`,
      html: `
        <p>Hej!</p>
        <p>Här kommer arbetsrapporten som PDF för faktura <strong>${job.invoice_number}</strong>.</p>
        <p>Med vänliga hälsningar,<br>TimeCore</p>
      `,
    });
  }
}


      console.log(`[Mail] E-post skickad till ${mailTo}`);
    }

    return { picked: true, ok: true, jobId: job.id };
  } catch (err) {
    console.error("[worklogPdfWorker] error:", err);

    // Retry/Fail bookkeeping
    const [[row]] = await db.query(
      `SELECT attempts FROM worklog_pdf_job WHERE id=?`,
      [job.id]
    );

    const attempts = Number(row?.attempts || 0) + 1;
    const msg = String(err?.message || err).slice(0, 2000);

    // If too many attempts: mark failed
    if (attempts >= MAX_ATTEMPTS) {
      await db.execute(
        `UPDATE worklog_pdf_job
           SET status='failed', attempts=?, last_error=?, updated_at=NOW()
         WHERE id=?`,
        [attempts, msg, job.id]
      );
    } else {
      // Otherwise: re-queue with a delay
      await db.execute(
        `UPDATE worklog_pdf_job
           SET status='queued', attempts=?, last_error=?, run_after=DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at=NOW()
         WHERE id=?`,
        [attempts, msg, RETRY_DELAY_MIN, job.id]
      );
    }

    return { picked: true, ok: false, jobId: job.id };
  }
}

/**
 * Safe JSON parse helper for payload_json.
 * Returns parsed object or null if parsing fails.
 */
function safeJson(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}