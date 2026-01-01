// src/helpers/fortnoxBuilders.ts
/**
 * fortnoxBuilders
 *
 * Helper utilities that transform backend "BillingEnvelope" data into Fortnox invoice payloads.
 *
 * What this module does:
 * - Derives a billing period (start/end) from envelope metadata or timecard rows
 * - Builds two Fortnox invoices per customer/company:
 *   1) Labor invoice (hours) using a configured labor ArticleNumber (default "100")
 *   2) Materials invoice (items) using a configured material ArticleNumber (default "87")
 *
 * Key behaviors:
 * - Labor is grouped into one invoice row per user (billable rows only)
 * - Materials are extracted as raw items from timecards.rows (optionally filtered by lock ids)
 * - The derived billing period is embedded as Meta on invoice rows so the backend can:
 *   - validate / enrich the period
 *   - rewrite descriptions and apply pricing logic
 *   - sanitize/strip Meta fields before sending to Fortnox (if needed)
 *
 * Important design note:
 * This module is intentionally "backend-driven". The frontend only shapes payloads.
 * All final pricing, grouping, validation, and Fortnox-specific normalization should be handled server-side.
 */

import type {
  BillingEnvelope,
  Line,
  LaborLine,
  FortnoxInvoice,
} from "../models/Invoice";

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD (Fortnox-friendly date format). */
const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/** Return a new Date that is `days` after the input date (does not mutate original). */
const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

/**
 * Format a date as "Month YYYY" in Swedish and capitalize the first letter.
 * Example: "oktober 2025" -> "Oktober 2025"
 */
function monthYearSv(d: Date) {
  const s = new Intl.DateTimeFormat("sv-SE", {
    month: "long",
    year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type BuildOptions = {
  laborArticleNo?: string; // default: "100"
  materialArticleNo?: string; // default: "87"
  includeCustomItems?: boolean; // currently not used for the new raw material flow
  invoiceDate?: string; // default: today (YYYY-MM-DD)
  dueInDays?: number; // default: 30
  referenceText?: (env: BillingEnvelope) => string | undefined;
};

const defaults: Required<
  Omit<BuildOptions, "invoiceDate" | "referenceText">
> & {
  invoiceDate?: string;
  referenceText: (env: BillingEnvelope) => string | undefined;
} = {
  laborArticleNo: "100",
  materialArticleNo: "87",
  includeCustomItems: false,
  dueInDays: 30,
  invoiceDate: undefined,
  referenceText: (env) =>
    env.meta?.firstDate && env.meta?.lastDate
      ? `Work period ${env.meta.firstDate}–${env.meta.lastDate}`
      : undefined,
};

// ---------------------------------------------------------------------------
// Envelope helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the Fortnox customer number for this envelope.
 * Throws if missing since Fortnox invoice creation cannot proceed without it.
 */
function ensureCustomerNo(env: BillingEnvelope): string {
  const n = env.billingInfo?.customer_id ?? env.company?.customer_id ?? null;
  if (!n)
    throw new Error(
      `Missing Fortnox CustomerNumber for company ${env.company?.name ?? ""}`
    );
  return String(n);
}

/**
 * Try to pick a date string from a row using several known property names.
 * Returns null if no valid YYYY-MM-DD string can be found.
 */
function pickRowDateLike(r: any): string | null {
  const d = r?.date || r?.ymd || r?.work_date || r?.WorkDate || null;
  if (!d) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? String(d) : null;
}

/**
 * Compute billing period from the envelope.
 * Priority:
 * 1) env.meta.firstDate/lastDate
 * 2) infer from timecards.rows by finding min/max date
 */
function computePeriodFromEnv(
  env: BillingEnvelope
): { start?: string; end?: string } {
  const first = env?.meta?.firstDate;
  const last = env?.meta?.lastDate;
  if (first && last) return { start: first, end: last };

  const rows = env?.timecards?.rows ?? [];
  const dates: string[] = [];
  for (const r of rows) {
    const d = pickRowDateLike(r);
    if (d) dates.push(d);
  }

  if (dates.length === 0) return {};
  dates.sort(); // lexicographic sort works for YYYY-MM-DD
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * Build a Swedish month/year display title based on a start/end date range.
 * Examples:
 * - Same month: "November 2025"
 * - Different months: "Augusti–November 2025"
 */
function monthYearSvTitleRange(start?: string, end?: string): string | null {
  if (!start && !end) return null;
  const s = start ? new Date(start) : undefined;
  const e = end ? new Date(end) : undefined;

  if (
    s &&
    e &&
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth()
  ) {
    return monthYearSv(s);
  }

  if (s && e) {
    const sStr = new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(s);
    const eStr = monthYearSv(e);
    const sPretty = sStr.charAt(0).toUpperCase() + sStr.slice(1);
    return `${sPretty}–${eStr}`;
  }

  if (s) return monthYearSv(s);
  if (e) return monthYearSv(e);
  return null;
}

// ---------------------------------------------------------------------------
// Raw material extraction
// ---------------------------------------------------------------------------

/**
 * Minimal representation of a material item extracted from timecard rows.
 * Note: articleNumber is extracted (if present) but currently not used in the invoice row payload.
 */
type RawMatItem = {
  id: number;
  amount: number;
  description: string | null;
  unit?: string | null;
  vatPercent?: number | null;
  articleNumber?: string | null;
};

/**
 * Extract raw material items directly from env.timecards.rows.
 * If env.locks.timeReportItemIds is present, only those items are included.
 */
function pickRawMaterialItems(env: BillingEnvelope): RawMatItem[] {
  const wanted = new Set<number>(env.locks?.timeReportItemIds ?? []);
  const rows = env.timecards?.rows ?? [];
  const out: RawMatItem[] = [];

  for (const r of rows) {
    for (const it of r.items ?? []) {
      if (wanted.size === 0 || wanted.has(it.id)) {
        out.push({
          id: it.id,
          amount: Number(it.amount ?? 0),
          description: it.description ?? null,
          articleNumber:
            it.article && "number" in it.article ? it.article?.number ?? null : null,
        });
      }
    }
  }

  // Only keep positive quantities
  return out.filter((x) => x.amount > 0);
}

// ---------------------------------------------------------------------------
// Labor invoice builder
// ---------------------------------------------------------------------------

/**
 * Build a Fortnox invoice payload for labor (hours).
 *
 * New behavior:
 * - Creates one invoice row per user (billable rows only)
 * - Embeds billing period in row.Meta for backend processing
 *
 * Fallback behavior:
 * - If timecards.rows is empty, uses env.lines (legacy flow) and builds one summarized row.
 */
export function buildLaborInvoice(
  env: BillingEnvelope,
  opt?: BuildOptions
): FortnoxInvoice | null {
  const o = { ...defaults, ...opt };

  const { start: periodStart, end: periodEnd } = computePeriodFromEnv(env);
  const titleRange = monthYearSvTitleRange(periodStart, periodEnd);

  const rows = env?.timecards?.rows ?? [];

  // --- Legacy fallback: use env.lines if no timecard rows exist ---
  if (!rows.length) {
    const labor = (env.lines as Line[]).filter(
      (l): l is LaborLine => l.kind === "labor"
    );
    if (labor.length === 0) return null;

    const invoiceDate = o.invoiceDate ?? fmtYMD(new Date());
    const dueDate = fmtYMD(addDays(new Date(invoiceDate), o.dueInDays));
    const totalHours = labor.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);

    const description = titleRange
      ? `Support / Arbete ${titleRange}`
      : `Support / Arbete`;

    const userId = env?.timecards?.rows?.[0]?.user_id ?? null;

    return {
      Invoice: {
        CustomerNumber: ensureCustomerNo(env),
        InvoiceDate: invoiceDate,
        DueDate: dueDate,
        InvoiceRows: [
          {
            ArticleNumber: o.laborArticleNo,
            DeliveredQuantity: totalHours,
            Unit: "h",
            Description: description,
            UserId: userId,
            Meta: {
              periodStart: periodStart ?? undefined,
              periodEnd: periodEnd ?? undefined,
            },
          } as any,
        ],
      },
    };
  }

  // --- Group labor by user (billable only) ---
  type Group = {
    userId: number;
    userName: string;
    hours: number;
    timeReportIds: number[];
    dates: string[];
  };

  const map = new Map<number, Group>();

  for (const r of rows) {
    if (!r.billable) continue;

    const uid = Number(r.user_id);
    const uname = r.user_name || `User ${uid}`;

    const g =
      map.get(uid) ?? {
        userId: uid,
        userName: uname,
        hours: 0,
        timeReportIds: [],
        dates: [],
      };

    g.hours += Number(r.hours) || 0;
    if (r.id) g.timeReportIds.push(r.id);

    const d = pickRowDateLike(r);
    if (d) g.dates.push(d);

    map.set(uid, g);
  }

  const groups = Array.from(map.values()).filter((g) => g.hours > 0);
  if (!groups.length) return null;

  const invoiceDate = o.invoiceDate ?? fmtYMD(new Date());
  const dueDate = fmtYMD(addDays(new Date(invoiceDate), o.dueInDays));

  const invoiceRows = groups.map((g) => {
    const desc = titleRange
      ? `Support / Arbete ${titleRange} – ${g.userName}`
      : `Support / Arbete – ${g.userName}`;

    g.dates.sort();
    const gStart = g.dates[0];
    const gEnd = g.dates[g.dates.length - 1];

    return {
      ArticleNumber: o.laborArticleNo,
      DeliveredQuantity: g.hours,
      Unit: "h",
      Description: desc,
      UserId: g.userId,
      Meta: {
        periodStart: periodStart ?? gStart ?? undefined,
        periodEnd: periodEnd ?? gEnd ?? undefined,
      },
      Date: gStart ?? undefined,
    } as any;
  });

  return {
    Invoice: {
      CustomerNumber: ensureCustomerNo(env),
      InvoiceDate: invoiceDate,
      DueDate: dueDate,
      InvoiceRows: invoiceRows,
    },
  };
}

// ---------------------------------------------------------------------------
// Materials invoice builder
// ---------------------------------------------------------------------------

/**
 * Build a Fortnox invoice payload for materials.
 *
 * This uses the "raw items" extraction from timecards.rows (and optional locks),
 * rather than env.lines, because env.lines for materials is often pre-grouped and
 * loses per-item identity.
 *
 * Each raw item becomes one invoice row using the configured material article number.
 */
export function buildMaterialsInvoice(
  env: BillingEnvelope,
  opt?: BuildOptions
): FortnoxInvoice | null {
  const o = { ...defaults, ...opt };
  const raw = pickRawMaterialItems(env);
  if (raw.length === 0) return null;

  const invoiceDate = o.invoiceDate ?? fmtYMD(new Date());
  const dueDate = fmtYMD(addDays(new Date(invoiceDate), o.dueInDays));
  const userId = env?.timecards?.rows?.[0]?.user_id ?? null;

  return {
    Invoice: {
      CustomerNumber: ensureCustomerNo(env),
      InvoiceDate: invoiceDate,
      DueDate: dueDate,
      InvoiceRows: raw.map((it) => ({
        ArticleNumber: o.materialArticleNo,
        DeliveredQuantity: it.amount,
        Description: it.description ?? "Material",
        TimeReportItemId: it.id,
        UserId: userId,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience builders
// ---------------------------------------------------------------------------

/** Build labor + materials invoices for a single envelope (two invoice payloads). */
export function buildTwoInvoices(
  env: BillingEnvelope,
  options?: BuildOptions
): { labor: FortnoxInvoice | null; materials: FortnoxInvoice | null } {
  return {
    labor: buildLaborInvoice(env, options),
    materials: buildMaterialsInvoice(env, options),
  };
}

/**
 * Build invoice payloads for a selection of envelopes from the UI.
 * Returns one entry per company, containing labor/material invoices if present.
 */
export function buildForSelection(
  envelopes: BillingEnvelope[],
  options?: BuildOptions
): Array<{
  envelopeCompanyId: number;
  labor?: FortnoxInvoice;
  materials?: FortnoxInvoice;
}> {
  return envelopes.map((env) => {
    const { labor, materials } = buildTwoInvoices(env, options);
    return {
      envelopeCompanyId: env.company.id,
      ...(labor ? { labor } : {}),
      ...(materials ? { materials } : {}),
    };
  });
}
