import { db } from "../config/db.js";
import { addDaysYMD, ymd } from "../utils/dateRange.js";

/**
 * Normalizes a value into the Fortnox-friendly format:
 * - null / empty string => null
 * - otherwise => String(value)
 */
const toFort = (v) => (v == null || v === "" ? null : String(v));

/**
 * Returns a de-duplicated array (unique values only).
 * Used when locking IDs so we never try to lock/update the same row twice.
 */
function uniq(arr) {
  return [...new Set(arr)];
}

/**
 * Builds a safe SQL "(?, ?, ?)" placeholder list for "IN (...)" queries
 * together with a matching parameters array.
 *
 * - Filters out non-numeric values
 * - If the list is empty, returns "(NULL)" which safely matches nothing.
 */
function inList(list) {
  const arr = (list || [])
    .filter((x) => Number.isFinite(Number(x)))
    .map(Number);

  if (!arr.length) return { sql: "(NULL)", params: [] }; // safe empty IN

  return { sql: `(${arr.map(() => "?").join(",")})`, params: arr };
}

/**
 * Rounds a numeric value to 2 decimals.
 */
function round2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

/**
 * Computes totals from a set of invoice lines.
 *
 * Supports two modes:
 * - pricesInclVat = false: unitPrice is excluding VAT (normal calculation)
 * - pricesInclVat = true : unitPrice includes VAT, so we back-calculate base + VAT
 *
 * Returns:
 * - exclVat: total excluding VAT
 * - vatByRate: VAT split by common Swedish rates (0/6/12/25)
 * - grandTotal: exclVat + VAT
 */
export function computeTotals(lines = [], pricesInclVat = false) {
  const vatBuckets = { 0: 0, 6: 0, 12: 0, 25: 0 };
  let excl = 0;

  for (const ln of lines) {
    const qty = Number(ln.qty || 0);
    const price = Number(ln.unitPrice || 0);
    const rate = Number(ln.vatPercent || 0);
    if (!qty || price < 0) continue;

    if (!pricesInclVat) {
      // Standard: unitPrice excludes VAT
      const rowExcl = qty * price;
      const rowVat = rowExcl * (rate / 100);
      excl += rowExcl;
      vatBuckets[String(rate)] = (vatBuckets[String(rate)] || 0) + rowVat;
    } else {
      // Unit price includes VAT -> calculate base (excl) and VAT portion
      const rowIncl = qty * price;
      const base = rate > 0 ? rowIncl / (1 + rate / 100) : rowIncl;
      const rowVat = rowIncl - base;
      excl += base;
      vatBuckets[String(rate)] = (vatBuckets[String(rate)] || 0) + rowVat;
    }
  }

  const vatSum = Object.values(vatBuckets).reduce((s, v) => s + v, 0);
  const grand = excl + vatSum;

  return {
    exclVat: round2(excl),
    vatByRate: {
      0: round2(vatBuckets["0"] || 0),
      6: round2(vatBuckets["6"] || 0),
      12: round2(vatBuckets["12"] || 0),
      25: round2(vatBuckets["25"] || 0),
    },
    grandTotal: round2(grand),
  };
}

/**
 * MAIN ENDPOINT: collectAllInvoiceData
 *
 * What it does (high level):
 * 1) Reads input filters: date range, status (unbilled/billed/all), onlyBillable, grouping options.
 * 2) Fetches time reports and material rows from DB, filtered by date + billed status.
 * 3) Builds "company buckets" so each customer/company gets:
 *    - aggregated totals
 *    - timecards (full time report rows including their connected items)
 *    - an article/material overview
 *    - invoice lines (labor + items) based on grouping rules
 *    - "locks" containing IDs that can later be marked as billed/invoiced
 *    - billingInfo: selects which Fortnox customer number to invoice (company vs owner)
 * 4) Computes meta flags for UI: mixed/billed/unbilled/empty states and range flags.
 * 5) Returns a structured JSON payload used by your invoice UI.
 */
export async function collectAllInvoiceData(req, res) {
  const conn = await db.getConnection();
  try {
    // ----------------------------
    // 1) Parse & validate request
    // ----------------------------
    const body = req.body || {};
    const rawStatus =
      typeof body.status === "string" ? body.status : "unbilled";

    // status is restricted to "unbilled" | "billed" | "all"
    const status = ["unbilled", "billed", "all"].includes(
      rawStatus.trim().toLowerCase()
    )
      ? rawStatus.trim().toLowerCase()
      : "unbilled";

    // Validate date strings (YYYY-MM-DD)
    const startRaw =
      typeof body.start === "string" ? body.start.slice(0, 10) : "";
    const endRaw = typeof body.end === "string" ? body.end.slice(0, 10) : "";

    const start = /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : null;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : null;

    // These sets are used to compute UI flags per company
    const hasUnbilledBeforeStartSet = new Set();
    const hasUnbilledAfterEndSet = new Set();
    const billedAnySet = new Set();
    const unbilledAnySet = new Set();

    // Default: only billable rows unless explicitly set to false
    const onlyBillable = body.onlyBillable !== false;

    // Grouping rules used when building invoice lines
    const group = {
      labor: body?.group?.labor ?? "byWorkLabel", // "single" | "byCategory" | "byWorkLabel"
      items: body?.group?.items ?? "byArticle",   // "byArticle" | "single-ish"
      includeProjectDimension: !!body?.group?.includeProjectDimension,
    };

    // Build WHERE clause for date range (reused for time reports + items)
    const dateConds = [];
    const dateParams = [];
    if (start) {
      dateConds.push("tr.date >= ?");
      dateParams.push(start);
    }
    if (end) {
      dateConds.push("tr.date <= ?");
      dateParams.push(end);
    }
    const dateClause = dateConds.length ? `AND ${dateConds.join(" AND ")}` : "";

    // Build billed/unbilled filtering depending on status
    let timeBilledWhere = "1=1";
    let itemBilledWhere = "1=1";

    if (status === "unbilled") {
      timeBilledWhere =
        "(tr.billed IS NULL OR tr.billed = 0) AND (tr.invoice_number IS NULL OR tr.invoice_number = '')";
      itemBilledWhere =
        "(tri.invoice_number IS NULL OR tri.invoice_number = '')";
    } else if (status === "billed") {
      timeBilledWhere =
        "tr.billed = 1 AND (tr.invoice_number IS NOT NULL AND tr.invoice_number <> '')";
      itemBilledWhere =
        "(tri.invoice_number IS NOT NULL AND tri.invoice_number <> '')";
    }

    // -----------------------------------------
    // 2) Fetch time reports (tr) + items (tri)
    // -----------------------------------------
    const [timeRows] = await conn.query(
      `
      SELECT
        tr.id,
        tr.customer_id,
        DATE_FORMAT(tr.date, '%Y-%m-%d') AS date_ymd,
        tr.hours,
        tr.billable,
        tr.project_id,
        tr.note,
        tr.work_labor,
        tr.category AS category_id,
        tc.name AS category,
        tr.user AS user_id,
        u.name AS user_name,
        p.projectname,
        c.company AS customer_name,
        tr.billed AS tr_billed,
        tr.invoice_number AS tr_invoice_number
      FROM time_report tr
      LEFT JOIN project p ON p.id = tr.project_id
      LEFT JOIN customer c ON c.id = tr.customer_id
      LEFT JOIN time_report_categories tc ON tc.id = tr.category
      LEFT JOIN users u ON u.id = tr.user
      WHERE 1=1
      ${dateClause}
      AND ${timeBilledWhere}
      ${onlyBillable ? "AND tr.billable = 1" : ""}
      `,
      dateParams
    );

    const [itemRows] = await conn.query(
      `
      SELECT
        tri.id, tri.time_report_id, tri.amount, tri.description,
        a.id AS article_id, a.art_nr, a.name AS article_name,
        tr.customer_id, tr.project_id,
        p.projectname,
        c.company AS customer_name
      FROM time_report_item tri
      JOIN time_report tr ON tr.id = tri.time_report_id
      LEFT JOIN project p  ON p.id = tr.project_id
      LEFT JOIN articles a ON a.id = tri.article_id
      LEFT JOIN customer c ON c.id = tr.customer_id
      WHERE 1=1
      ${dateClause}
      AND ${itemBilledWhere}
      ${onlyBillable ? "AND tr.billable = 1" : ""}
      `,
      dateParams
    );

    // ---------------------------------------------------
    // 3) Fetch customer nodes + owner nodes (billing chain)
    // ---------------------------------------------------
    // Build the set of customer IDs involved in the result
    const involved = new Set();
    for (const r of timeRows) if (r.customer_id) involved.add(r.customer_id);
    for (const r of itemRows) if (r.customer_id) involved.add(r.customer_id);
    const idsList = [...involved];

    let customersRaw = [];
    if (idsList.length) {
      const inList = idsList.map(() => "?").join(",");

      // Track billed/unbilled existence within range (for UI flags)
      const [bh] = await conn.query(
        `
        SELECT tr.customer_id
        FROM time_report tr
        WHERE tr.customer_id IN (${inList})
          ${dateClause}
          AND tr.billed = 1
          AND tr.invoice_number IS NOT NULL AND tr.invoice_number <> ''
        GROUP BY tr.customer_id
        `,
        [...idsList, ...dateParams]
      );
      for (const r of bh) billedAnySet.add(r.customer_id);

      const [bi] = await conn.query(
        `
        SELECT tr.customer_id
        FROM time_report_item tri
        JOIN time_report tr ON tr.id = tri.time_report_id
        WHERE tr.customer_id IN (${inList})
          ${dateClause}
          AND tri.invoice_number IS NOT NULL AND tri.invoice_number <> ''
        GROUP BY tr.customer_id
        `,
        [...idsList, ...dateParams]
      );
      for (const r of bi) billedAnySet.add(r.customer_id);

      const [uh] = await conn.query(
        `
        SELECT tr.customer_id
        FROM time_report tr
        WHERE tr.customer_id IN (${inList})
          ${dateClause}
          AND (tr.billed IS NULL OR tr.billed = 0)
          AND (tr.invoice_number IS NULL OR tr.invoice_number = '')
        GROUP BY tr.customer_id
        `,
        [...idsList, ...dateParams]
      );
      for (const r of uh) unbilledAnySet.add(r.customer_id);

      const [ui] = await conn.query(
        `
        SELECT tr.customer_id
        FROM time_report_item tri
        JOIN time_report tr ON tr.id = tri.time_report_id
        WHERE tr.customer_id IN (${inList})
          ${dateClause}
          AND (tri.invoice_number IS NULL OR tri.invoice_number = '')
        GROUP BY tr.customer_id
        `,
        [...idsList, ...dateParams]
      );
      for (const r of ui) unbilledAnySet.add(r.customer_id);

      // Load customer rows for involved customers
      const [rows] = await conn.query(
        `
        SELECT c.id, c.company, c.billing_owner, c.customer_owner, c.customer_id, c.bill_direct
        FROM customer c
        WHERE c.id IN (${idsList.map(() => "?").join(",")})
        `,
        idsList
      );
      customersRaw = rows;

      // Check if there are unbilled rows outside the selected range (for warnings/badges in UI)
      if (start) {
        const [rows] = await conn.query(
          `
          SELECT tr.customer_id, COUNT(*) AS cnt
          FROM time_report tr
          WHERE tr.customer_id IN (${idsList.map(() => "?").join(",")})
            AND tr.date < ?
            AND (tr.billed IS NULL OR tr.billed = 0)
            AND (tr.invoice_number IS NULL OR tr.invoice_number = '')
            ${onlyBillable ? "AND tr.billable = 1" : ""}
          GROUP BY tr.customer_id
          `,
          [...idsList, start]
        );
        for (const r of rows)
          if (Number(r.cnt) > 0) hasUnbilledBeforeStartSet.add(r.customer_id);
      }

      if (end) {
        const [rows] = await conn.query(
          `
          SELECT tr.customer_id, COUNT(*) AS cnt
          FROM time_report tr
          WHERE tr.customer_id IN (${idsList.map(() => "?").join(",")})
            AND tr.date > ?
            AND (tr.billed IS NULL OR tr.billed = 0)
            AND (tr.invoice_number IS NULL OR tr.invoice_number = '')
            ${onlyBillable ? "AND tr.billable = 1" : ""}
          GROUP BY tr.customer_id
          `,
          [...idsList, end]
        );
        for (const r of rows)
          if (Number(r.cnt) > 0) hasUnbilledAfterEndSet.add(r.customer_id);
      }
    }

    // Load owner nodes (customer_owner) so we can resolve Fortnox customer id from owners too
    const ownerIds = [
      ...new Set(
        customersRaw
          .map((r) => r.customer_owner)
          .filter((v) => Number.isFinite(Number(v)))
      ),
    ];

    let ownersRaw = [];
    if (ownerIds.length) {
      const [oRows] = await conn.query(
        `
        SELECT c.id, c.company, c.billing_owner, c.customer_owner, c.customer_id, c.bill_direct
        FROM customer c
        WHERE c.id IN (${ownerIds.map(() => "?").join(",")})
        `,
        ownerIds
      );
      ownersRaw = oRows;
    }

    // Map all customers and owners by id for quick lookup
    const customerById = new Map();
    for (const r of customersRaw) customerById.set(r.id, r);
    for (const r of ownersRaw) customerById.set(r.id, r);

    /**
     * Resolves the billing-owner node for a given customer:
     * - If billing_owner === 1 -> customer is its own billing owner
     * - Otherwise -> follow customer_owner link (if present)
     */
    function resolveOwnerNode(custId) {
      const c = customerById.get(custId);
      if (!c) return null;
      if (Number(c.billing_owner) === 1) return c;
      const o = c.customer_owner ? customerById.get(c.customer_owner) : null;
      return o || null;
    }

    /**
     * Determines which Fortnox customer number to bill to.
     *
     * Your rule (as implemented here):
     * - bill_direct = 1 -> invoice the company itself (company.customer_id)
     * - bill_direct = 0 -> invoice the owner node (owner.customer_id)
     * - If chosen id is missing, customer_id becomes null (cannot create Fortnox invoice payload)
     */
    function resolveBillTo(companyRow) {
      if (!companyRow) {
        return {
          source: null,
          customer_id: null,
          company: { id: null, name: "—", customer_id: null },
          owner: null,
        };
      }

      const ownerRow = resolveOwnerNode(companyRow.id);

      const companyFort = companyRow.customer_id
        ? toFort(companyRow.customer_id)
        : null;

      const ownerFort =
        ownerRow && ownerRow.customer_id ? toFort(ownerRow.customer_id) : null;

      const billDirect = Number(companyRow.bill_direct) === 1;
      const chosenSource = billDirect ? "company" : "owner";
      const chosenId = billDirect ? companyFort : ownerFort;

      return {
        source: chosenId ? chosenSource : null,
        customer_id: chosenId ?? null,
        company: {
          id: companyRow.id ?? null,
          name: companyRow.company ?? "—",
          customer_id: companyFort,
        },
        owner: ownerRow
          ? {
              id: ownerRow.id ?? null,
              name: ownerRow.company ?? "—",
              customer_id: ownerFort,
            }
          : null,
      };
    }

    // ---------------------------------------------------
    // 4) Build an index: items per time report (timecard)
    // ---------------------------------------------------
    const itemsByTR = new Map(); // tr.id -> array of item objects
    for (const it of itemRows) {
      const arr = itemsByTR.get(it.time_report_id) || [];
      arr.push({
        id: it.id,
        amount: Number(it.amount || 0),
        description: it.description || null,
        article: it.article_id
          ? {
              id: it.article_id,
              number: it.art_nr || null,
              name: it.article_name || null,
            }
          : null,
        project: it.project_id
          ? { id: it.project_id, name: it.projectname || null }
          : null,
      });
      itemsByTR.set(it.time_report_id, arr);
    }

    // ---------------------------------------------------
    // 5) Group everything into buckets per company/customer
    // ---------------------------------------------------
    const byCompany = new Map();

    /**
     * Ensures a bucket exists for this company.
     * A bucket collects:
     * - totals
     * - timecards rows
     * - articles overview
     * - invoice lines
     * - lock id lists for later "mark billed"
     * - meta info and billing info
     */
    function ensureBucket(companyRow) {
      const key = companyRow?.id ?? `missing:${companyRow?.company || "-"}`;
      let b = byCompany.get(key);
      if (b) return b;

      const billTo = resolveBillTo(companyRow);

      b = {
        company: companyRow
          ? {
              id: companyRow.id,
              name: companyRow.company,
              customer_id: toFort(companyRow.customer_id),
            }
          : { id: null, name: "—", customer_id: null },

        billingInfo: {
          customer_id: billTo.customer_id,
          source: billTo.source, // "company" | "owner" | null
          company: billTo.company,
          owner: billTo.owner,
        },

        total: {
          hoursSum: 0,
          timeReportCount: 0,
          itemCount: 0,
          registeredArticleIds: new Set(),
          customArticleNames: new Set(),
        },

        timecards: {
          rows: [],
          articles: {
            registered: new Map(), // article_id -> { article, qty }
            custom: new Map(),     // description -> { description, qty }
          },
        },

        lines: [],
        locks: { timeReportIds: [], timeReportItemIds: [] },

        meta: {
          sourceRowCount: 0,
          periodHours: 0,
          firstDate: null,
          lastDate: null,
          projects: new Set(),
        },
      };

      byCompany.set(key, b);
      return b;
    }

    // Fill buckets with time reports (timecards)
    for (const tr of timeRows) {
      const companyRow = customerById.get(tr.customer_id) || null;
      const b = ensureBucket(companyRow);

      const hours = Number(tr.hours || 0);
      b.total.hoursSum += hours;
      b.total.timeReportCount += 1;
      b.locks.timeReportIds.push(tr.id);

      b.meta.sourceRowCount += 1;
      b.meta.periodHours += hours;

      const d = tr.date_ymd;
      if (!b.meta.firstDate || d < b.meta.firstDate) b.meta.firstDate = d;
      if (!b.meta.lastDate || d > b.meta.lastDate) b.meta.lastDate = d;
      if (tr.project_id) b.meta.projects.add(tr.project_id);

      const tcItems = itemsByTR.get(tr.id) || [];

      b.timecards.rows.push({
        id: tr.id,
        date: tr.date_ymd,
        hours,
        billable: !!tr.billable,
        project: tr.project_id
          ? { id: tr.project_id, name: tr.projectname || null }
          : null,
        note: tr.note || null,
        work_labor: tr.work_labor || null,
        category: tr.category || null,
        category_id: tr.category_id ?? null,
        user_id: tr.user_id ?? null,
        user_name: tr.user_name ?? null,
        customer: tr.customer_id
          ? { id: tr.customer_id, name: tr.customer_name || null }
          : null,
        items: tcItems,

        // Billing info per row for UI display
        billing: {
          billed:
            !!Number(tr.tr_billed) ||
            !!(tr.tr_invoice_number && String(tr.tr_invoice_number).trim()),
          invoiceNumber: tr.tr_invoice_number || null,
        },
      });
    }

    // Fill buckets with items and build per-company article overview
    for (const it of itemRows) {
      const companyRow = customerById.get(it.customer_id) || null;
      const b = ensureBucket(companyRow);

      const qty = Number(it.amount || 0);
      if (qty) b.total.itemCount += qty;

      b.locks.timeReportItemIds.push(it.id);

      if (it.article_id) {
        // Registered article
        b.total.registeredArticleIds.add(it.article_id);

        const key = it.article_id;
        const reg = b.timecards.articles.registered.get(key) || {
          article: {
            id: it.article_id,
            number: it.art_nr || null,
            name: it.article_name || null,
          },
          qty: 0,
        };
        reg.qty += qty;
        b.timecards.articles.registered.set(key, reg);
      } else {
        // Custom item (no article id) grouped by description
        const desc = it.description || "Item";
        b.total.customArticleNames.add(desc);

        const key = desc;
        const cus = b.timecards.articles.custom.get(key) || {
          description: desc,
          qty: 0,
        };
        cus.qty += qty;
        b.timecards.articles.custom.set(key, cus);
      }

      if (it.project_id) b.meta.projects.add(it.project_id);
    }

    // ---------------------------------------------------
    // 6) Build invoice lines (labor + items) per bucket
    // ---------------------------------------------------
    let categoryNameById = new Map();
    if (group.labor === "byCategory") {
      // Needed to translate category IDs into readable names
      const [cats] = await conn.query(`SELECT id, name FROM time_report_categories`);
      categoryNameById = new Map(cats.map((c) => [c.id, c.name]));
    }

    /**
     * Builds invoice lines for one company bucket:
     * - Labor lines: based on group.labor (single vs grouped)
     * - Item lines: based on group.items (byArticle vs grouped by description)
     * - Optionally adds "project dimension" so lines split per project.
     */
    function buildLinesFor(bucket) {
      const custId = bucket.company.id;

      // Filter global rows to only rows for this bucket/company
      const custTime = timeRows.filter(
        (r) => String(r.customer_id ?? "") === String(custId ?? "")
      );
      const custItems = itemRows.filter(
        (r) => String(r.customer_id ?? "") === String(custId ?? "")
      );

      // ----- Labor lines -----
      if (custTime.length) {
        if (group.labor === "single") {
          // One labor line for all hours
          const qty = custTime.reduce((s, r) => s + Number(r.hours || 0), 0);
          if (qty > 0) {
            bucket.lines.push({
              kind: "labor",
              source: { type: "hours", ids: custTime.map((r) => r.id) },
              articleId: null,
              articleNumber: null,
              description: "Labor",
              qty,
              unit: "h",
              unitPrice: null,
              vatPercent: 25,
              projectId: null,
              projectName: null,
            });
          }
        } else {
          // Group labor by Category or by WorkLabel
          const keyOf = (r) => {
            const part =
              group.labor === "byCategory"
                ? categoryNameById.get(r.category) || "Uncategorized"
                : r.work_labor || "Labor";

            // If project dimension is enabled, split per project too
            const proj = group.includeProjectDimension
              ? `|p:${r.project_id || "-"}`
              : "";

            return `${part}${proj}`;
          };

          const buckets = new Map();
          for (const r of custTime) {
            const key = keyOf(r);
            const b = buckets.get(key) || {
              ids: [],
              qty: 0,
              label: null,
              projectId: null,
              projectName: null,
            };

            b.ids.push(r.id);
            b.qty += Number(r.hours || 0);

            b.label =
              group.labor === "byCategory"
                ? categoryNameById.get(r.category) || "Uncategorized"
                : r.work_labor || "Labor";

            if (group.includeProjectDimension) {
              b.projectId = r.project_id || null;
              b.projectName = r.projectname || null;
            }

            buckets.set(key, b);
          }

          // Emit one invoice line per labor bucket
          for (const [, b] of buckets) {
            if (b.qty > 0) {
              bucket.lines.push({
                kind: "labor",
                source: { type: "hours", ids: b.ids },
                articleId: null,
                articleNumber: null,
                description: b.label,
                qty: b.qty,
                unit: "h",
                unitPrice: null,
                vatPercent: 25,
                projectId: b.projectId ?? null,
                projectName: b.projectName ?? null,
              });
            }
          }
        }
      }

      // ----- Item lines -----
      if (custItems.length) {
        if (group.items === "byArticle") {
          // Separate registered vs custom and group them
          const reg = new Map();
          const cus = new Map();

          for (const it of custItems) {
            const qty = Number(it.amount || 0);
            if (!qty) continue;

            const projKey = group.includeProjectDimension
              ? `|p:${it.project_id || "-"}`
              : "";

            if (it.article_id) {
              // Registered article groups by article_id (+ project if enabled)
              const key = `${it.article_id}${projKey}`;
              const b = reg.get(key) || {
                ids: [],
                qty: 0,
                articleId: it.article_id,
                articleNumber: it.art_nr || null,
                description: it.article_name || null,
                projectId: group.includeProjectDimension ? it.project_id || null : null,
                projectName: group.includeProjectDimension ? it.projectname || null : null,
              };
              b.ids.push(it.id);
              b.qty += qty;
              reg.set(key, b);
            } else {
              // Custom items group by description (+ project if enabled)
              const key = `${it.description || "Item"}${projKey}`;
              const b = cus.get(key) || {
                ids: [],
                qty: 0,
                description: it.description || "Item",
                projectId: group.includeProjectDimension ? it.project_id || null : null,
                projectName: group.includeProjectDimension ? it.projectname || null : null,
              };
              b.ids.push(it.id);
              b.qty += qty;
              cus.set(key, b);
            }
          }

          // Emit registered article lines
          for (const [, b] of reg) {
            bucket.lines.push({
              kind: "registered",
              source: { type: "item", ids: b.ids },
              articleId: b.articleId,
              articleNumber: b.articleNumber,
              description: b.description,
              qty: b.qty,
              unit: "pcs",
              unitPrice: null,
              vatPercent: 25,
              projectId: b.projectId,
              projectName: b.projectName,
            });
          }

          // Emit custom item lines
          for (const [, b] of cus) {
            bucket.lines.push({
              kind: "custom",
              source: { type: "item", ids: b.ids },
              articleId: null,
              articleNumber: null,
              description: b.description,
              qty: b.qty,
              unit: "pcs",
              unitPrice: null,
              vatPercent: 25,
              projectId: b.projectId,
              projectName: b.projectName,
            });
          }
        } else {
          // Alternative mode: group items by human description (article name/number or custom description)
          const buckets = new Map();

          for (const it of custItems) {
            const qty = Number(it.amount || 0);
            if (!qty) continue;

            const desc = it.article_id
              ? it.article_name || it.art_nr || "Article"
              : it.description || "Item";

            const projKey = group.includeProjectDimension
              ? `|p:${it.project_id || "-"}`
              : "";

            const key = `${desc}${projKey}`;

            const b = buckets.get(key) || {
              ids: [],
              qty: 0,
              desc,
              hasArticle: false,
              articleId: null,
              articleNumber: null,
              projectId: group.includeProjectDimension ? it.project_id || null : null,
              projectName: group.includeProjectDimension ? it.projectname || null : null,
            };

            b.ids.push(it.id);
            b.qty += qty;

            if (it.article_id) {
              b.hasArticle = true;
              b.articleId = it.article_id;
              b.articleNumber = it.art_nr || null;
            }

            buckets.set(key, b);
          }

          // Emit one line per group
          for (const [, b] of buckets) {
            bucket.lines.push({
              kind: b.hasArticle ? "registered" : "custom",
              source: { type: "item", ids: b.ids },
              articleId: b.articleId,
              articleNumber: b.articleNumber,
              description: b.desc,
              qty: b.qty,
              unit: "pcs",
              unitPrice: null,
              vatPercent: 25,
              projectId: b.projectId,
              projectName: b.projectName,
            });
          }
        }
      }
    }

    for (const [, bucket] of byCompany) buildLinesFor(bucket);

    // ---------------------------------------------------
    // 7) Material helpers for Fortnox payload generation
    // ---------------------------------------------------

    /**
     * Extracts raw material rows from the bucket's timecards, limited to the IDs
     * we plan to lock (bucket.locks.timeReportItemIds).
     *
     * NOTE: In your current code articleNumber is hardcoded to "87" in the output,
     * and later materialArticleNo defaults to "87". That indicates you invoice
     * all materials using a single Fortnox article number.
     */
    function rawMaterialsFromBucket(bucket) {
      const wanted = new Set(bucket.locks?.timeReportItemIds || []);
      const rows = bucket.timecards?.rows || [];
      const out = [];

      for (const r of rows) {
        for (const it of r.items || []) {
          if (wanted.size === 0 || wanted.has(it.id)) {
            out.push({
              id: it.id,
              amount: Number(it.amount || 0),
              description: it.description || null,
              articleNumber: "87",
              timeReportId: r.id,
              date: r.date,
            });
          }
        }
      }

      return out.filter((x) => x.amount > 0);
    }

    /**
     * Builds a Fortnox "Invoice" JSON payload for materials only.
     * - Uses CustomerNumber, InvoiceDate, DueDate
     * - Adds one InvoiceRow per material item
     * - Uses a single Fortnox ArticleNumber (default "87") for all rows
     */
    function buildMaterialsInvoiceFromBucket(
      bucket,
      {
        customerNumber,
        invoiceDate = ymd(),
        dueInDays = 30,
        materialArticleNo = "87",
        yourReference,
      } = {}
    ) {
      const raw = rawMaterialsFromBucket(bucket);
      if (raw.length === 0) return null;

      const dueDate = addDaysYMD(invoiceDate, dueInDays);

      return {
        Invoice: {
          CustomerNumber: String(customerNumber),
          InvoiceDate: invoiceDate,
          DueDate: dueDate,
          YourReference: yourReference || undefined,
          InvoiceRows: raw.map((it) => ({
            ArticleNumber: materialArticleNo,
            DeliveredQuantity: it.amount,
            Description: it.description || "Material",
          })),
        },
      };
    }

    // ---------------------------------------------------
    // 8) Format the final response for the frontend
    // ---------------------------------------------------
    const customers = [...byCompany.values()]
      .map((b) => {
        const total = {
          hoursSum: b.total.hoursSum,
          timeReportCount: b.total.timeReportCount,
          itemCount: b.total.itemCount,
          registeredArticleCount: b.total.registeredArticleIds.size,
          customArticleCount: b.total.customArticleNames.size,
        };

        const timecardsArticles = {
          registered: [...b.timecards.articles.registered.values()],
          custom: [...b.timecards.articles.custom.values()],
        };

        const materialsRaw = rawMaterialsFromBucket(b);
        const invoiceDate = ymd();

        // Only generate Fortnox payload if we resolved a bill-to customer number
        const materialsInvoice = b.billingInfo?.customer_id
          ? buildMaterialsInvoiceFromBucket(b, {
              customerNumber: b.billingInfo.customer_id,
              invoiceDate,
              dueInDays: 30,
              materialArticleNo: "87",
            })
          : null;

        // UI flags about unbilled rows outside selected range
        const hasUnbilledBeforeStart =
          start && b.company?.id
            ? hasUnbilledBeforeStartSet.has(b.company.id)
            : false;

        const hasUnbilledAfterEnd =
          end && b.company?.id
            ? hasUnbilledAfterEndSet.has(b.company.id)
            : false;

        const cid = b.company?.id ?? null;

        // "rowsPresent" means this bucket has any content in this response
        const rowsPresent =
          b.total.timeReportCount > 0 || b.locks.timeReportItemIds?.length > 0;

        // Determine billed/unbilled presence within range (for "mixed" state)
        let hasBilledInRange = cid != null ? billedAnySet.has(cid) : false;
        let hasUnbilledInRange = cid != null ? unbilledAnySet.has(cid) : false;

        // If user explicitly asked for unbilled/billed, override flags to match the filtered result
        if (status === "unbilled") {
          hasBilledInRange = false;
          hasUnbilledInRange = rowsPresent;
        } else if (status === "billed") {
          hasBilledInRange = rowsPresent;
          hasUnbilledInRange = false;
        }

        // Compute a single billing "state" label for the UI
        const billingState = !rowsPresent
          ? "empty"
          : status === "unbilled"
          ? "unbilled"
          : status === "billed"
          ? "billed"
          : hasBilledInRange && hasUnbilledInRange
          ? "mixed"
          : hasBilledInRange
          ? "billed"
          : hasUnbilledInRange
          ? "unbilled"
          : "empty";

        return {
          company: b.company,
          billingInfo: b.billingInfo,
          total,
          timecards: {
            articles: timecardsArticles,
            rows: b.timecards.rows.sort((a, z) => (a.date < z.date ? -1 : 1)),
          },
          lines: b.lines,
          locks: b.locks,
          meta: {
            ...b.meta,
            projects: [...b.meta.projects],
            flags: {
              ...b.meta.flags,
              hasUnbilledBeforeStart,
              hasUnbilledAfterEnd,
              hasBilledInRange,
              hasUnbilledInRange,
              isFullyBilledInRange: hasBilledInRange && !hasUnbilledInRange,
            },
            billing: { state: billingState },
            rangeApplied: Boolean(start || end),
          },
          materialsRaw,
          materialsInvoice,
        };
      })
      .sort((a, b) =>
        (a.company.name || "").localeCompare(b.company.name || "", "sv")
      );

    res.json({
      start: start ?? null,
      end: end ?? null,
      onlyBillable,
      status,
      group,
      count: customers.length,
      customers,
    });
  } catch (e) {
    console.error("collectAllInvoiceData error:", e);
    res
      .status(500)
      .json({ error: "Internal error", detail: String(e?.message || e) });
  } finally {
    conn.release();
  }
}

/**
 * POST /invoice/lock-and-mark
 *
 * Locks the selected time_report rows using SELECT ... FOR UPDATE,
 * verifies they are still unbilled, and then updates them to:
 * - billed = 1
 * - invoice_number = <invoiceNumber>
 *
 * Uses a DB transaction so the lock + update are atomic.
 * Returns 409 if any row was already billed/missing.
 */
export async function lockAndMarkBilled(req, res) {
  const conn = await db.getConnection();
  try {
    const body = req.body || {};
    const invoiceNumber = body.invoiceNumber ?? null;

    // De-duplicate and sanitize IDs
    const ids = uniq(
      (body?.locks?.timeReportIds || []).map(Number).filter(Number.isFinite)
    );

    // Basic validation
    if (!ids.length || invoiceNumber === null || invoiceNumber === "") {
      return res
        .status(400)
        .json({ error: "locks.timeReportIds and invoiceNumber are required" });
    }

    await conn.beginTransaction();

    // Lock and verify rows are still unbilled (prevents double billing)
    const { sql, params } = inList(ids);
    const [check] = await conn.query(
      `SELECT id FROM time_report WHERE id IN ${sql} AND (billed IS NULL OR billed = 0) FOR UPDATE`,
      params
    );

    if (check.length !== ids.length) {
      await conn.rollback();
      return res
        .status(409)
        .json({ error: "Some time reports are already billed or missing" });
    }

    // Update all locked rows
    const [upd] = await conn.query(
      `UPDATE time_report SET billed = 1, invoice_number = ? WHERE id IN ${sql}`,
      [invoiceNumber, ...params]
    );

    await conn.commit();
    res.json({ ok: true, affected: upd.affectedRows });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("lockAndMarkBilled error:", e);
    res
      .status(500)
      .json({ error: "Internal error", detail: String(e?.message || e) });
  } finally {
    conn.release();
  }
}

/**
 * POST /invoice/lock-and-mark-items
 *
 * Locks the selected time_report_item rows using SELECT ... FOR UPDATE,
 * verifies they are still not invoiced, and then updates them to:
 * - invoice_number = <invoiceNumber>
 *
 * Uses a DB transaction so the lock + update are atomic.
 * Returns 409 if any row was already invoiced/missing.
 */
export async function lockAndMarkItems(req, res) {
  const conn = await db.getConnection();
  try {
    const body = req.body || {};
    const invoiceNumber = body.invoiceNumber ?? null;

    // De-duplicate and sanitize IDs
    const ids = uniq(
      (body?.locks?.timeReportItemIds || []).map(Number).filter(Number.isFinite)
    );

    // Basic validation
    if (!ids.length || !invoiceNumber) {
      return res.status(400).json({
        error: "locks.timeReportItemIds and invoiceNumber are required",
      });
    }

    await conn.beginTransaction();

    // Lock and verify rows are still uninvoiced
    const { sql, params } = inList(ids);
    const [check] = await conn.query(
      `SELECT id FROM time_report_item
       WHERE id IN ${sql} AND (invoice_number IS NULL OR invoice_number = '')
       FOR UPDATE`,
      params
    );

    if (check.length !== ids.length) {
      await conn.rollback();
      return res
        .status(409)
        .json({ error: "Some items are already invoiced or missing" });
    }

    // Update all locked rows
    const [upd] = await conn.query(
      `UPDATE time_report_item
       SET invoice_number = ?
       WHERE id IN ${sql}`,
      [invoiceNumber, ...params]
    );

    await conn.commit();
    res.json({ ok: true, affected: upd.affectedRows });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    console.error("lockAndMarkItems error:", e);
    res
      .status(500)
      .json({ error: "Internal error", detail: String(e?.message || e) });
  } finally {
    conn.release();
  }
}
