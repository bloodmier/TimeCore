// src/helpers/Time/pdfBuilder.ts
/**
 * pdfBuilder
 *
 * Helper utilities for building worklog PDF generation payloads.
 *
 * What this module does:
 * - Normalizes "timecard" data from a BillingEnvelope-like structure into WorklogRow[] (date, hours, user, category, description)
 * - Derives a billing period window from the available rows:
 *   - "actual": uses min/max row dates
 *   - "calendar-month": uses the calendar month boundaries based on either:
 *       - an explicit invoiceDate (from 1st of month -> invoiceDate)
 *       - or the month of the earliest row (1st -> last day of that month)
 * - Filters rows by the derived period, with an optional fallback:
 *   if invoiceDate-based filtering yields no rows, it can fallback to full calendar month.
 * - Produces a WorklogGeneratePayload that the backend uses to generate/queue a PDF.
 *
 * Design note:
 * This module is intentionally backend-driven. The frontend only prepares a clean,
 * minimal payload. The backend remains responsible for:
 * - validating the invoice reference
 * - generating the PDF
 * - linking/attaching it to the invoice
 * - applying any final formatting rules and language logic
 */

import type {
  BillingEnvelopeLike,
  WorklogGeneratePayload,
  WorklogRow,
} from "../models/Invoice";

type PeriodMode = "calendar-month" | "actual";

/** Convert a Date to ISO YYYY-MM-DD. */
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Convert a date-like input into a UTC-normalized Date at midnight.
 * Supports:
 * - Date instances
 * - "YYYY-MM-DD"
 * - full ISO strings with time (e.g. "YYYY-MM-DDTHH:mm:ssZ")
 */
function toDateUTC(dateLike: string | Date): Date {
  if (dateLike instanceof Date) {
    return new Date(
      Date.UTC(dateLike.getFullYear(), dateLike.getMonth(), dateLike.getDate())
    );
  }

  // Support full ISO strings with time component
  if (dateLike.includes("T")) {
    const d = new Date(dateLike);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // Support plain "YYYY-MM-DD"
  return new Date(dateLike + "T00:00:00Z");
}

/** Return YYYY-MM-DD for the first day of the month for the given UTC date. */
function monthStart(d: Date) {
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

/** Return YYYY-MM-DD for the last day of the month for the given UTC date. */
function monthEnd(d: Date) {
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/**
 * Filter worklog rows by inclusive date range.
 * Requires r.date to be ISO "YYYY-MM-DD" so lexicographic comparison works.
 */
function filterRowsByPeriod(rows: WorklogRow[], from: string, to: string) {
  return rows.filter((r) => r.date >= from && r.date <= to);
}

/**
 * Normalize a BillingEnvelope-like structure to WorklogRow[].
 * Accepts both:
 * - env.timecards as an array
 * - env.timecards.rows as a nested array
 */
export function toWorklogRows(env: BillingEnvelopeLike): WorklogRow[] {
  const src = Array.isArray(env.timecards) ? env.timecards : env.timecards?.rows ?? [];

  const rows: WorklogRow[] = (src ?? []).map((r) => ({
    date: r.date,
    desc: (r.work_labor ?? r.note ?? "") || undefined,
    hours: Number(r.hours ?? r.hour ?? r.time ?? 0),
    by: String(r.user_name),
    category: String(r.category),
  }));

  // Keep only valid rows with positive hours and a date
  return rows.filter((r) => r.date && Number.isFinite(r.hours) && r.hours > 0);
}

/**
 * Derive the period window for a set of worklog rows.
 *
 * Modes:
 * - "actual": from the earliest row date -> latest row date
 * - "calendar-month":
 *   - if opts.endDate is provided: 1st of that month -> endDate
 *   - else: 1st -> last day of the month based on earliest row date
 */
export function derivePeriod(
  rows: WorklogRow[],
  mode: PeriodMode = "calendar-month",
  opts?: { endDate?: string | Date }
) {
  if (!rows.length) return { from: undefined, to: undefined };

  // Actual min/max period based on row dates
  if (mode === "actual") {
    const ds = rows.map((r) => r.date).sort((a, b) => a.localeCompare(b));
    return { from: ds[0], to: ds[ds.length - 1] };
  }

  // Calendar month mode: if endDate exists => 1st -> endDate
  if (opts?.endDate != null) {
    const end = toDateUTC(opts.endDate);
    return { from: monthStart(end), to: iso(end) };
  }

  // Default: derive month from earliest row, then 1st -> month end
  const d0 = toDateUTC(
    rows.map((r) => r.date).sort((a, b) => a.localeCompare(b))[0]
  );

  return { from: monthStart(d0), to: monthEnd(d0) };
}

/**
 * Build a WorklogGeneratePayload for backend PDF generation.
 *
 * Primary behavior:
 * - If invoiceDate is provided: period = 1st -> invoiceDate (within that month)
 * - Else: period = 1st -> last day of month based on earliest row date
 *
 * Fallback behavior (default enabled):
 * - If invoiceDate-based filtering produces zero rows, fallback to the full month
 *   (1st -> last day of that month).
 */
export function buildWorklogGeneratePayload(
  env: BillingEnvelopeLike,
  laborInvoiceNumber: string,
  options?: {
    invoiceDate?: string | Date | null;
    mode?: PeriodMode;
    fallbackToMonthEndOnEmpty?: boolean; // default: true
  }
): WorklogGeneratePayload | null {
  const allRows = toWorklogRows(env);
  if (!allRows.length) return null;

  const companyId = env?.company?.id ?? null;
  const mode = options?.mode ?? "calendar-month";
  const fallback = options?.fallbackToMonthEndOnEmpty ?? true;

  // Normalize null -> undefined
  const endDate: string | Date | undefined = options?.invoiceDate ?? undefined;

  // 1) Primary period
  let period = derivePeriod(allRows, mode, { endDate });

  // 2) Filter rows into that period (if we have bounds)
  let rows =
    period.from && period.to
      ? filterRowsByPeriod(allRows, period.from, period.to)
      : allRows;

  // 3) Optional fallback: if invoiceDate-based period yields no rows, use full month
  if (!rows.length && endDate && fallback) {
    const d = toDateUTC(endDate);
    const monthFrom = monthStart(d);
    const monthTo = monthEnd(d);

    const altRows = filterRowsByPeriod(allRows, monthFrom, monthTo);
    if (altRows.length) {
      period = { from: monthFrom, to: monthTo };
      rows = altRows;
    }
  }

  if (!rows.length) return null;

  const invoiceId = Number(laborInvoiceNumber);

  return {
    invoiceId,
    invoiceNumber: laborInvoiceNumber,
    customerName: env.company?.name ?? null,
    companyId,
    period,
    rows,
  };
}
