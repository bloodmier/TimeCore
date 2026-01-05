// src/controller/worklogPdf.controller.js
import { db } from "../config/db.js";
import { renderWorklogPdf } from "../lib/pdf/worklogPdf.js";
import { pokeWorklogQueue } from "../workers/worklogRunner.js";
import nodemailer from "nodemailer";
import { getTransporter } from "../lib/mail.js";

// ------------------ Helpers ------------------------------
// Load time report rows by company + period (optionally only billable)
async function loadRowsByCompanyAndPeriod(companyId, period, { onlyBillable = true } = {}) {
  const params = [Number(companyId)];
  let where = `tr.customer_id = ?`;

  if (period?.from) {
    where += ` AND tr.date >= ?`;
    params.push(String(period.from));
  }
  if (period?.to) {
    where += ` AND tr.date <= ?`;
    params.push(String(period.to));
  }
  if (onlyBillable) {
    where += ` AND tr.billable = 1`;
  }

  const [rows] = await db.query(
    `
    SELECT
      tr.id,
      tr.date,
      tr.hours,
      tr.note,
      tr.work_labor,
      tr.billable,
      u.name                 AS user_name,
      cat.name               AS category_name
    FROM time_report tr
    LEFT JOIN users u                    ON u.id = tr.user
    LEFT JOIN time_report_categories cat ON cat.id = tr.category
    WHERE ${where}
    ORDER BY tr.date ASC, tr.id ASC
    `,
    params
  );

  return (rows || []).map(mapRowForPdf);
}

function encodeRFC5987ValueChars(str) {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A")
    .replace(/%(?:7C|60|5E)/g, unescape);
}

// Map DB row -> PDF renderer row
function mapRowForPdf(r) {
  return {
    date: r.date || null,
    hours: Number(r.hours) || 0,
    by: r.user_name || null,
    category: r.category_name || null,
    desc: r.work_labor || r.note || null,
  };
}

function buildFileName({ customerName, period }) {
  const from = period?.from || "from";
  const to = period?.to || "to";
  return `${customerName}-${from}_${to}.pdf`;
}

async function getCustomerName(companyId) {
  const [[r]] = await db.query("SELECT company FROM customer WHERE id = ? LIMIT 1", [
    Number(companyId),
  ]);
  return r?.company ?? null;
}

async function loadRowsByIds(ids = [], { onlyBillable = true } = {}) {
  if (!ids.length) return [];

  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await db.query(
    `
    SELECT
      tr.id,
      tr.date,
      tr.hours,
      tr.note,
      tr.work_labor,
      tr.billable,
      u.name                 AS user_name,
      cat.name               AS category_name
    FROM time_report tr
    LEFT JOIN users u                    ON u.id = tr.user
    LEFT JOIN time_report_categories cat ON cat.id = tr.category
    WHERE tr.id IN (${placeholders})
      ${onlyBillable ? "AND tr.billable = 1" : ""}
    ORDER BY tr.date ASC, tr.id ASC
    `,
    ids
  );

  return (rows || []).map(mapRowForPdf);
}

// ------------------ Controllers ------------------------------

export async function generateWorklogPdf(req, res) {
  const body = req?.body || {};
  
  const safeCompanyId = Number(body.companyId ?? null);

  try {
    const {
      companyId,
      period,
      language,
      onlyBillable = false,
      selectedTimeReportIds = [],
      attachMode = "none",
      invoiceNumber = null,
    } = body;

    if (!companyId) {
      return res.status(400).json({ error: "companyId is required" });
    }

    const isValidInvoice = (s) => typeof s === "string" && /^[A-Za-z0-9-_]+$/.test(s);

    // 1) Language fallback to customer default
    let dbLang = "sv";
    {
      const [[r]] = await db.query("SELECT language FROM customer WHERE id = ? LIMIT 1", [
        Number(companyId),
      ]);
      if (r?.language === "en" || r?.language === "sv") dbLang = r.language;
    }
    const lang = language === "en" || language === "sv" ? language : dbLang;

    // 2) Customer name
    const customerName = await getCustomerName(companyId);

    // 3) Load rows
    let rows = [];
    if (Array.isArray(selectedTimeReportIds) && selectedTimeReportIds.length > 0) {
      rows = await loadRowsByIds(selectedTimeReportIds, { onlyBillable });
    } else {
      rows = await loadRowsByCompanyAndPeriod(companyId, period, { onlyBillable });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        companyId,
        companyName: customerName ?? null,
        error: "No worklog rows found for given criteria",
      });
    }

    // 4) Render PDF
    const storedInvoiceNumber =
      attachMode === "manual" && isValidInvoice(invoiceNumber) ? invoiceNumber : null;

    const { buffer, sha256_hex } = await renderWorklogPdf({
      invoiceNo: storedInvoiceNumber || "pending",
      customer: customerName ?? "",
      rows,
      lang,
      period: { from: period?.from || null, to: period?.to || null },
    });

    // 5) Filename
    const fileName = buildFileName({ customerName, period });

    // 6) Save in DB
    const [result] = await db.execute(
      `INSERT INTO worklog_pdf
         (invoice_id, invoice_number, customer_id, period_from, period_to,
          file_name, mime, size_bytes, sha256_hex, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        null,
        storedInvoiceNumber,
        companyId,
        period?.from || null,
        period?.to || null,
        fileName,
        "application/pdf",
        buffer.length,
        sha256_hex,
        buffer,
      ]
    );

    const id = result.insertId;
    await db.execute("UPDATE worklog_pdf SET invoice_id = ? WHERE id = ?", [id, id]);

    res.setHeader("Cache-Control", "no-store");
    return res.json({
      success: true,
      companyId,
      companyName: customerName ?? null,
      period: { from: period?.from || null, to: period?.to || null },
      invoiceId: id,
      fileName,
      bytes: buffer.length,
      sha256: sha256_hex,
      lang,
      attached: {
        attempted: attachMode === "manual",
        ok: attachMode === "manual" ? !!storedInvoiceNumber : undefined,
        invoiceNumber: storedInvoiceNumber || undefined,
      },
    });
  } catch (err) {
    console.error("[generateWorklogPdf] error:", err);
    return res.status(500).json({
      success: false,
      companyId: Number.isFinite(safeCompanyId) ? safeCompanyId : undefined,
      error:
        (typeof err === "object" && err && "message" in err && err.message) || "Internal error",
    });
  }
}

export async function getWorklogPdf(req, res) {
  try {
    const invoiceIdParam = req.params.invoiceId;
    const asNumber = Number(invoiceIdParam);
    const byId = Number.isFinite(asNumber) ? asNumber : null;
    const download = req.query.download === "1";

    // Use numeric id only (both invoice_id and id are numeric in your schema)
    const lookupId = byId ?? -1;

    const [[row]] = await db.query(
      `
      SELECT
        id,
        invoice_id,
        customer_id,
        invoice_number,
        period_from,
        period_to,
        file_name,
        mime,
        size_bytes,
        sha256_hex,
        data,
        created_at,
        updated_at
      FROM worklog_pdf
      WHERE (invoice_id = ? OR id = ?)
      LIMIT 1
      `,
      [lookupId, lookupId]
    );

    if (!row) {
      return res.status(404).type("text/plain").send("Not found");
    }

    // Ensure Buffer
    let buf = row.data;
    if (!(buf instanceof Buffer)) buf = Buffer.from(buf);

    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(500).type("text/plain").send("Empty PDF buffer");
    }

    const mime = row.mime || "application/pdf";
    const etag = row.sha256_hex ? `"${row.sha256_hex}"` : `"wlpdf-${row.id}-${buf.length}"`;
    const fileName = row.file_name || `worklog_${row.id}.pdf`;
    const lastMod = row.updated_at || row.created_at;
    const lastModified = lastMod ? new Date(lastMod).toUTCString() : new Date().toUTCString();

    // ETag short-circuit
    if (req.headers["if-none-match"] === etag) {
      res.status(304);
      return res.end();
    }

    // Content-Disposition
    const dispoType = download ? "attachment" : "inline";
    const safeAscii = fileName.replace(/["\\]/g, "_");
    const contentDisposition = `${dispoType}; filename="${safeAscii}"; filename*=UTF-8''${encodeRFC5987ValueChars(
      fileName
    )}`;

    // Base headers
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", contentDisposition);
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", lastModified);
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Filename", safeAscii);
    res.setHeader("X-Filename-Encoded", encodeRFC5987ValueChars(fileName));
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, ETag, Last-Modified, X-Filename, X-Filename-Encoded"
    );

    // NOTE: If you use compression(), avoid setting Content-Length manually.
    res.setHeader("Content-Length", buf.length);

    // Range support
    const range = req.headers.range;
    if (range && typeof range === "string") {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : buf.length - 1;

        if (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start >= 0 &&
          end >= start &&
          end < buf.length
        ) {
          const chunkSize = end - start + 1;
          res.status(206);
          res.setHeader("Content-Range", `bytes ${start}-${end}/${buf.length}`);
          res.setHeader("Content-Length", chunkSize);
          return res.end(buf.subarray(start, end + 1));
        }

        res.status(416);
        res.setHeader("Content-Range", `bytes */${buf.length}`);
        return res.end();
      }
    }

    return res.end(buf);
  } catch (err) {
    console.error("[getWorklogPdf] error:", err);
    return res
      .status(500)
      .type("text/plain")
      .send(err?.message ? `Internal error: ${err.message}` : "Internal error");
  }
}

export const PdfQueue = async (req, res) => {
  try {
    const body = req.body;

    const items = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body)
      ? body
      : body && typeof body === "object" && body.invoiceId
      ? [body]
      : [];

    if (!items.length) {
      return res.status(400).json({ error: "No items" });
    }

    const values = [];
    const rejected = [];

    for (const it of items) {
      const { invoiceId, invoiceNumber, customerName, rows, period, companyId } = it || {};
      if (!invoiceId || !Array.isArray(rows)) {
        rejected.push({ invoiceId, reason: "Missing invoiceId or rows is not an array" });
        continue;
      }

      // IMPORTANT: we use NOW() in SQL for run_after, so we do NOT pass a date param here.
      values.push([
        invoiceId, // invoice_id
        invoiceNumber ?? null, // invoice_number
        "queued", // status
        0, // attempts
        null, // last_error
        JSON.stringify({
          customerName: customerName ?? "",
          rows,
          period: period ?? null,
          companyId: companyId ?? null,
        }), // payload_json
      ]);
    }

    if (!values.length) {
      return res.status(400).json({ error: "No valid items", rejected });
    }

    const placeholders = values.map(() => "(?, ?, ?, ?, NOW(), ?, ?)").join(",");
    const flatParams = values.flat(); // matches placeholders exactly

    const sql = `
      INSERT INTO worklog_pdf_job
        (invoice_id, invoice_number, status, attempts, run_after, last_error, payload_json)
      VALUES ${placeholders}
    `;

    await db.execute(sql, flatParams);
    pokeWorklogQueue();

    return res.json({ queued: values.length, rejected });
  } catch (err) {
    console.error("[PdfQueue] error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};

export const PdfQueuestatus = async (req, res) => {
  const [rows] = await db.query(`
    SELECT status, COUNT(*) AS c
    FROM worklog_pdf_job
    GROUP BY status
  `);

  const counts = Object.fromEntries(rows.map((x) => [x.status, Number(x.c)]));
  res.json({ counts });
};

export const getCustomerSendPrefs = async (req, res) => {
  const customerId = req.params.id;

  try {
    const [email] = await db.query(`SELECT email FROM customer_email WHERE customer_id = ?`, [
      customerId,
    ]);

    const [Lang] = await db.query("SELECT language FROM customer WHERE id = ? LIMIT 1", [
      customerId,
    ]);

    const language = Lang?.[0]?.language ?? "sv";
    const emails = (email || []).map((r) => r.email);

    return res.status(200).json({ emails, language });
  } catch (error) {
    console.error("getCustomerSendPrefs error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const sendPDFToCustomer = async (req, res) => {
  const newEmails = req.body.newRecipients || [];
  const recipients = req.body.recipients || [];
  const lang = req.body.lang;
  const saveEmailtoCustomer = req.body.saveNew;
  const pdfId = req.body.PdfId;
  const customerId = req.body.companyId;
 
  try {
    if (saveEmailtoCustomer && newEmails.length > 0) {
      const sql = `
        INSERT INTO customer_email (customer_id, email)
        VALUES (?, ?)
      `;
      for (const email of newEmails) {
        await db.execute(sql, [customerId, email]);
      }
    }

    const [pdfr] = await db.execute("SELECT * FROM `worklog_pdf` WHERE id = ? LIMIT 1", [pdfId]);
    const pdf = pdfr?.[0];

    if (!pdf) return res.status(404).json({ error: "PDF not found" });

    const tz = "Europe/Stockholm";
    const fromUtc = new Date(pdf.period_from);
    const toUtc = new Date(pdf.period_to);

    const fmtDate = new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const periodRange = `${fmtDate.format(fromUtc)} - ${fmtDate.format(toUtc)}`;

    const invoice_number_flag = pdf.invoice_number;
    const invoice_number = pdf.invoice_number ?? (lang === "en" ? "for the month" : "För månaden");

    let buffer = pdf.data;
    if (!(buffer instanceof Buffer)) {
      try {
        buffer = Buffer.isBuffer(pdf.data) ? pdf.data : Buffer.from(pdf.data);
      } catch {
        return res.status(500).json({ error: "Invalid PDF data format." });
      }
    }

    let subject, text, html, filename;

    if (!invoice_number_flag && lang === "en") {
      subject = `Work report`;
      text = `Hello! Here is the work report for the period ${periodRange}`;
      html = `
        <p>Hello!</p>
        <p>Here is the work report for the period <strong>${periodRange}</strong></p>
        <p>Best regards,<br>TimeCore</p>
      `;
      filename = `Work-report${periodRange}.pdf`;
    } else if (!invoice_number_flag && lang === "sv") {
      subject = `Arbetsrapport`;
      text = `Hej! Här kommer arbetsrapporten för perioden ${periodRange}`;
      html = `
        <p>Hej!</p>
        <p>Här kommer arbetsrapporten för perioden <strong>${periodRange}</strong></p>
        <p>Med vänliga hälsningar,<br>TimeCore</p>
      `;
      filename = `Arbetsrapport${periodRange}.pdf`;
    } else if (invoice_number_flag && lang === "en") {
      subject = `Work report for invoice ${invoice_number}`;
      text = `Hello! Here is the work report as a PDF for invoice ${invoice_number}.`;
      html = `
        <p>Hello!</p>
        <p>Here is the work report as a PDF for invoice <strong>${invoice_number}</strong>.</p>
        <p>Best regards,<br>Dynamicbranch</p>
      `;
      filename = `Work-report-invoice-${invoice_number}.pdf`;
    } else {
      subject = `Arbetsrapport för faktura ${invoice_number}`;
      text = `Hej! Här kommer arbetsrapporten som PDF för faktura ${invoice_number}.`;
      html = `
        <p>Hej!</p>
        <p>Här kommer arbetsrapporten som PDF för faktura <strong>${invoice_number}</strong>.</p>
        <p>Med vänliga hälsningar,<br>TimeCore</p>
      `;
      filename = `Arbetsrapport-faktura-${invoice_number}.pdf`;
    }

    if (recipients.length > 0) {
      console.log(
        `[Mail] Sending worklog PDF. pdfId=${pdfId}, customerId=${customerId}, recipients=${recipients.length}, invoice=${invoice_number_flag ? invoice_number : "n/a"}`
      );
   
const tx = getTransporter();

if (!tx) {
  console.log("[MAIL DEV] Would send worklog PDF to (bcc):", recipients);
  console.log("[MAIL DEV] Subject:", subject);
  console.log("[MAIL DEV] Filename:", filename);
  return res.status(200).json({
    message: "SMTP config missing; email not sent (dev mode).",
    recipients,
  });
}

await tx.sendMail({
  from: process.env.SMTP_FROM || "TimeCore <no-reply@timecore.local>",
  bcc: recipients,
  subject,
  text,
  html,
  attachments: [
    {
      filename,
      content: buffer,
      contentType: "application/pdf",
    },
  ],
});
 return res.status(200).json({ message: `successfully mailed ${recipients}` });
 }
    return res.status(200).json({ message: `successfully mailed ${recipients}` });
  } catch (error) {
    console.error("sendPDFToCustomer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export const getPDFinRange = async (req, res) => {
  const { start, end, query } = req.body || {};
  const q = (query || "").trim();

  try {
    // 1) Query search (with optional start/end)
    if (q) {
      const params = [];
      const whereParts = [];

      if (start) {
        whereParts.push("p.period_from >= ?");
        params.push(start);
      }
      if (end) {
        whereParts.push("p.period_to <= ?");
        params.push(end);
      }

      const like = `%${q}%`;
      const searchConditions = [];

      searchConditions.push("c.company LIKE ?");
      params.push(like);

      searchConditions.push("p.file_name LIKE ?");
      params.push(like);

      searchConditions.push("p.invoice_number LIKE ?");
      params.push(like);

      const num = Number(q);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        searchConditions.push("p.id = ?");
        params.push(num);

        searchConditions.push("p.invoice_id = ?");
        params.push(num);
      }

      if (searchConditions.length > 0) {
        whereParts.push(`(${searchConditions.join(" OR ")})`);
      }

      const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
      const limit = 300;

      const [rows] = await db.query(
        `
        SELECT
          p.id,
          p.invoice_id,
          p.customer_id,
          p.invoice_number,
          p.period_from,
          p.period_to,
          p.file_name,
          p.size_bytes,
          p.sha256_hex,
          c.company,
          c.language
        FROM worklog_pdf p
        JOIN customer c ON c.id = p.customer_id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ?
        `,
        [...params, limit]
      );

      const result = rows.map((r) => ({
        success: true,
        companyId: r.customer_id,
        companyName: r.company,
        period: { from: r.period_from, to: r.period_to },
        invoiceId: r.invoice_id,
        fileName: r.file_name,
        bytes: r.size_bytes,
        sha256: r.sha256_hex,
        lang: r.language,
        fileId: r.id,
      }));

      return res.status(200).json(result);
    }

    // 2) No query + no dates -> last 12 months
    if (!start && !end) {
      const limit = 500;

      const [rows] = await db.query(
        `
        SELECT
          p.id,
          p.invoice_id,
          p.customer_id,
          p.invoice_number,
          p.period_from,
          p.period_to,
          p.file_name,
          p.size_bytes,
          p.sha256_hex,
          c.company,
          c.language
        FROM worklog_pdf p
        JOIN customer c ON c.id = p.customer_id
        WHERE p.period_from >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        ORDER BY p.created_at DESC
        LIMIT ?
        `,
        [limit]
      );

      const result = rows.map((r) => ({
        success: true,
        companyId: r.customer_id,
        companyName: r.company,
        period: { from: r.period_from, to: r.period_to },
        invoiceId: r.invoice_id,
        fileName: r.file_name,
        bytes: r.size_bytes,
        sha256: r.sha256_hex,
        lang: r.language,
        fileId: r.id,
      }));

      return res.status(200).json(result);
    }

    // 3) start/end without query
    const params = [];
    const whereParts = [];

    if (start) {
      whereParts.push("p.period_from >= ?");
      params.push(start);
    }
    if (end) {
      whereParts.push("p.period_to <= ?");
      params.push(end);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const limit = 500;

    const [rows] = await db.query(
      `
      SELECT
        p.id,
        p.invoice_id,
        p.customer_id,
        p.invoice_number,
        p.period_from,
        p.period_to,
        p.file_name,
        p.size_bytes,
        p.sha256_hex,
        c.company,
        c.language
      FROM worklog_pdf p
      JOIN customer c ON c.id = p.customer_id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ?
      `,
      [...params, limit]
    );

    const result = rows.map((r) => ({
      success: true,
      companyId: r.customer_id,
      companyName: r.company,
      period: { from: r.period_from, to: r.period_to },
      invoiceId: r.invoice_id,
      fileName: r.file_name,
      bytes: r.size_bytes,
      sha256: r.sha256_hex,
      lang: r.language,
      fileId: r.id,
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("[getPDFinRange] error:", error);
    res.status(500).json({ error: "Failed to fetch PDFs in range" });
  }
};
