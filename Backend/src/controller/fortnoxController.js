import { db } from "../config/db.js";
import { callFortnoxApi } from "../lib/fortnox.js";

/* ========================== DB lookups ========================== */

/**
 * Looks up the hourly rate from your local DB, based on a customer identifier
 * If you intended to look up by Fortnox customer number, you'd typically query:
 *   WHERE customer_id = ?
 * (depending on how you store the Fortnox id in your customer table)
 */
async function getHourlyRateByCustomerNumber(customerNumber) {
  const [rows] = await db.execute(
    `SELECT hourly_rate FROM customer WHERE id = ? LIMIT 1`,
    [customerNumber]
  );
  return rows?.[0]?.hourly_rate ?? null;
}

/**
 * Looks up purchase_price for a time_report_item row and returns price * 1.07 can be set to the fee you want.
 * Also note: if price is null, this returns null;
 */
async function getPurchasePriceFromTimeReportItemId(triId) {
  if (!triId) return null;

  const [rows] = await db.execute(
    `SELECT purchase_price FROM time_report_item WHERE id = ? LIMIT 1`,
    [triId]
  );

  const price = rows?.[0]?.purchase_price ?? null;
  if (price == null) return null;
    return Number(price) * 1.07;
}

/**
 * Loads user pricing info (level_id + hourly_rate) for many user IDs at once,
 * and returns a Map keyed by user_id -> { levelId, hourlyRate }.
 *
 * Used when no customer-specific hourly rate exists and you want to price labor
 * per user's pricing level.
 */
async function getUserRatesByIds(userIds = []) {
  if (!Array.isArray(userIds) || userIds.length === 0) return new Map();

  const placeholders = userIds.map(() => "?").join(",");
  const [rows] = await db.execute(
    `
    SELECT u.id AS user_id, u.level_id, upl.hourly_rate
    FROM users u
    LEFT JOIN user_pricing_levels upl ON upl.id = u.level_id
    WHERE u.id IN (${placeholders})
    `,
    userIds
  );

  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.user_id), {
      levelId: r.level_id == null ? null : Number(r.level_id),
      hourlyRate: r.hourly_rate == null ? null : Number(r.hourly_rate),
    });
  }
  return map;
}

/**
 * If a customer doesn't have an hourly rate, try to use the owner's hourly rate.
 *
 * First reads customer.customer_owner from the DB, then loads that owner's hourly_rate.
 *
 */
async function getOwnerHourlyRateByCustomerNumber(customerNumber) {
  const [ownerRows] = await db.execute(
    `SELECT customer_owner FROM customer WHERE id = ? LIMIT 1`,
    [customerNumber]
  );

  const ownerId = ownerRows?.[0]?.customer_owner ?? null;
  if (ownerId == null) return null;

  const [rateRows] = await db.execute(
    `SELECT hourly_rate FROM customer WHERE id = ? LIMIT 1`,
    [Number(ownerId)]
  );

  const rate = rateRows?.[0]?.hourly_rate;
  return rate == null ? null : Number(rate);
}

/**
 * Returns the preferred currency for a local customer record.
 * Defaults to SEK if not set.
 */
async function getCurrencyByCustomerId(id) {
  const [rows] = await db.execute(
    `SELECT currency FROM customer WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows?.[0]?.currency ?? "SEK";
}

/* ========================== Helpers ========================== */

const SV_MONTHS = [
  "Januari","Februari","Mars","April","Maj","Juni",
  "Juli","Augusti","September","Oktober","November","December"
];

/** Returns Swedish month name for a Date object. */
function monthSv(d) {
  return SV_MONTHS[d.getMonth()];
}

/**
 * Converts an input into a valid Date object (or null).
 * Used to safely parse row dates coming from different payload shapes.
 */
function coerceDate(x) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isFinite(+d) ? d : null;
}

/**
 * Tries to locate a "row date" from multiple possible fields.
 * This is tolerant to different producers of payloads:
 * - Date / date / WorkDate / work_date
 * - Meta.periodStart
 */
function extractRowDate(row) {
  return (
    coerceDate(row?.Date) ||
    coerceDate(row?.date) ||
    coerceDate(row?.WorkDate) ||
    coerceDate(row?.work_date) ||
    coerceDate(row?.Meta?.periodStart) ||
    null
  );
}

/**
 * Reads Meta.periodEnd if present.
 * Only used if you include period end in Meta.
 */
function extractRowEndDate(row) {
  return coerceDate(row?.Meta?.periodEnd) || null;
}

/**
 * Returns "November 2025" or "Augusti–November 2025" based on row dates.
 * If no dates can be found, returns null.
 *
 * Used to build a nicer invoice description for labor lines.
 */
function formatPeriodFromRows(rows) {
  const starts = [];
  const ends = [];

  for (const r of rows ?? []) {
    const sd = extractRowDate(r);
    const ed = extractRowEndDate(r);
    if (sd) starts.push(sd);
    if (ed) ends.push(ed);
  }

  if (starts.length === 0 && ends.length === 0) return null;

  const min = new Date(Math.min(...(starts.length ? starts : ends)));
  const max = new Date(Math.max(...(ends.length ? ends : starts)));

  const sameMonth =
    min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear();

  if (sameMonth) {
    return `${monthSv(min)} ${min.getFullYear()}`;
  }
  return `${monthSv(min)}–${monthSv(max)} ${max.getFullYear()}`;
}

/**
 * Produces a base invoice description:
 * - "Support / Arbete <Period>" if a period can be inferred
 * - otherwise "Support / Arbete"
 */
function buildBaseDescriptionWithPeriod(laborRows) {
  const periodText = formatPeriodFromRows(laborRows);
  return periodText ? `Support / Arbete ${periodText}` : "Support / Arbete";
}

/**
 * Determines whether a row is a "labor" row.
 * Rule:
 * - ArticleNumber === "100" OR
 * - Description matches arbete/labor/support
 *
 * This lets you separate labor pricing rules from material pricing rules.
 */
function isLaborRow(row) {
  const art = String(row?.ArticleNumber ?? "");
  const desc = String(row?.Description ?? "");
  return art === "100" || /arbete|labor|support/i.test(desc);
}

/**
 * Converts a value into a safe number, else returns default d.
 */
function toNumber(n, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
}

/**
 * Extracts your internal TimeReportItemId reference from a row.
 * You use this to look up purchase_price for material rows.
 *
 * (You intentionally only accept TimeReportItemId to keep it consistent.)
 */
function extractTimeReportItemId(row) {
  return row?.TimeReportItemId ?? null;
}

/**
 * Removes all internal/non-Fortnox fields from a row object.
 * Fortnox rejects unknown fields, so this prevents API errors.
 */
function stripInternalFieldsFromRow(row) {
  delete row.TimeReportItemId;
  delete row.timeReportItemId;
  delete row._timeReportItemId;
  delete row.Meta;
  delete row.ArticleId;
  delete row.Date;
  delete row.UserId;
}

/**
 * Final whitelist sanitation step:
 * Only keeps fields Fortnox InvoiceRows are expected to accept.
 * Anything else is deleted.
 *
 * (This is your "belt and suspenders" safety net.)
 */
function sanitizeInvoiceRows(rows) {
  const allowed = new Set([
    "ArticleNumber",
    "DeliveredQuantity",
    "Price",
    "Description",
    "Unit",
    "Discount",
    "VAT",
    "AccountNumber",
    "CostCenter",
    "Project",
    "HouseworkType",
    "HouseworkHoursToReport",
    "HouseworkAmountToReport",
    "ContributionPercent",
    "ContributionAmount",
  ]);
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!allowed.has(k)) delete r[k];
    }
  }
}

/* ========================== Enrichment ========================== */

/**
 * Enriches an invoice payload with:
 * - Currency (from local customerId, if provided)
 * - Labor row pricing (customer hourly rate OR owner hourly rate OR per-user level rates)
 * - Material row pricing (purchase_price lookup via TimeReportItemId, plus markup)
 * - Row sanitation (removes internal fields)
 *
 * It supports both payload shapes:
 * - { Invoice: {...} }   (Fortnox wrapper shape)
 * - {...}               (raw invoice object)
 */
async function enrichInvoicePrices(invoiceLike, customerId) {
  const wrapped = invoiceLike?.Invoice ? invoiceLike : { Invoice: invoiceLike };
  const inv = wrapped.Invoice;

  const customerNumber = inv?.CustomerNumber ?? null;

  // If payload is missing core structure, return it unchanged
  if (!customerNumber || !Array.isArray(inv?.InvoiceRows)) {
    return invoiceLike;
  }

  let customerHourlyRate = null;
  let ownerHourlyRate = null;

  // Try customer hourly rate first, then owner fallback
  customerHourlyRate = await getHourlyRateByCustomerNumber(customerNumber);
  if (customerHourlyRate == null) {
    ownerHourlyRate = await getOwnerHourlyRateByCustomerNumber(customerNumber);
  }

  const hourlyRateOverride = customerHourlyRate ?? ownerHourlyRate;

  // Set currency on invoice if we know local customer id
  if (customerId != null) {
    const currency = await getCurrencyByCustomerId(customerId);
    if (currency) inv.Currency = currency;
  }

  const originalRows = inv.InvoiceRows ?? [];
  const laborRows = [];
  const otherRows = [];

  // Split rows into labor vs other (materials, etc.)
  for (const row of originalRows) {
    if (isLaborRow(row)) laborRows.push({ ...row });
    else otherRows.push({ ...row });
  }

  // Enrich non-labor rows (e.g. materials)
  for (const row of otherRows) {
    // If TimeReportItemId exists, try to set Price from purchase_price (+ markup)
    const triId = extractTimeReportItemId(row);
    if (triId != null) {
      const pp = await getPurchasePriceFromTimeReportItemId(triId);
      if (pp != null && row.Price == null) {
        row.Price = Number(pp);
      }
    }

    // Remove internal fields before sending to Fortnox
    stripInternalFieldsFromRow(row);
  }

  // Build final labor rows depending on pricing rules
  let finalLaborRows = [];

  if (laborRows.length > 0) {
    if (hourlyRateOverride != null) {
      /**
       * Rule 1:
       * If we have a customer-specific (or owner fallback) hourly rate,
       * merge ALL labor into ONE invoice row.
       */
      const baseDesc = buildBaseDescriptionWithPeriod(laborRows);
      const totalHours = laborRows.reduce(
        (s, r) => s + toNumber(r.DeliveredQuantity, 0),
        0
      );

      finalLaborRows = [{
        ArticleNumber: "100",
        DeliveredQuantity: Number(totalHours),
        Unit: "h",
        Description: baseDesc,
        Price: Number(hourlyRateOverride),
      }];
    } else {
      /**
       * Rule 2:
       * No customer-specific hourly rate -> price labor per user pricing level.
       *
       * We:
       * - load pricing levels for involved user IDs
       * - aggregate hours per level_id
       * - emit one row per level with its price (if available)
       */
      const userIds = [];
      for (const r of laborRows) {
        const uid = r.UserId ?? r.userId ?? r.userid ?? r.user_id ?? null;
        if (uid != null) userIds.push(Number(uid));
      }

      const rateMap = await getUserRatesByIds([...new Set(userIds)]);
      const baseDesc = buildBaseDescriptionWithPeriod(laborRows);

      const agg = new Map(); // levelId -> { hours, price, levelId }
      for (const r of laborRows) {
        const uid = r.UserId ?? r.userId ?? r.userid ?? r.user_id ?? null;
        const info = uid != null ? rateMap.get(Number(uid)) : null;

        const levelId = info?.levelId ?? null;
        const price = info?.hourlyRate ?? null;

        const key = String(levelId ?? "null");
        const cur = agg.get(key) ?? { hours: 0, price, levelId };
        cur.hours += toNumber(r.DeliveredQuantity, 0);

        if (price != null) cur.price = Number(price);
        agg.set(key, cur);
      }

      for (const { hours, price, levelId } of agg.values()) {
        if (hours <= 0) continue;
        const levelLabel = levelId == null ? "level ?" : `level ${levelId}`;

        finalLaborRows.push({
          ArticleNumber: "100",
          DeliveredQuantity: Number(hours),
          Unit: "h",
          Description: `${baseDesc} ${levelLabel}`,
          ...(price != null ? { Price: Number(price) } : {}),
        });
      }
    }
  }

  // Replace InvoiceRows with enriched labor + enriched other rows
  inv.InvoiceRows = [...finalLaborRows, ...otherRows];

  // Return in the same shape the caller used
  return invoiceLike?.Invoice ? { Invoice: inv } : inv;
}

/**
 * Enriches an "envelope" payload shape:
 * {
 *   labor: { Invoice: ... },
 *   materials: { Invoice: ... },
 *   envelopeCompanyId: <local customer id> (used for currency lookup),
 * }
 *
 * - Enriches labor with customerId currency if provided
 * - Enriches materials without needing customerId
 * - Sanitizes invoice rows afterward
 */
async function enrichEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") return envelope;

  const out = { ...envelope };

  if (out?.labor?.Invoice) {
    out.labor = await enrichInvoicePrices(out.labor, out.envelopeCompanyId);
    if (Array.isArray(out.labor?.Invoice?.InvoiceRows)) {
      sanitizeInvoiceRows(out.labor.Invoice.InvoiceRows);
    }
  }

  if (out?.materials?.Invoice) {
    out.materials = await enrichInvoicePrices(out.materials);
    if (Array.isArray(out.materials?.Invoice?.InvoiceRows)) {
      sanitizeInvoiceRows(out.materials.Invoice.InvoiceRows);
    }
  }

  return out;
}

/* ===================== Fortnox send w/ retry ==================== */

/** Sleep helper used for backoff retries. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Defines which HTTP statuses are considered retryable:
 * - 429 (rate limited)
 * - 5xx server errors
 */
const isRetriable = (status) =>
  status === 429 || (typeof status === "number" && status >= 500);

/**
 * Sends payload to Fortnox using your low-level callFortnoxApi(...) wrapper.
 *
 * Includes:
 * - Automatic retries with small exponential-ish backoff
 * - Standardized "reauthorize" errors
 * - Normalized error object fields for logging + frontend debugging
 */
async function sendToFortnox(scope, payload) {
  let attempts = 0;
  const maxAttempts = 3;

  while (true) {
    attempts++;
    try {
      return await callFortnoxApi(scope, {}, "POST", payload);
    } catch (e) {
      // Token expired/invalid -> return a structured "reauth" error
      if (e?.code === "REAUTHORIZE") {
        throw {
          reauth: true,
          status: 401,
          message: "Fortnox needs re-authorization",
          request: { url: e?._url, method: e?._method },
        };
      }

      const status = e?._status ?? undefined;

      // Retry on 429 / 5xx up to maxAttempts
      if (isRetriable(status) && attempts < maxAttempts) {
        await sleep(300 * attempts);
        continue;
      }

      // Normalize error into a consistent format
      const norm = new Error(e?._message || e?.message || "Fortnox error");
      norm._status = status || 500;
      norm._code = e?._code;
      norm._data = e?._data ?? null;
      norm._txt = e?._txt ?? null;
      norm._url = e?._url;
      norm._method = e?._method;
      throw norm;
    }
  }
}

/* ========================== Controller ========================== */

/**
 * MAIN ENDPOINT: handleFortnoxPost
 *
 * What it does:
 * - Receives payload for POST /fortnox/:scope
 * - Supports two payload formats:
 *   1) A single invoice payload (Fortnox shape)
 *   2) A "batch" array of envelopes where each element can contain:
 *      - labor invoice
 *      - materials invoice
 *      - envelopeCompanyId (local id used for currency lookup)
 *
 * - Enriches payload(s) before sending:
 *   - Adds prices (hourly rates or purchase prices)
 *   - Merges or splits labor rows depending on pricing rules
 *   - Sets currency from local customer when possible
 *   - Removes internal fields and whitelists InvoiceRow fields
 *
 * - Sends to Fortnox with retry logic
 * - Returns a structured ok/failed result for batch requests
 * - Returns 401 with authorize_url when reauthorization is needed
 */
export async function handleFortnoxPost(req, res) {
  try {
    const { scope } = req.params;
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // ----- Batch mode: body is an array of envelopes -----
    if (Array.isArray(body)) {
      const ok = [];
      const failed = [];

      for (let i = 0; i < body.length; i++) {
        // Enrich per envelope (labor/materials) + sanitize rows
        const row = await enrichEnvelope(body[i]);

        // Send labor invoice if present
        if (row?.labor?.Invoice) {
          try {
            const resp = await sendToFortnox(scope, row.labor);
            ok.push({
              index: i,
              envelopeCompanyId: row.envelopeCompanyId ?? null,
              kind: "labor",
              response: resp,
            });
          } catch (e) {
            // Reauth errors are reported in a predictable shape
            if (e?.reauth) {
              failed.push({
                index: i,
                envelopeCompanyId: row.envelopeCompanyId ?? null,
                kind: "labor",
                status: e.status,
                code: "REAUTHORIZE",
                message: e.message,
                authorize_url: "api/fortnox/oauth/start",
                response: null,
                request: e.request,
              });
            } else {
              failed.push({
                index: i,
                envelopeCompanyId: row.envelopeCompanyId ?? null,
                kind: "labor",
                status: e?._status || 500,
                code: e?._code,
                message: e?.message || "Fortnox error",
                response: {
                  data: e?._data ?? null,
                  raw: e?._txt ?? null,
                  status: e?._status,
                },
                request: { url: e?._url, method: e?._method },
              });
            }
          }
        }

        // Send materials invoice if present
        if (row?.materials?.Invoice) {
          try {
            const resp = await sendToFortnox(scope, row.materials);
            ok.push({
              index: i,
              envelopeCompanyId: row.envelopeCompanyId ?? null,
              kind: "materials",
              response: resp,
            });
          } catch (e) {
            if (e?.reauth) {
              failed.push({
                index: i,
                envelopeCompanyId: row.envelopeCompanyId ?? null,
                kind: "materials",
                status: e.status,
                code: "REAUTHORIZE",
                message: e.message,
                authorize_url: "api/fortnox/oauth/start",
                response: null,
                request: e.request,
              });
            } else {
              failed.push({
                index: i,
                envelopeCompanyId: row.envelopeCompanyId ?? null,
                kind: "materials",
                status: e?._status || 500,
                code: e?._code,
                message: e?.message || "Fortnox error",
                response: {
                  data: e?._data ?? null,
                  raw: e?._txt ?? null,
                  status: e?._status,
                },
                request: { url: e?._url, method: e?._method },
              });
            }
          }
        }
      }

      return res.json({ ok, failed });
    }

    // ----- Single mode -----
    // If it looks like a Fortnox invoice wrapper -> enrich invoice directly
    // else treat it like an envelope and enrich that
    const enriched = body?.Invoice
      ? await enrichInvoicePrices(body)
      : await enrichEnvelope(body);

    // Extra safety: sanitize rows for single payload
    if (enriched?.Invoice?.InvoiceRows) {
      sanitizeInvoiceRows(enriched.Invoice.InvoiceRows);
    } else {
      if (enriched?.labor?.Invoice?.InvoiceRows) {
        sanitizeInvoiceRows(enriched.labor.Invoice.InvoiceRows);
      }
      if (enriched?.materials?.Invoice?.InvoiceRows) {
        sanitizeInvoiceRows(enriched.materials.Invoice.InvoiceRows);
      }
    }

    const result = await sendToFortnox(scope, enriched);
    return res.status(201).json(result);
  } catch (err) {
    if (err?.reauth) {
      return res.status(401).json({
        error: "Fortnox needs re-authorization",
        authorize_url: "api/fortnox/oauth/start",
      });
    }

    console.error("Fortnox POST error:", err);

    return res.status(err?._status || 500).json({
      error: err?.message || "Unexpected error",
      status: err?._status || 500,
      code: err?._code,
      response: { data: err?._data ?? null, raw: err?._txt ?? null },
      request: { url: err?._url, method: err?._method },
    });
  }
}


/**
 * Synchronizes customers directly from Fortnox into the local database.
 *
 * Business rules:
 * - Fortnox is treated as the source of truth for customer master data
 * - Each Fortnox customer is upserted into the local `customer` table
 * - Mapping rules:
 *   - customer_id  -> Fortnox CustomerNumber
 *   - company      -> Fortnox Name
 *   - email        -> Fortnox Email (if present)
 *   - currency     -> Fortnox Currency (fallback to tenant default)
 * - billing_owner is initialized to 0 (self-owned by default)
 * - bill_direct is initialized based on system configuration
 *
 * Synchronization behavior:
 * - Customers are fetched in paginated batches using Fortnox `limit` / `offset`
 * - Existing customers are updated, new customers are inserted
 * - last_used is not modified during sync (only updated by actual usage)
 *
 * Fault tolerance:
 * - Customers with missing CustomerNumber or Name are skipped
 * - Individual upsert failures are logged but do not interrupt the sync
 * - Network or Fortnox API errors are surfaced to the caller
 *
 * Intended usage:
 * - Manual admin-triggered synchronization
 * - Initial Fortnox onboarding
 * - Periodic background synchronization (cron / worker)
 */



export async function syncCustomersFromFortnox({ limit = 500 } = {}) {
  let page = 1;
  let totalFetched = 0;
  let upserted = 0;

  const sql = `
    INSERT INTO customer (customer_id, company, billing_owner, last_used)
    VALUES (?, ?, 0, NOW())
    ON DUPLICATE KEY UPDATE
      company = VALUES(company),
      last_used = NOW()
  `;

  while (true) {
    const data = await callFortnoxApi("customers", { page, limit });

    const customers = Array.isArray(data?.Customers) ? data.Customers : [];
    totalFetched += customers.length;

    for (const c of customers) {
      const customerNumber = c.CustomerNumber;
      const companyName = c.Name || c.CompanyName || c.CustomerName;

      if (!customerNumber || !companyName) continue;

      const [result] = await db.execute(sql, [customerNumber, companyName]);


      if ((result?.affectedRows ?? 0) > 0) upserted++;
    }

    if (customers.length < Number(limit)) break;

    page++;
    if (page > 200) break;
  }

  return { totalFetched, upserted };
}
