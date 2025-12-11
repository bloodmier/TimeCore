/**
 * Returns the start and end dates (YYYY-MM-DD) for the current month
 * in Europe/Stockholm time. A custom "now" date can be passed for testing.
 */
export const getThisMonthRangeYMD = (now = new Date()) => {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0..11

  const start = new Date(y, m, 1);         // first day of the month
  const end = new Date(y, m + 1, 0);       // last day of the month

  const toYMD = (d) => d.toISOString().slice(0, 10);

  return { start: toYMD(start), end: toYMD(end) };
};

/**
 * Converts a Date object into a YYYY-MM-DD string (local time).
 * Defaults to today's date if no argument is provided.
 */
export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/**
 * Adds (or subtracts) a number of days to a YYYY-MM-DD date string.
 * Returns the resulting date in the same format, or the original input
 * if the date is invalid.
 */
export function addDaysYMD(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Normalizes various truthy/falsey inputs into boolean-like values.
 * Returns 1 for true-values ("true", "yes", "1"), 0 for false-values
 * ("false", "no", "0"), and undefined for empty or unrecognized values.
 */
export const toBoolOrUndefined = (v)  => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return 1;
  if (s === "0" || s === "false" || s === "no") return 0;
  return undefined; 
};

/**
 * Converts any valid date input into a local YYYY-MM-DD string.
 * Returns null if the input cannot be parsed as a valid date.
 */
export const toYMDLocal = (dateInput) => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
