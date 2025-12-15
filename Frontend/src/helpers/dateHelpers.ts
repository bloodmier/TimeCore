export const fromYMD = (s?: string) => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
export const toYMD = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};


export const toYMD_UTC = (d: Date) => d.toISOString().slice(0, 10);

export const toHoursString = (v: number | null | undefined) => {
  if (v == null) return "";
  return v % 1 === 0 ? String(v) : v.toFixed(2);
};

export const todayLocal = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};


export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth   = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const startOfYear  = (d: Date) => new Date(d.getFullYear(), 0, 1);
export const endOfYear    = (d: Date) => new Date(d.getFullYear(), 11, 31);

/** Month range by offset relative to current month (0=this, -1=last, +1=next) */
export const getMonthRange = (offset = 0) => {
  const now = todayLocal();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const s = new Date(y, m, 1);
  const e = new Date(y, m + 1, 0);      // inclusive
  const eExclusive = new Date(y, m + 1, 1);
  return { from: toYMD(s), to: toYMD(e), toExclusive: toYMD(eExclusive) };
};

export const getThisMonthRange = () => getMonthRange(0);
export const getLastMonthRange = () => getMonthRange(-1);

/** Quarter-to-date (local) */
export const getQuarterToDate = () => {
  const now = todayLocal();
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const s = new Date(now.getFullYear(), qStartMonth, 1);
  return { from: toYMD(s), to: toYMD(now) };
};

/** Year-to-date (local) */
export const getYearToDate = () => {
  const now = todayLocal();
  return { from: toYMD(startOfYear(now)), to: toYMD(now) };
};

/** Full this year (1 Jan → 31 Dec) */
export const getThisYearFull = () => {
  const now = todayLocal();
  return { from: toYMD(startOfYear(now)), to: toYMD(endOfYear(now)) };
};

/** Full last year (1 Jan → 31 Dec) */
export const getLastYearFull = () => {
  const now = todayLocal();
  const y = now.getFullYear() - 1;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
};

/** Rolling last N days (inclusive end=today) */
export const getLastNDays = (n: number) => {
  const end = todayLocal();
  const start = addDays(end, -(n - 1));
  return { from: toYMD(start), to: toYMD(end) };
};

/** Rolling last N months (start at 1st of month N-1 back, end=today) */
export const getLastNMonthsRolling = (n: number) => {
  const end = todayLocal();
  const start = new Date(end.getFullYear(), end.getMonth() - (n - 1), 1);
  return { from: toYMD(start), to: toYMD(end) };
};

export function toHoursSum(
  lines: Array<{ qty: number; unit: string }>
) {
  return lines.reduce((sum, l) => sum + (l.unit === "h" ? Number(l.qty || 0) : 0), 0);
}

export const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const getLastDayOfCurrentMonth = () => {
  const now = new Date();
  return toYMD(endOfMonth(now));
};