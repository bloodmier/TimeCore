import { db } from "../config/db.js";
import {
  getThisMonthRangeYMD,
  addDaysYMD,
  toBoolOrUndefined,
  toYMDLocal,
} from "../utils/dateRange.js";

/**
 * Safely convert a value to a number.
 *
 * Purpose:
 * - Normalizes numeric query/body values.
 * - Prevents NaN and Infinity from leaking into SQL parameters.
 *
 * Behaviour:
 * - Returns a finite number if conversion succeeds.
 * - Returns undefined if the value is not a valid number.
 *
 * Examples:
 * - toNum("42")       -> 42
 * - toNum(10)         -> 10
 * - toNum("abc")      -> undefined
 * - toNum(undefined)  -> undefined
 */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Convert a value to a SQL-friendly boolean (0 or 1).
 *
 * Purpose:
 * - Parses flexible boolean inputs from query parameters.
 * - Used when filtering boolean columns in SQL (e.g. billed, billable).
 *
 * Accepted truthy values:
 * - "1", "true", "yes"
 *
 * Accepted falsy values:
 * - "0", "false", "no"
 *
 * Behaviour:
 * - Returns 1 or 0 when a valid boolean value is detected.
 * - Returns undefined if the value is empty or invalid.
 *
 * Examples:
 * - toBool01("true")  -> 1
 * - toBool01("0")     -> 0
 * - toBool01("")      -> undefined
 */
const toBool01 = (v) => {
  if (v === undefined || v === null || v === "") return undefined;

  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes"].includes(s)) return 1;
  if (["0", "false", "no"].includes(s)) return 0;

  return undefined;
};

/**
 * Check whether a query flag is explicitly enabled.
 *
 * Purpose:
 * - Used for feature-toggle style query parameters.
 * - Ensures flags must be explicitly set to "1" to be true.
 *
 * Behaviour:
 * - Returns true only if the value equals "1".
 * - Returns false for all other values.
 *
 * Examples:
 * - hasFlag("1")   -> true
 * - hasFlag("0")   -> false
 * - hasFlag(null)  -> false
 */
const hasFlag = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase() === "1";

/**
 * Convert a value into an array of numbers.
 *
 * Purpose:
 * - Normalizes list-based query parameters for SQL IN (...) clauses.
 * - Supports both comma-separated strings and arrays.
 *
 * Behaviour:
 * - Returns an array of finite numbers.
 * - Filters out invalid or non-numeric values.
 * - Returns undefined if no valid numbers are found.
 *
 * Examples:
 * - toArrayNum("1,2,3")      -> [1, 2, 3]
 * - toArrayNum([1, "2"])     -> [1, 2]
 * - toArrayNum("abc,1")      -> [1]
 * - toArrayNum(undefined)    -> undefined
 */
const toArrayNum = (v) => {
  if (!v) return undefined;

  if (Array.isArray(v)) {
    return v.map(Number).filter(Number.isFinite);
  }

  if (typeof v === "string") {
    return v.split(",").map(Number).filter(Number.isFinite);
  }

  return undefined;
};


/**
 * Get a paginated list of time report entries for the admin overview.
 *
 * Purpose:
 * - Returns time_report rows for the authenticated tenant (tenant-scoped).
 * - Supports filtering by date range, billed status, user(s), and free-text search.
 * - Supports cursor-based pagination (newest -> oldest).
 * - Supports a special ID lookup mode via query (e.g. "#123" or "id:123") to fetch a single entry with its items.
 *
 * Security:
 * - Requires authentication via HttpOnly cookie (tc_access) and must run AFTER requireAuth.
 * - Tenant isolation is enforced by joining the `users` table and filtering on u.tenant_id.
 * - Admin access should be enforced at route/mount level (requireRole("admin")).
 *
 * Query parameters (optional):
 * - start (YYYY-MM-DD): Start date (inclusive). Defaults to current month start.
 * - end   (YYYY-MM-DD): End date (inclusive). Defaults to current month end.
 * - billed (boolean-ish): Filter billed state (true/false/1/0). Uses toBoolOrUndefined().
 * - userId (number): Filter by a single user id.
 * - userIds (string): Comma-separated list of user ids (e.g. "1,2,3").
 * - q (string): Search token. Supports:
 *   - "#123" / "id:123" -> fetch exactly that time report id
 *   - date keywords: "today"/"idag", "yesterday"/"igår", "last 24h"
 *   - yyyy-mm-dd, yyyy-mm, yyyy, dd/mm/yyyy, yyyy/mm/dd, date ranges
 *   - free text: matches customer, project, category, work text, note, or date string
 * - limit (number): Page size (max 200, default 50)
 * - cursor (string): Base64url encoded cursor from previous response { ymd, id }
 *
 * Response:
 * - 200 JSON:
 *   {
 *     items: TimeReport[],
 *     nextCursor?: string
 *   }
 * - Each TimeReport includes an `items` array (rows from time_report_item).
 */
export const getAdminTimeReports = async (req, res) => {
  const conn = await db.getConnection();

  /**
   * Encode a cursor object into a base64url string.
   * Used for cursor-based pagination (stable ordering by date + id).
   */
  const encodeCursor = (o) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");

  /**
   * Decode a base64url cursor string back into an object.
   * Returns null if decoding/parsing fails.
   */
  const decodeCursor = (s) => {
    if (!s) return null;
    try {
      return JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  };

  try {
    // -------------------------------------------------------------------------
    // Date parsing helpers
    // -------------------------------------------------------------------------

    /**
     * Parse slash-based date formats and normalize to YYYY-MM-DD.
     * Supported:
     * - dd/mm/yyyy
     * - yyyy/mm/dd
     *
     * Returns:
     * - "YYYY-MM-DD" if valid
     * - null if invalid
     */
    function parseSlashDateToYMD(s) {
      // dd/mm/yyyy
      let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const dd = Number(m[1]),
          mm = Number(m[2]),
          yyyy = Number(m[3]);

        const d = new Date(yyyy, mm - 1, dd);

        const y = d.getFullYear(),
          mo = String(d.getMonth() + 1).padStart(2, "0"),
          da = String(d.getDate()).padStart(2, "0");

        if (!Number.isNaN(d.getTime())) return `${y}-${mo}-${da}`;
      }

      // yyyy/mm/dd
      m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (m) {
        const yyyy = Number(m[1]),
          mm = Number(m[2]),
          dd = Number(m[3]);

        const d = new Date(yyyy, mm - 1, dd);

        const y = d.getFullYear(),
          mo = String(d.getMonth() + 1).padStart(2, "0"),
          da = String(d.getDate()).padStart(2, "0");

        if (!Number.isNaN(d.getTime())) return `${y}-${mo}-${da}`;
      }

      return null;
    }

    /**
     * Given a year and month, returns the next year/month pair.
     * Used when parsing YYYY-MM month tokens to compute endExclusive.
     */
    function nextYearMonth(y, m) {
      return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
    }

    /**
     * Convert a JS Date into a MySQL DATETIME string (local time).
     * Format: YYYY-MM-DD HH:mm:ss
     *
     * Note:
     * - This is used for "last 24h" where start/end are DATETIME values.
     */
    function toMySQLDateTimeLocal(d) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    /**
     * Parses special date tokens from the q parameter.
     *
     * Supported tokens:
     * - "today"/"idag"
     * - "yesterday"/"igår"/"igar"
     * - "last 24h"/"24h"/"senaste dygnet"
     * - Exact dates: YYYY-MM-DD
     * - Slash dates: dd/mm/yyyy or yyyy/mm/dd
     * - Month: YYYY-MM (returns start=1st and endExclusive=next month 1st)
     * - Year: YYYY (returns Jan 1st to Jan 1st next year)
     * - Range: "YYYY-MM-DD .. YYYY-MM-DD" (.., ..., "to", "-")
     *
     * Returns:
     * - { start, endExclusive } if token recognized
     * - null if no token match
     */
    function parseDateQueryToken(qRaw) {
      const q = (qRaw || "").trim().toLowerCase();
      if (!q) return null;

      // Keywords (local date)
      if (q === "idag" || q === "today") {
        const d = new Date();
        const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
        return { start: s, endExclusive: addDaysYMD(s, 1) };
      }

      if (
        q === "igår" ||
        q === "igar" ||
        q === "yesterday" ||
        q === "last day" ||
        q === "sista dagen" ||
        q === "senaste dagen"
      ) {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
        return { start: s, endExclusive: addDaysYMD(s, 1) };
      }

      // DATETIME range: last 24 hours
      if (q === "last 24h" || q === "24h" || q === "senaste dygnet") {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        return {
          start: toMySQLDateTimeLocal(start),
          endExclusive: toMySQLDateTimeLocal(end),
        };
      }

      // Exact date: YYYY-MM-DD
      let m = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const s = `${m[1]}-${m[2]}-${m[3]}`;
        return { start: s, endExclusive: addDaysYMD(s, 1) };
      }

      // Slash dates
      const sDate = parseSlashDateToYMD(q);
      if (sDate) return { start: sDate, endExclusive: addDaysYMD(sDate, 1) };

      // Month: YYYY-MM
      m = q.match(/^(\d{4})-(\d{2})$/);
      if (m) {
        const y = Number(m[1]),
          mon = Number(m[2]);
        const start = `${m[1]}-${m[2]}-01`;
        const { y: yn, m: mn } = nextYearMonth(y, mon);
        const endExclusive = `${String(yn).padStart(4, "0")}-${String(mn).padStart(2, "0")}-01`;
        return { start, endExclusive };
      }

      // Year: YYYY
      m = q.match(/^(\d{4})$/);
      if (m) {
        const y = Number(m[1]);
        return { start: `${y}-01-01`, endExclusive: `${y + 1}-01-01` };
      }

      // Range: YYYY-MM-DD .. YYYY-MM-DD
      m = q.match(
        /^(\d{4}-\d{2}-\d{2})\s*(?:\.{2,3}|to|-)\s*(\d{4}-\d{2}-\d{2})$/
      );
      if (m) {
        const a = m[1],
          b = m[2];
        const lo = a < b ? a : b;
        const hi = a < b ? b : a;
        return { start: lo, endExclusive: addDaysYMD(hi, 1) };
      }

      return null;
    }

    // -------------------------------------------------------------------------
    // Auth context (cookie/JWT)
    // -------------------------------------------------------------------------
    const tenantId = req.user?.tenantId ?? null;
    const adminUserId = req.user?.id ?? null; // from cookie/JWT (useful for audit/logging if needed)

    if (tenantId == null) {
      return res.status(403).json({ error: "Forbidden (no tenant bound)" });
    }

    // NOTE:
    // This endpoint is tenant-scoped and does not need adminUserId for filtering.
    // However, we validate that req.user.id exists to ensure JWT payload is correct.
    if (adminUserId == null) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // -------------------------------------------------------------------------
    // Default date range = current month
    // -------------------------------------------------------------------------
    const { start: defStart, end: defEnd } = getThisMonthRangeYMD();
    let start = String(req.query.start ?? defStart).slice(0, 10);
    let end = String(req.query.end ?? defEnd).slice(0, 10);
    let endExclusive = addDaysYMD(end, 1);

    // -------------------------------------------------------------------------
    // Filters
    // -------------------------------------------------------------------------
    const billed = toBoolOrUndefined(req.query.billed);

    const qRaw = (req.query.q ?? "").toString().trim();
    const qUserId = req.query.userId ? Number(req.query.userId) : undefined;
    const qUserIds =
      typeof req.query.userIds === "string"
        ? req.query.userIds.split(",").map(Number).filter(Number.isFinite)
        : undefined;

    // If q contains a recognized date token, it overrides start/endExclusive
    const dateToken = parseDateQueryToken(qRaw);
    const q = dateToken ? "" : qRaw;
    if (dateToken) {
      start = dateToken.start;
      endExclusive = dateToken.endExclusive;
    }

    // -------------------------------------------------------------------------
    // Pagination
    // -------------------------------------------------------------------------
    const limitRaw = Number(req.query.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

    const cursorRaw = req.query.cursor ? String(req.query.cursor) : undefined;
    const cursor = decodeCursor(cursorRaw); // { ymd: 'YYYY-MM-DD', id: number } | null

    // -------------------------------------------------------------------------
    // Special case: ID search (#123 / id:123)
    // Returns a single report (if in tenant) with items
    // -------------------------------------------------------------------------
    const idMatch = q.match(/^#(\d+)$/) || q.match(/^id\s*:\s*(\d+)$/i);
    if (idMatch) {
      const id = Number(idMatch[1]);

      const headSqlById = `
        SELECT
          tr.id,
          tr.\`user\` AS userId,
          DATE_FORMAT(tr.date,'%Y-%m-%d') AS dateUTC,
          DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') AS dateLocal,
          tr.customer_id AS customerId,
          tr.project_id  AS projectId,
          tr.category    AS categoryId,
          c.company      AS customerName,
          p.projectname  AS projectName,
          cat.name       AS category,
          (tr.hours + 0) AS hours,
          (tr.billable = 1) AS billable,
          tr.billed      AS billed,
          tr.work_labor  AS workDescription,
          tr.note        AS note
        FROM time_report tr
        LEFT JOIN customer               c   ON c.id  = tr.customer_id
        LEFT JOIN project                p   ON p.id  = tr.project_id
        LEFT JOIN time_report_categories cat ON cat.id = tr.category
        JOIN users                       u   ON u.id  = tr.\`user\`   -- tenant isolation
        WHERE tr.id = ? AND u.\`tenant_id\` = ?
        LIMIT 1
      `;
      const [oneRows] = await conn.query(headSqlById, [id, tenantId]);

      if (!oneRows?.length) {
        return res.json({ items: [], nextCursor: undefined });
      }

      const r = oneRows[0];
      const item = {
        id: Number(r.id),
        userId: Number(r.userId),
        date: String(r.dateLocal),
        customerId: r.customerId != null ? Number(r.customerId) : null,
        projectId: r.projectId != null ? Number(r.projectId) : null,
        categoryId: r.categoryId != null ? Number(r.categoryId) : null,
        customerName: r.customerName ?? null,
        projectName: r.projectName ?? null,
        category: r.category ?? null,
        hours: Number(r.hours) || 0,
        billable: !!r.billable,
        billed: r.billed === 1,
        workDescription: r.workDescription ?? null,
        note: r.note ?? null,
        items: [],
        _cursorYmd: r.dateUTC, // used for pagination cursor if needed
      };

      // Load item rows for this single time report
      const [itemRowsById] = await conn.query(
        `
          SELECT tri.id, tri.time_report_id AS timeReportId, tri.article_id AS articleId, tri.amount, tri.description
          FROM time_report_item tri
          WHERE tri.time_report_id = ?
          ORDER BY tri.id ASC
        `,
        [item.id]
      );

      item.items = (itemRowsById ?? []).map((it) => ({
        id: Number(it.id),
        timeReportId: Number(it.timeReportId),
        articleId: it.articleId != null ? Number(it.articleId) : null,
        amount: it.amount != null ? Number(it.amount) : null,
        description: it.description ?? "",
      }));

      return res.json({ items: [item], nextCursor: undefined });
    }

    // -------------------------------------------------------------------------
    // Normal listing mode with cursor-based pagination (newest -> oldest)
    // -------------------------------------------------------------------------
    const where = ["tr.`date` >= ?", "tr.`date` < ?", "u.`tenant_id` = ?"];
    const params = [start, endExclusive, tenantId];

    // Filter by specific users (within the tenant)
    if (typeof qUserId === "number" && Number.isFinite(qUserId)) {
      where.push("tr.`user` = ?");
      params.push(qUserId);
    } else if (qUserIds?.length) {
      where.push("tr.`user` IN (?)");
      params.push(qUserIds);
    }

    // Filter billed status
    if (billed !== undefined) {
      where.push("tr.`billed` = ?");
      params.push(billed);
    }

    // Search behaviour:
    // - Exact local date (YYYY-MM-DD) matches report date in Europe/Stockholm
    // - Day-only (e.g. "15") matches day-of-month in Europe/Stockholm
    // - Otherwise uses LIKE across common fields
    const ymdMatch = q && q.match(/^\d{4}-\d{2}-\d{2}$/);
    const dayOnly = q && q.match(/^\d{1,2}$/);

    if (ymdMatch) {
      where.push(
        `DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') = ?`
      );
      params.push(q);
    } else if (dayOnly) {
      where.push(`DAY(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm')) = ?`);
      params.push(Number(q));
    } else if (q) {
      const like = `%${q}%`;
      where.push(`(
        c.company LIKE ? OR
        p.projectname LIKE ? OR
        cat.name LIKE ? OR
        tr.work_labor LIKE ? OR
        tr.note LIKE ? OR
        DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') LIKE ?
      )`);
      params.push(like, like, like, like, like, like);
    }

    // Cursor predicate:
    // Fetch rows older than the cursor point (because we sort newest -> oldest)
    if (cursor?.ymd && typeof cursor.id === "number") {
      where.push("(DATE(tr.date) < ? OR (DATE(tr.date) = ? AND tr.id < ?))");
      params.push(cursor.ymd, cursor.ymd, cursor.id);
    }

    const headSql = `
      SELECT
        tr.id,
        tr.\`user\` AS userId,
        DATE_FORMAT(tr.date,'%Y-%m-%d') AS dateUTC,
        DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') AS dateLocal,
        tr.customer_id AS customerId,
        tr.project_id  AS projectId,
        tr.category    AS categoryId,
        c.company      AS customerName,
        p.projectname  AS projectName,
        cat.name       AS category,
        (tr.hours + 0) AS hours,
        (tr.billable = 1) AS billable,
        tr.billed      AS billed,
        tr.work_labor  AS workDescription,
        tr.note        AS note
      FROM time_report tr
      LEFT JOIN customer               c   ON c.id  = tr.customer_id
      LEFT JOIN project                p   ON p.id  = tr.project_id
      LEFT JOIN time_report_categories cat ON cat.id = tr.category
      JOIN users                       u   ON u.id  = tr.\`user\`   -- tenant isolation
      WHERE ${where.join(" AND ")}
      ORDER BY tr.date DESC, tr.id DESC
      LIMIT ?
    `;

    // Read one extra row to detect "hasNext"
    const [rows] = await conn.query(headSql, [...params, limit + 1]);

    const hasNext = Array.isArray(rows) && rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;

    if (!pageRows?.length) {
      return res.json({ items: [], nextCursor: undefined });
    }

    // Map DB rows to API shape
    const items = pageRows.map((r) => ({
      id: Number(r.id),
      userId: Number(r.userId),
      date: String(r.dateLocal),
      customerId: r.customerId != null ? Number(r.customerId) : null,
      projectId: r.projectId != null ? Number(r.projectId) : null,
      categoryId: r.categoryId != null ? Number(r.categoryId) : null,
      customerName: r.customerName ?? null,
      projectName: r.projectName ?? null,
      category: r.category ?? null,
      hours: Number(r.hours) || 0,
      billable: !!r.billable,
      billed: r.billed === 1,
      workDescription: r.workDescription ?? null,
      note: r.note ?? null,
      items: [],
      _cursorYmd: r.dateUTC, // used to create nextCursor
    }));

    // Load all item rows for the returned time reports in one query
    const ids = items.map((r) => r.id);

    if (ids.length) {
      const [itemRows] = await conn.query(
        `
          SELECT tri.id, tri.time_report_id AS timeReportId, tri.article_id AS articleId, tri.amount, tri.description
          FROM time_report_item tri
          WHERE tri.time_report_id IN (?)
          ORDER BY tri.time_report_id ASC, tri.id ASC
        `,
        [ids]
      );

      // Group items by time report id
      const byReport = new Map();
      for (const it of itemRows ?? []) {
        const k = Number(it.timeReportId);
        const arr = byReport.get(k) ?? [];
        arr.push({
          id: Number(it.id),
          timeReportId: k,
          articleId: it.articleId != null ? Number(it.articleId) : null,
          amount: it.amount != null ? Number(it.amount) : null,
          description: it.description ?? "",
        });
        byReport.set(k, arr);
      }

      // Attach items to each report
      for (const r of items) r.items = byReport.get(r.id) ?? [];
    }

    // Next cursor points to the last row of the current page (oldest in this batch)
    const last = pageRows[pageRows.length - 1];
    const nextCursor = hasNext
      ? encodeCursor({ ymd: last.dateUTC, id: Number(last.id) })
      : undefined;

    return res.json({ items, nextCursor });
  } catch (err) {
    console.error("Error in getAdminTimeReports:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
};


/**
 * Get aggregated summary metrics for time reports in the admin overview.
 *
 * Purpose:
 * - Calculates total hours, billable vs non-billable hours, and reported day count
 *   for the authenticated tenant (tenant-scoped).
 * - Also calculates special buckets for "vacation" and "sick" hours based on either
 *   the work description or the category name.
 *
 * Security:
 * - Requires authentication via HttpOnly cookie (tc_access) and must run AFTER requireAuth.
 * - Tenant isolation is enforced by joining `users` and filtering on u.tenant_id.
 * - Admin access should be enforced at route/mount level (requireRole("admin")).
 *
 * Query parameters (optional):
 * - start (YYYY-MM-DD): Start date (inclusive). Defaults to current month start.
 * - end   (YYYY-MM-DD): End date (inclusive). Defaults to current month end.
 * - billed (boolean-ish): Filters billed state (true/false/1/0). Uses toBoolOrUndefined().
 * - userId (number): Filter by a single user id.
 * - userIds (string): Comma-separated list of user ids (e.g. "1,2,3").
 * - q (string): Search text or exact date:
 *   - If q is YYYY-MM-DD: filters on local date (Europe/Stockholm)
 *   - Otherwise: LIKE search across customer/project/category/work/note/date
 *
 * Response (200):
 * {
 *   totalHours: number,
 *   billableHours: number,
 *   nonBillableHours: number,
 *   amount: number,        // placeholder for future monetary calculations
 *   daysReported: number,  // distinct local dates with at least one report
 *   vacationHours: number,
 *   sickHours: number
 * }
 */
export const getAdminTimeReportsSummary = async (req, res) => {
  const conn = await db.getConnection();

  try {
    // -------------------------------------------------------------------------
    // Auth context (cookie/JWT)
    // -------------------------------------------------------------------------
    const tenantId = req.user?.tenantId ?? null;
    const adminUserId = req.user?.id ?? null; // from cookie/JWT (useful for audit/logging if needed)

    if (tenantId == null) {
      return res.status(403).json({ error: "Forbidden (no tenant bound)" });
    }

    // Ensure req.user is properly populated by requireAuth (cookie-based JWT).
    if (adminUserId == null) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // -------------------------------------------------------------------------
    // Date range (defaults to current month)
    // -------------------------------------------------------------------------
    const { start: defStart, end: defEnd } = getThisMonthRangeYMD();
    const start = String(req.query.start ?? defStart).slice(0, 10);
    const end = String(req.query.end ?? defEnd).slice(0, 10);

    // endExclusive is used to make date filtering inclusive on "end"
    // by using: date >= start AND date < endExclusive
    const endExclusive = addDaysYMD(end, 1);

    // -------------------------------------------------------------------------
    // Filters
    // -------------------------------------------------------------------------
    const billed = toBoolOrUndefined(req.query.billed);
    const q = (req.query.q ?? "").toString().trim();

    const qUserId = req.query.userId ? Number(req.query.userId) : undefined;

    // userIds is an optional comma-separated list: "1,2,3"
    let qUserIds;
    if (typeof req.query.userIds === "string") {
      qUserIds = req.query.userIds
        .split(",")
        .map(Number)
        .filter((n) => Number.isFinite(n));
    }

    // -------------------------------------------------------------------------
    // Build tenant-scoped WHERE clause (safe parameterized SQL)
    // -------------------------------------------------------------------------
    const where = ["tr.`date` >= ?", "tr.`date` < ?", "u.`tenant_id` = ?"];
    const params = [start, endExclusive, tenantId];

    // Filter on a single user or a list of users
    if (typeof qUserId === "number" && Number.isFinite(qUserId)) {
      where.push("tr.`user` = ?");
      params.push(qUserId);
    } else if (qUserIds && qUserIds.length) {
      where.push("tr.`user` IN (?)");
      params.push(qUserIds);
    }

    // Filter on billed state
    if (billed !== undefined) {
      where.push("tr.`billed` = ?");
      params.push(billed);
    }

    // Search behaviour:
    // - Exact local date: if q = YYYY-MM-DD, match the report date in Europe/Stockholm
    // - Otherwise: LIKE search across common text fields
    const ymdMatch = q && q.match(/^\d{4}-\d{2}-\d{2}$/);
    if (ymdMatch) {
      where.push(
        `DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') = ?`
      );
      params.push(q);
    } else if (q) {
      const like = `%${q}%`;
      where.push(`(
        c.company LIKE ? OR
        p.projectname LIKE ? OR
        cat.name LIKE ? OR
        tr.work_labor LIKE ? OR
        tr.note LIKE ? OR
        DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') LIKE ?
      )`);
      params.push(like, like, like, like, like, like);
    }

    // -------------------------------------------------------------------------
    // Aggregation query
    // -------------------------------------------------------------------------
    const sql = `
      SELECT
        -- Total hours in the result set
        SUM(tr.hours + 0) AS totalHours,

        -- Billable hours (tr.billable = 1)
        SUM(
          CASE WHEN tr.billable = 1
            THEN (tr.hours + 0)
            ELSE 0
          END
        ) AS billableHours,

        -- Number of distinct reported days (local date in Europe/Stockholm)
        COUNT(
          DISTINCT DATE(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'))
        ) AS daysReported,

        -- Vacation hours:
        -- counted if work description is 'vacation' OR category name is 'vacation'
        SUM(
          CASE
            WHEN LOWER(tr.work_labor) = 'vacation'
              OR LOWER(cat.name) = 'vacation'
            THEN (tr.hours + 0)
            ELSE 0
          END
        ) AS vacationHours,

        -- Sick hours:
        -- counted if work description is 'sick' OR category name is 'sick'
        SUM(
          CASE
            WHEN LOWER(tr.work_labor) = 'sick'
              OR LOWER(cat.name) = 'sick'
            THEN (tr.hours + 0)
            ELSE 0
          END
        ) AS sickHours

      FROM time_report tr
      LEFT JOIN customer               c   ON c.id  = tr.customer_id
      LEFT JOIN project                p   ON p.id  = tr.project_id
      LEFT JOIN time_report_categories cat ON cat.id = tr.category
      JOIN users                       u   ON u.id  = tr.\`user\`
      WHERE ${where.join(" AND ")}
    `;

    const [rows] = await conn.query(sql, params);
    const agg = rows?.[0] ?? {};

    // -------------------------------------------------------------------------
    // Normalize output types and compute derived metrics
    // -------------------------------------------------------------------------
    const totalHours = Number(agg.totalHours ?? 0);
    const billableHours = Number(agg.billableHours ?? 0);
    const nonBillableHours = totalHours - billableHours;

    const vacationHours = Number(agg.vacationHours ?? 0);
    const sickHours = Number(agg.sickHours ?? 0);

    // Placeholder until monetary calculations are implemented
    const amount = 0;

    return res.json({
      totalHours: Number(totalHours.toFixed(2)),
      billableHours: Number(billableHours.toFixed(2)),
      nonBillableHours: Number(nonBillableHours.toFixed(2)),
      amount: Number(amount.toFixed(2)),
      daysReported: Number(agg.daysReported ?? 0),
      vacationHours: Number(vacationHours.toFixed(2)),
      sickHours: Number(sickHours.toFixed(2)),
    });
  } catch (err) {
    console.error("getAdminTimeReportsSummary error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
};


/**
 * Update a single time report entry (admin).
 *
 * Purpose:
 * - Partially updates a `time_report` row within the authenticated tenant.
 * - Optionally updates, inserts, or deletes related `time_report_item` rows.
 *
 * Security:
 * - Requires authentication via HttpOnly cookie (tc_access) and must run AFTER requireAuth.
 * - Admin access should be enforced at route/mount level (requireRole("admin")).
 * - Tenant isolation is enforced before any update happens by verifying the report belongs to the tenant.
 * - Supports an optional "superadmin" bypass if your JWT includes roles[] (legacy support).
 *
 * Path parameters:
 * - id (number): Time report id.
 *
 * Input (req.body, optional fields):
 * - customerId
 * - categoryId
 * - projectId
 * - date (YYYY-MM-DD)
 * - hours (number)
 * - note (string|null)
 * - workDescription (string|null)
 * - billable (boolean)
 * - billed (boolean)
 * - items:
 *   - delete: number[]   -> item ids to delete
 *   - upsert: object[]   -> items to update or insert
 *
 * Behaviour:
 * - Builds a dynamic UPDATE statement (only provided fields are changed).
 * - Runs all operations in a transaction.
 * - Enforces tenant ownership (unless superadmin).
 * - Supports item-level delete and upsert in the same request.
 * - Updates the `modified` column for auditing.
 *
 * Response:
 * - Returns the updated time report with enriched fields
 *   (customer/project/category names, and full items list).
 */
export const adminUpdateTimereport = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  // -------------------------------------------------------------------------
  // Auth context (cookie/JWT)
  // -------------------------------------------------------------------------
  const tenantId = req.user?.tenantId ?? null;
  const adminUserId = req.user?.id ?? null; // <-- this comes from cookie/JWT (req.user.id)

  // Ensure req.user is properly set by requireAuth (cookie-based JWT).
  if (adminUserId == null) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // NOTE:
  // Your current requireAuth sets req.user.role (string), not req.user.roles (array).
  // We keep this legacy support in case some tokens include roles[] (e.g. superadmin).
  const roles = (req.user?.roles ?? []).map((r) => String(r).toLowerCase());
  const isSuperAdmin = roles.includes("superadmin");

  /**
   * Helper: checks if a value is defined (not null and not undefined).
   * Used to build "partial update" statements safely.
   */
  const isDef = (v) => v !== undefined && v !== null;

  /**
   * Helper: ensures a value is always a string (never null/undefined).
   * Useful when writing to VARCHAR/TEXT fields where you want "" instead of null.
   */
  const toNonNullStr = (v, fallback = "") =>
    v === null || v === undefined ? fallback : String(v);

  // -------------------------------------------------------------------------
  // Input (partial updates)
  // -------------------------------------------------------------------------
  const body = req.body || {};
  const {
    customerId,
    categoryId,
    date,
    hours,
    note,
    workDescription,
    billable,
    projectId,
    billed,
    items,
  } = body;

  // -------------------------------------------------------------------------
  // Build dynamic UPDATE query for the main time_report row
  // (only fields that exist in req.body will be updated)
  // -------------------------------------------------------------------------
  const mainSets = [];
  const mainParams = [];

  if (isDef(customerId)) {
    mainSets.push("`customer_id` = ?");
    mainParams.push(customerId);
  }
  if (isDef(categoryId)) {
    mainSets.push("`category` = ?");
    mainParams.push(categoryId);
  }
  if (isDef(date)) {
    mainSets.push("`date` = ?");
    mainParams.push(String(date).slice(0, 10));
  }
  if (isDef(hours)) {
    mainSets.push("`hours` = ?");
    mainParams.push(hours);
  }
  if (isDef(note)) {
    mainSets.push("`note` = ?");
    mainParams.push(toNonNullStr(note));
  }
  if (isDef(workDescription)) {
    mainSets.push("`work_labor` = ?");
    mainParams.push(toNonNullStr(workDescription));
  }
  if (isDef(billable)) {
    mainSets.push("`billable` = ?");
    mainParams.push(!!billable ? 1 : 0);
  }
  if (isDef(projectId)) {
    mainSets.push("`project_id` = ?");
    mainParams.push(projectId);
  }
  if (isDef(billed)) {
    mainSets.push("`billed` = ?");
    mainParams.push(!!billed ? 1 : 0);
  }

  // Always update modified date for auditing
  mainSets.push("`modified` = CURRENT_TIMESTAMP");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // -----------------------------------------------------------------------
    // Tenant access check (or superadmin bypass)
    // -----------------------------------------------------------------------
    let canTouch = false;

    if (isSuperAdmin) {
      // Superadmin: only checks existence
      const [chk] = await conn.execute(
        "SELECT id FROM `time_report` WHERE id = ? LIMIT 1",
        [id]
      );
      canTouch = chk && chk.length > 0;
    } else {
      // Normal admin: must be tenant-scoped
      if (tenantId == null) {
        await conn.rollback();
        return res.status(403).json({ error: "Forbidden (no tenant bound)" });
      }

      const [chk] = await conn.execute(
        `SELECT tr.id
         FROM time_report tr
         JOIN users u ON u.id = tr.\`user\`
         WHERE tr.id = ? AND u.tenant_id = ?
         LIMIT 1`,
        [id, tenantId]
      );

      canTouch = chk && chk.length > 0;
    }

    if (!canTouch) {
      await conn.rollback();
      return res.status(404).json({ error: "Time report not found in tenant" });
    }

    // -----------------------------------------------------------------------
    // Update the main time_report row (if we have any fields to update)
    // -----------------------------------------------------------------------
    if (mainSets.length > 0) {
      const sql = `UPDATE \`time_report\` SET ${mainSets.join(", ")} WHERE id = ?`;
      await conn.execute(sql, [...mainParams, id]);
    }

    // -----------------------------------------------------------------------
    // Item operations (delete / upsert)
    // -----------------------------------------------------------------------
    if (items && (Array.isArray(items.delete) || Array.isArray(items.upsert))) {
      // Delete specific item rows
      if (Array.isArray(items.delete) && items.delete.length > 0) {
        const ph = items.delete.map(() => "?").join(", ");
        await conn.execute(
          `DELETE FROM \`time_report_item\`
           WHERE time_report_id = ? AND id IN (${ph})`,
          [id, ...items.delete]
        );
      }

      // Upsert items (update if itemId exists, otherwise insert new)
      if (Array.isArray(items.upsert)) {
        for (const it of items.upsert) {
          const itemId = it.id || it.itemId || null;

          const articleId = isDef(it.articleId) ? it.articleId : null;

          // Accept different field names for quantity/amount
          const amount = isDef(it.amount)
            ? it.amount
            : isDef(it.qty)
            ? it.qty
            : isDef(it.quantity)
            ? it.quantity
            : null;

          const description = toNonNullStr(it.description, "");

          if (itemId) {
            // Update existing item row (only fields provided)
            const setPieces = [];
            const setParams = [];

            if (isDef(articleId)) {
              setPieces.push("`article_id` = ?");
              setParams.push(articleId);
            }
            if (isDef(amount)) {
              setPieces.push("`amount` = ?");
              setParams.push(amount);
            }
            if (it.description !== undefined) {
              setPieces.push("`description` = ?");
              setParams.push(description);
            }

            if (setPieces.length > 0) {
              await conn.execute(
                `UPDATE \`time_report_item\`
                 SET ${setPieces.join(", ")}
                 WHERE id = ? AND time_report_id = ?`,
                [...setParams, itemId, id]
              );
            }
          } else {
            // Insert new item row
            await conn.execute(
              "INSERT INTO `time_report_item` (`time_report_id`, `article_id`, `amount`, `description`) VALUES (?, ?, ?, ?)",
              [id, articleId, amount, description]
            );
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Read back the updated row + related items (enriched response)
    // -----------------------------------------------------------------------
    const [[main]] = await conn.query(
      `
      SELECT
        tr.id,
        tr.\`user\`           AS userId,
        tr.customer_id        AS customerId,
        c.company             AS customerName,
        tr.\`category\`       AS categoryId,
        cat.name              AS categoryName,
        DATE(tr.\`date\`)     AS date,
        tr.\`hours\`          AS hours,
        tr.\`note\`           AS note,
        tr.\`work_labor\`     AS workDescription,
        tr.\`billable\`       AS billable,
        tr.\`project_id\`     AS projectId,
        p.projectname         AS projectName,
        tr.\`billed\`         AS billed,
        DATE(tr.\`modified\`) AS modified,
        DATE(tr.\`created_date\`) AS createdDate
      FROM \`time_report\` tr
      LEFT JOIN \`customer\` c ON c.id = tr.customer_id
      LEFT JOIN \`project\`  p ON p.id = tr.project_id
      LEFT JOIN \`time_report_categories\` cat ON cat.id = tr.\`category\`
      WHERE tr.id = ?
      LIMIT 1
      `,
      [id]
    );

    const [itemRows] = await conn.query(
      `
      SELECT id, time_report_id, article_id, amount, description
      FROM \`time_report_item\`
      WHERE time_report_id = ?
      ORDER BY id ASC
      `,
      [id]
    );

    await conn.commit();

    const payload = {
      id: main.id,
      userId: main.userId,
      customerId: main.customerId,
      customerName: main.customerName ?? "",
      categoryId: main.categoryId,
      categoryName: main.categoryName ?? "",
      date: toYMDLocal(main.date),
      hours: Number(main.hours) || 0,
      note: main.note ?? "",
      workDescription: main.workDescription ?? "",
      billable: !!main.billable,
      projectId: main.projectId,
      projectName: main.projectName ?? "",
      billed: !!main.billed,
      modified: toYMDLocal(main.modified),
      createdDate: toYMDLocal(main.createdDate),
      items: (itemRows ?? []).map((r) => ({
        id: r.id,
        reportId: r.time_report_id,
        articleId: r.article_id,
        amount: r.amount != null ? Number(r.amount) : null,
        description: r.description ?? "",
      })),
    };

    return res.status(200).json(payload);
  } catch (error) {
    // NOTE:
    // This original catch block tried to open+release a new connection, which does not help.
    // We keep behaviour safe: log and return 500. Transaction rollback is handled by finally-release.
    console.error("Error in adminUpdateTimereport:", error);
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    return res.status(500).json({ error: "Couldn't update time report" });
  } finally {
    conn.release();
  }
};

/**
 * Delete a single time report entry (admin).
 *
 * Purpose:
 * - Deletes a `time_report` row (and all its related `time_report_item` rows)
 *   within the authenticated tenant.
 *
 * Security:
 * - Requires authentication via HttpOnly cookie (tc_access) and must run AFTER requireAuth.
 * - Admin access should be enforced at route/mount level (requireRole("admin")).
 * - Tenant isolation is enforced by verifying that the report belongs to a user in the same tenant
 *   before performing the delete.
 *
 * Path parameters:
 * - id (number): Time report id.
 *
 * Behaviour:
 * - Runs inside a transaction:
 *   1) Confirms the report exists and belongs to the current tenant.
 *   2) Deletes all related time_report_item rows.
 *   3) Deletes the time_report row.
 * - Rolls back if the report is not found or any error occurs.
 *
 * Response:
 * - 200: { success: true, deletedId: number }
 * - 404: { error: "Not found (wrong tenant or id)" }
 * - 403: { error: "Forbidden (no tenant bound)" }
 */
export const AdminDeleteTimereportById = async (req, res) => {
  const id = Number(req.params.id);

  // Auth context from cookie/JWT
  const tenantId = req.user?.tenantId ?? null;
  const adminUserId = req.user?.id ?? null; // from cookie/JWT (req.user.id)

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  // Ensure req.user is properly populated by requireAuth
  if (adminUserId == null) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (tenantId == null) {
    return res.status(403).json({ error: "Forbidden (no tenant bound)" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Verify the report exists and is owned by a user within the same tenant
    const [[row]] = await conn.query(
      `
      SELECT tr.id
      FROM time_report tr
      JOIN users u ON u.id = tr.\`user\`
      WHERE tr.id = ? AND u.tenant_id = ?
      LIMIT 1
      `,
      [id, tenantId]
    );

    if (!row) {
      await conn.rollback();
      return res.status(404).json({ error: "Not found (wrong tenant or id)" });
    }

    // Delete children first (FK-safe), then the main row
    await conn.query("DELETE FROM `time_report_item` WHERE time_report_id = ?", [
      id,
    ]);
    await conn.query("DELETE FROM `time_report` WHERE id = ?", [id]);

    await conn.commit();
    return res.status(200).json({ success: true, deletedId: id });
  } catch (e) {
    console.error("Admin delete error:", e);
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    return res.status(400).json({ error: "Bad request, couldn't remove item" });
  } finally {
    conn.release();
  }
};


/**
 * Get all users for the authenticated tenant (admin).
 *
 * Purpose:
 * - Returns all user accounts belonging to the same tenant as the authenticated admin.
 * - Used in admin views for user management, filtering, and reporting.
 *
 * Security:
 * - Requires authentication via HttpOnly cookie (tc_access) and must run AFTER requireAuth.
 * - Admin access should be enforced at route/mount level (requireRole("admin")).
 * - Tenant isolation is enforced by filtering on users.tenant_id.
 *
 * Behaviour:
 * - Reads the tenantId from the verified JWT cookie (req.user.tenantId).
 * - Returns only users belonging to that tenant.
 *
 * Response:
 * - 200: Array of user objects (as stored in the users table).
 * - 403: If no tenant is bound to the authenticated user.
 */
export const getUsers = async (req, res) => { 
  try {
    // Auth context from cookie/JWT
    const tenantId = req.user?.tenantId ?? null;
    const adminUserId = req.user?.id ?? null;

    // Ensure req.user is properly populated by requireAuth
    if (adminUserId == null) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (tenantId == null) {
      return res.status(403).json({ error: "Forbidden (no tenant bound)" });
    }

    const sql = `SELECT * FROM users WHERE tenant_id = ?`;
    const [result] = await db.execute(sql, [tenantId]);

    return res.status(200).json(result);
  } catch (error) {
    console.error("getUsers error:", error);
    return res.status(400).json({ error: "Something went wrong getting users" });
  }
};


/**
 * Get admin statistics for time reports (tenant-scoped).
 *
 * Purpose:
 * - Provides a rich statistics payload for the admin "Time Overview" dashboard:
 *   - Summary totals (rows, total/billable/non-billable hours, active days, vacation/sick).
 *   - Weekly aggregates (ISO weeks) with zero-filled gaps between from..to.
 *   - Aggregates grouped by customer, user, category.
 *   - Article usage statistics (registered + custom).
 *   - Optional: missing days per user in a date window.
 *   - Optional: facets (counts for filter dropdowns).
 *   - Optional: article timecards grouped by customer/time report.
 *
 * Security:
 * - Requires authentication via HttpOnly cookie (tc_access) and must run AFTER requireAuth.
 * - Admin access should be enforced at route/mount level (requireRole("admin")).
 * - Tenant isolation is enforced by joining `users` and filtering u.tenant_id in the base WHERE.
 *
 * Query parameters (high level):
 * - Date window:
 *   - from / start (YYYY-MM-DD): start date (inclusive), defaults to current month start
 *   - to   / end   (YYYY-MM-DD): end date (inclusive), defaults to current month end
 * - Filters:
 *   - billed (0/1/true/false/yes/no)
 *   - billable (0/1/true/false/yes/no)
 *   - q / search (string): text search
 *   - customerId / customerIds
 *   - projectId  / projectIds
 *   - categoryId / categoryIds
 *   - userId     / userIds
 *   - minH / maxH (hours range)
 *   - hasNote (flag "1")
 *   - hasItems (flag "1")
 *   - hasInvoiceNumber (flag "1")
 *   - unbilledOnly (flag "1")
 * - Article filter (optional opt-in):
 *   - articleMode: "registered" | "custom" | "all"
 *   - articleIds: comma-separated ids (registered mode)
 *   - customArticleQuery: string (custom mode)
 * - Search tuning:
 *   - searchFields: comma list "customer,project,category,work,note,date"
 *   - searchMode: "contains" | "prefix" | "exact"
 * - Extra payload toggles:
 *   - includeMissing (0/1)
 *   - missingExcludeWeekends (0/1)
 *   - missingIncludeDates (0/1)
 *   - usersScope: "active" | "tenantAll" | "recent"
 *   - recentDays (number) when usersScope=recent
 *   - includeFacets (0/1)
 *   - includeArticleTimecards (0/1)
 *
 * Response:
 * - 200: JSON object containing summary + series + grouped aggregates (see return res.json below)
 */
export const getAdminTimeReportsStats = async (req, res) => {
  const conn = await db.getConnection();

  try {
    // -------------------------------------------------------------------------
    // Auth context from cookie/JWT
    // -------------------------------------------------------------------------
    const tenantId = req.user?.tenantId ?? null;
    const adminUserId = req.user?.id ?? null; // from cookie/JWT (req.user.id)

    if (adminUserId == null) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (tenantId == null) {
      return res.status(403).json({ error: "Forbidden (no tenant bound)" });
    }

    // -------------------------------------------------------------------------
    // Date window (inclusive end -> exclusive end in SQL)
    // -------------------------------------------------------------------------
    const { start: defStart, end: defEnd } = getThisMonthRangeYMD();
    const fromQ = String(req.query.from ?? req.query.start ?? defStart).slice(
      0,
      10
    );
    const toQ = String(req.query.to ?? req.query.end ?? defEnd).slice(0, 10);
    const toExclusive = addDaysYMD(toQ, 1);

    // -------------------------------------------------------------------------
    // Parse filters
    // -------------------------------------------------------------------------
    const billed = toBool01(req.query.billed);
    const billable = toBool01(req.query.billable);
    const q = (req.query.q ?? req.query.search ?? "").toString().trim();

    const customerId = toNum(req.query.customerId);
    const projectId = toNum(req.query.projectId);
    const categoryId = toNum(req.query.categoryId ?? req.query.category);
    const userId = toNum(req.query.userId);

    const customerIds = toArrayNum(req.query.customerIds);
    const projectIds = toArrayNum(req.query.projectIds);

    // userIds can be provided as list; if not, fall back to single userId if present.
    const userIds =
      toArrayNum(req.query.userIds) ?? (userId != null ? [userId] : undefined);

    const categoryIds = toArrayNum(req.query.categoryIds);

    const minH = toNum(req.query.minH);
    const maxH = toNum(req.query.maxH);

    const hasNote = hasFlag(req.query.hasNote);
    const hasItems = hasFlag(req.query.hasItems);
    const includeFacets = String(req.query.includeFacets ?? "0") === "1";
    const hasInvoiceNumber = hasFlag(req.query.hasInvoiceNumber);
    const unbilledOnly = hasFlag(req.query.unbilledOnly);

    // -------------------------------------------------------------------------
    // Optional article filter (opt-in by presence of these params)
    // -------------------------------------------------------------------------
    let useArticleFilter = false;
    let articleMode = "all"; // "registered" | "custom" | "all"
    let articleIds = [];
    let customArticleQuery = "";

    if (
      req.query.articleMode !== undefined ||
      req.query.articleIds !== undefined ||
      req.query.customArticleQuery !== undefined
    ) {
      useArticleFilter = true;
      const raw = String(req.query.articleMode ?? "all");
      articleMode = raw === "registered" || raw === "custom" ? raw : "all";
      articleIds = toArrayNum(req.query.articleIds) ?? [];
      customArticleQuery = (req.query.customArticleQuery ?? "")
        .toString()
        .trim();
    }

    // -------------------------------------------------------------------------
    // Base WHERE (tenant-scoped) + parameters (parameterized SQL)
    // -------------------------------------------------------------------------
    const where = ["tr.`date` >= ?", "tr.`date` < ?", "u.`tenant_id` = ?"];
    const params = [fromQ, toExclusive, tenantId];

    // Users
    if (userIds?.length) {
      where.push("tr.`user` IN (?)");
      params.push(userIds);
    }

    // Single-value filters
    if (customerId != null) {
      where.push("tr.`customer_id` = ?");
      params.push(customerId);
    }
    if (projectId != null) {
      where.push("tr.`project_id`  = ?");
      params.push(projectId);
    }
    if (categoryId != null) {
      where.push("tr.`category`    = ?");
      params.push(categoryId);
    }

    // Multi-value filters
    if (customerIds?.length) {
      where.push("tr.`customer_id` IN (?)");
      params.push(customerIds);
    }
    if (projectIds?.length) {
      where.push("tr.`project_id`  IN (?)");
      params.push(projectIds);
    }
    if (categoryIds?.length) {
      where.push("tr.`category`    IN (?)");
      params.push(categoryIds);
    }

    // Billable filter
    if (billable !== undefined) {
      where.push("tr.`billable` = ?");
      params.push(billable);
    }

    // Billed filter (supports NULL as "not billed")
    if (billed === 1) where.push("tr.`billed` = 1");
    else if (billed === 0) where.push("(tr.`billed` = 0 OR tr.`billed` IS NULL)");
    if (unbilledOnly) where.push("(tr.`billed` = 0 OR tr.`billed` IS NULL)");

    // Hours range
    if (minH != null) {
      where.push("tr.`hours` >= ?");
      params.push(minH);
    }
    if (maxH != null) {
      where.push("tr.`hours` <= ?");
      params.push(maxH);
    }

    // Content flags
    if (hasNote) where.push("(tr.`note` IS NOT NULL AND tr.`note` <> '')");
    if (hasInvoiceNumber) where.push("tr.`invoice_number` IS NOT NULL");
    if (hasItems) {
      where.push(
        `EXISTS (SELECT 1 FROM time_report_item tri WHERE tri.time_report_id = tr.id LIMIT 1)`
      );
    }

    // Article-based filtering (registered/custom)
    if (useArticleFilter) {
      if (articleMode === "registered") {
        if (articleIds.length > 0) {
          where.push(`
            EXISTS (
              SELECT 1
              FROM time_report_item tri2
              WHERE tri2.time_report_id = tr.id
                AND tri2.article_id <> 1
                AND tri2.article_id IN (?)
              LIMIT 1
            )
          `);
          params.push(articleIds);
        } else {
          where.push(`
            EXISTS (
              SELECT 1
              FROM time_report_item tri2
              WHERE tri2.time_report_id = tr.id
                AND tri2.article_id <> 1
              LIMIT 1
            )
          `);
        }
      } else if (articleMode === "custom") {
        if (customArticleQuery) {
          where.push(`
            EXISTS (
              SELECT 1
              FROM time_report_item tri2
              WHERE tri2.time_report_id = tr.id
                AND tri2.article_id = 1
                AND tri2.description LIKE ?
              LIMIT 1
            )
          `);
          params.push(`%${customArticleQuery}%`);
        } else {
          where.push(`
            EXISTS (
              SELECT 1
              FROM time_report_item tri2
              WHERE tri2.time_report_id = tr.id
                AND tri2.article_id = 1
              LIMIT 1
            )
          `);
        }
      }
    }

    // -------------------------------------------------------------------------
    // Text search (configurable fields + matching mode)
    // -------------------------------------------------------------------------
    const searchFields = String(
      req.query.searchFields ?? "customer,project,category,work,note,date"
    );
    const searchMode = String(req.query.searchMode ?? "contains"); // contains|prefix|exact

    const mkLike = (s) =>
      searchMode === "exact" ? s : searchMode === "prefix" ? `${s}%` : `%${s}%`;

    if (q) {
      const like = mkLike(q);
      const fields = searchFields.split(",").map((s) => s.trim());
      const parts = [];

      if (fields.includes("customer")) parts.push("c.company LIKE ?");
      if (fields.includes("project")) parts.push("p.projectname LIKE ?");
      if (fields.includes("category")) parts.push("cat.name LIKE ?");
      if (fields.includes("work")) parts.push("tr.work_labor LIKE ?");
      if (fields.includes("note")) parts.push("tr.note LIKE ?");
      if (fields.includes("date")) {
        parts.push(
          "DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') LIKE ?"
        );
      }

      if (parts.length) {
        where.push(`(${parts.join(" OR ")})`);
        for (let i = 0; i < parts.length; i++) params.push(like);
      }
    }

    // -------------------------------------------------------------------------
    // Summary aggregate (rows, hours, active days, vacation/sick)
    // -------------------------------------------------------------------------
    const [sumRows] = await conn.query(
      `
      SELECT
        COUNT(*) AS rowsCount,
        SUM(tr.hours) + 0 AS totalHours,
        SUM(CASE WHEN tr.billable = 1 THEN tr.hours ELSE 0 END) + 0 AS billableHours,
        SUM(CASE WHEN tr.billable = 0 THEN tr.hours ELSE 0 END) + 0 AS nonBillableHours,
        SUM(
          CASE
            WHEN LOWER(tr.work_labor) = 'vacation'
              OR LOWER(cat.name) = 'vacation'
            THEN (tr.hours + 0)
            ELSE 0
          END
        ) AS vacationHours,
        SUM(
          CASE
            WHEN LOWER(tr.work_labor) = 'sick'
              OR LOWER(cat.name) = 'sick'
            THEN (tr.hours + 0)
            ELSE 0
          END
        ) AS sickHours,
        COUNT(
          DISTINCT DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d')
        ) AS activeDays
      FROM time_report tr
      JOIN users u ON u.id = tr.\`user\`
      LEFT JOIN customer c ON c.id = tr.customer_id
      LEFT JOIN project  p ON p.id = tr.project_id
      LEFT JOIN time_report_categories cat ON cat.id = tr.category
      WHERE ${where.join(" AND ")}
      `,
      params
    );

    const s = Array.isArray(sumRows) && sumRows[0] ? sumRows[0] : {};
    const summary = {
      rowsCount: Number(s.rowsCount ?? 0),
      totalHours: Number(s.totalHours ?? 0),
      billableHours: Number(s.billableHours ?? 0),
      nonBillableHours: Number(s.nonBillableHours ?? 0),
      activeDays: Number(s.activeDays ?? 0),
      topCustomers: undefined,
      vacationHours: Number(s.vacationHours ?? 0),
      sickHours: Number(s.sickHours ?? 0),
    };

    // -------------------------------------------------------------------------
    // Weekly aggregates (ISO week keys), grouped and later zero-filled
    // -------------------------------------------------------------------------
    const [weekRows] = await conn.query(
      `
      SELECT
        DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'), '%x-W%v') AS isoWeek,
        SUM(tr.hours + 0) AS hours,
        SUM(CASE WHEN COALESCE(tr.billable, 1) = 1 THEN (tr.hours + 0) ELSE 0 END) AS billableHours,
        SUM(CASE WHEN COALESCE(tr.billable, 1) = 0 THEN (tr.hours + 0) ELSE 0 END) AS nonBillableHours
      FROM time_report tr
      JOIN users u ON u.id = tr.\`user\`
      LEFT JOIN customer c ON c.id = tr.customer_id
      LEFT JOIN project  p ON p.id = tr.project_id
      LEFT JOIN time_report_categories cat ON cat.id = tr.category
      WHERE ${where.join(" AND ")}
      GROUP BY isoWeek
      ORDER BY MIN(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm')) ASC
      `,
      params
    );

    /**
     * Build ISO week keys between two dates (inclusive), used to "zero-fill" missing weeks.
     * Output example: ["2025-W01", "2025-W02", ...]
     */
    const weeksBetweenISO = (startYmd, endYmd) => {
      const toDate = (s) => {
        const [y, m, d] = String(s).split("-").map(Number);
        return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
      };

      const isoKey = (d) => {
        // ISO week trick: shift to Thursday of the current week
        const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const day = t.getUTCDay() || 7; // 1..7, where 7 is Sunday
        t.setUTCDate(t.getUTCDate() + 4 - day); // Thursday

        const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
        return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
      };

      const a = toDate(startYmd);
      const b = toDate(endYmd);
      const start = a <= b ? a : b;
      const end = a <= b ? b : a;

      const out = [];
      let last = "";
      const cur = new Date(start);

      while (cur <= end) {
        const key = isoKey(cur);
        if (key !== last) {
          out.push(key);
          last = key;
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      return out;
    };

    // Map DB results by isoWeek for quick lookup
    const rowsByWeek = new Map(
      (weekRows ?? []).map((r) => [
        String(r.isoWeek),
        {
          hours: Number(r.hours ?? 0),
          billableHours: Number(r.billableHours ?? 0),
          nonBillableHours: Number(r.nonBillableHours ?? 0),
        },
      ])
    );

    // Zero-fill missing weeks between fromQ..toQ
    const weekKeys = weeksBetweenISO(fromQ, toQ);
    const weekHours = weekKeys.map((wk) => {
      const v = rowsByWeek.get(wk) ?? { hours: 0, billableHours: 0, nonBillableHours: 0 };
      return {
        isoWeek: wk,
        hours: Number(v.hours.toFixed(2)),
        billableHours: Number(v.billableHours.toFixed(2)),
        nonBillableHours: Number(v.nonBillableHours.toFixed(2)),
      };
    });

    /**
     * Helper: round numbers to 2 decimals safely.
     */
    const num2 = (v) =>
      Math.round((Number(v ?? 0) + Number.EPSILON) * 100) / 100;

    // -------------------------------------------------------------------------
    // Aggregates: by customer / by user / by category
    // -------------------------------------------------------------------------
    const [custRows] = await conn.query(
      `
      SELECT
        tr.customer_id AS customerId,
        COALESCE(c.company, '—') AS customerName,
        SUM(tr.hours + 0) AS hours
      FROM time_report tr
      JOIN users u ON u.id = tr.\`user\`
      LEFT JOIN customer c ON c.id = tr.customer_id
      LEFT JOIN project  p ON p.id = tr.project_id
      LEFT JOIN time_report_categories cat ON cat.id = tr.category
      WHERE ${where.join(" AND ")}
      GROUP BY tr.customer_id, c.company
      ORDER BY hours DESC, customerName ASC
      `,
      params
    );

    const byCustomer = (custRows ?? []).map((r) => ({
      customerId: r.customerId != null ? Number(r.customerId) : null,
      customerName: r.customerName ?? "—",
      hours: num2(r.hours),
    }));

    const [userRows] = await conn.query(
      `
      SELECT
        u.id AS userId,
        COALESCE(u.name, CONCAT('#', u.id)) AS name,
        SUM(tr.hours + 0) AS hours
      FROM time_report tr
      JOIN users u ON u.id = tr.\`user\`
      LEFT JOIN customer c ON c.id = tr.customer_id
      LEFT JOIN project  p ON p.id = tr.project_id
      LEFT JOIN time_report_categories cat ON cat.id = tr.category
      WHERE ${where.join(" AND ")}
      GROUP BY u.id, u.name
      ORDER BY hours DESC, name ASC
      `,
      params
    );

    const byUser = (userRows ?? []).map((r) => ({
      userId: Number(r.userId),
      name: r.name ?? `#${r.userId}`,
      hours: num2(r.hours),
    }));

    const [catRows] = await conn.query(
      `
      SELECT
        tr.category AS categoryId,
        COALESCE(cat.name, '—') AS name,
        SUM(tr.hours + 0) AS hours
      FROM time_report tr
      JOIN users u ON u.id = tr.\`user\`
      LEFT JOIN customer c ON c.id = tr.customer_id
      LEFT JOIN project  p ON p.id = tr.project_id
      LEFT JOIN time_report_categories cat ON cat.id = tr.category
      WHERE ${where.join(" AND ")}
      GROUP BY tr.category, cat.name
      ORDER BY hours DESC, name ASC
      `,
      params
    );

    const byCategory = (catRows ?? []).map((r) => ({
      categoryId: r.categoryId != null ? Number(r.categoryId) : null,
      name: r.name ?? "—",
      hours: num2(r.hours),
    }));

    // -------------------------------------------------------------------------
    // Article usage statistics (registered vs custom)
    // -------------------------------------------------------------------------
    const [regRows] = await conn.query(
      `
      SELECT
        tri.article_id AS articleId,
        COALESCE(
          NULLIF(CONCAT(NULLIF(a.art_nr,''), ' – ', NULLIF(a.name,'')), ' – '),
          NULLIF(a.name, ''),
          CONCAT('Artikel #', tri.article_id)
        ) AS label,
        COUNT(*) AS cnt
      FROM time_report_item tri
      JOIN time_report tr ON tr.id = tri.time_report_id
      JOIN users u        ON u.id = tr.\`user\`
      LEFT JOIN articles a ON a.id = tri.article_id
      WHERE ${where.join(" AND ")}
        AND tri.article_id IS NOT NULL
        AND tri.article_id <> 1
      GROUP BY tri.article_id, label
      ORDER BY cnt DESC, label ASC
      LIMIT 500
      `,
      params
    );

    const [customRows] = await conn.query(
      `
      SELECT
        TRIM(tri.description) AS label,
        COUNT(*) AS cnt
      FROM time_report_item tri
      JOIN time_report tr ON tr.id = tri.time_report_id
      JOIN users u        ON u.id = tr.\`user\`
      WHERE ${where.join(" AND ")}
        AND tri.article_id = 1
        AND TRIM(tri.description) <> ''
      GROUP BY label
      ORDER BY cnt DESC, label ASC
      LIMIT 500
      `,
      params
    );

    const articles = {
      registered: (regRows ?? []).map((r) => ({
        articleId: Number(r.articleId),
        label: r.label ?? `Artikel #${r.articleId}`,
        count: Number(r.cnt ?? 0),
      })),
      custom: (customRows ?? []).map((r) => ({
        label: r.label ?? "(no description)",
        count: Number(r.cnt ?? 0),
      })),
    };

    // -------------------------------------------------------------------------
    // Optional: missing days per user
    // -------------------------------------------------------------------------
    const includeMissing = String(req.query.includeMissing ?? "0") === "1";
    let missingDays = undefined;

    if (includeMissing) {
      const excludeWeekends =
        String(req.query.missingExcludeWeekends ?? "1") === "1";
      const includeDates = String(req.query.missingIncludeDates ?? "0") === "1";
      const usersScope = String(req.query.usersScope ?? "active"); // active|tenantAll|recent

      // Generate date series (optionally excluding weekends in SQL)
      const dateSql = excludeWeekends
        ? `
          WITH RECURSIVE dates AS (
            SELECT CAST(? AS DATE) AS d
            UNION ALL
            SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < ?
          )
          SELECT DATE_FORMAT(d, '%Y-%m-%d') AS ymd
          FROM dates
          WHERE DAYOFWEEK(d) NOT IN (1,7)  -- 1=Sun, 7=Sat
        `
        : `
          WITH RECURSIVE dates AS (
            SELECT CAST(? AS DATE) AS d
            UNION ALL
            SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < ?
          )
          SELECT DATE_FORMAT(d, '%Y-%m-%d') AS ymd
          FROM dates
        `;

      const [dateRows] = await conn.query(dateSql, [fromQ, toQ]);
      const allDays = (dateRows ?? []).map((r) => String(r.ymd));

      // Pick which users to evaluate missing days for
      let userIdRows;

      if (usersScope === "tenantAll") {
        [userIdRows] = await conn.query(
          `SELECT u.id AS userId, COALESCE(u.name, CONCAT('#',u.id)) AS name
           FROM users u
           WHERE u.tenant_id = ?
           ORDER BY name ASC`,
          [tenantId]
        );
      } else if (usersScope === "recent") {
        const recentDays = Math.max(1, Number(req.query.recentDays ?? 60));
        [userIdRows] = await conn.query(
          `SELECT DISTINCT u.id AS userId, COALESCE(u.name, CONCAT('#',u.id)) AS name
           FROM time_report tr
           JOIN users u ON u.id = tr.\`user\`
           WHERE tr.\`date\` >= DATE_SUB(?, INTERVAL ? DAY)
             AND tr.\`date\` < ?
             AND u.\`tenant_id\` = ?
           ORDER BY name ASC`,
          [toQ, recentDays, addDaysYMD(toQ, 1), tenantId]
        );
      } else {
        // "active": users who have reports in the current window
        [userIdRows] = await conn.query(
          `SELECT DISTINCT u.id AS userId, COALESCE(u.name, CONCAT('#',u.id)) AS name
           FROM time_report tr
           JOIN users u ON u.id = tr.\`user\`
           WHERE tr.\`date\` >= ? AND tr.\`date\` < ? AND u.\`tenant_id\` = ?
           ORDER BY name ASC`,
          [fromQ, addDaysYMD(toQ, 1), tenantId]
        );
      }

      // Fetch which days were reported per user (local date)
      const [reportedRows] = await conn.query(
        `
        SELECT
          u.id AS userId,
          DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'), '%Y-%m-%d') AS ymd
        FROM time_report tr
        JOIN users u ON u.id = tr.\`user\`
        LEFT JOIN customer c ON c.id = tr.customer_id
        LEFT JOIN project  p ON p.id = tr.project_id
        LEFT JOIN time_report_categories cat ON cat.id = tr.category
        WHERE ${where.join(" AND ")}
        GROUP BY u.id, DATE(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'))
        ORDER BY u.id ASC, ymd ASC
        `,
        params
      );

      // Build a set of reported days per userId
      const repByUser = new Map(); // userId -> Set('YYYY-MM-DD')
      for (const r of reportedRows ?? []) {
        const uid = Number(r.userId);
        const ymd = String(r.ymd);
        if (!repByUser.has(uid)) repByUser.set(uid, new Set());
        repByUser.get(uid).add(ymd);
      }

      // Weekend check (kept as extra safety; SQL may already exclude)
      const isWeekend = (ymd) => {
        if (!excludeWeekends) return false;
        const [y, m, d] = ymd.split("-").map(Number);
        const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
        const wd = dt.getDay(); // 0=Sun, 6=Sat
        return wd === 0 || wd === 6;
      };

      const candidateDays = allDays.filter((d) => !isWeekend(d));

      // Compute missing days per user
      const rows = [];
      for (const u of userIdRows ?? []) {
        const uid = Number(u.userId);
        const name = u.name ?? `#${uid}`;
        const rep = repByUser.get(uid) ?? new Set();

        const missingDatesArr = [];
        for (const d of candidateDays) {
          if (!rep.has(d)) missingDatesArr.push(d);
        }

        if (missingDatesArr.length > 0) {
          rows.push({
            userId: uid,
            name,
            missingCount: missingDatesArr.length,
            ...(includeDates ? { missingDates: missingDatesArr } : {}),
          });
        }
      }

      // Sort: most missing first, then by name
      rows.sort(
        (a, b) =>
          b.missingCount - a.missingCount ||
          String(a.name).localeCompare(String(b.name))
      );

      missingDays = rows;
    }

    // -------------------------------------------------------------------------
    // Articles by customer (registered + custom)
    // -------------------------------------------------------------------------
    let articlesByCustomer = [];

    const [regCusRows] = await conn.query(
      `
      SELECT
        tr.customer_id AS customerId,
        COALESCE(c.company, '—') AS customerName,
        tri.article_id AS articleId,
        COALESCE(
          NULLIF(CONCAT(NULLIF(a.art_nr,''), ' – ', NULLIF(a.name,'')), ' – '),
          NULLIF(a.name, ''),
          CONCAT('Artikel #', tri.article_id)
        ) AS label,
        COUNT(*) AS count
      FROM time_report tr
      JOIN users u ON u.id = tr.\`user\`
      JOIN time_report_item tri ON tri.time_report_id = tr.id
      LEFT JOIN customer c ON c.id = tr.customer_id
      LEFT JOIN articles a ON a.id = tri.article_id
      WHERE ${where.join(" AND ")}
        AND tri.article_id IS NOT NULL
        AND tri.article_id <> 1
      GROUP BY tr.customer_id, customerName, tri.article_id, label
      ORDER BY customerName ASC, count DESC, label ASC
      `,
      params
    );

    const [cusRows] = await conn.query(
      `
      SELECT
        tr.customer_id AS customerId,
        COALESCE(c.company, '—') AS customerName,
        TRIM(tri.description) AS label,
        COUNT(*) AS count
      FROM time_report tr
      JOIN users u ON u.id = tr.\`user\`
      JOIN time_report_item tri ON tri.time_report_id = tr.id
      LEFT JOIN customer c ON c.id = tr.customer_id
      WHERE ${where.join(" AND ")}
        AND tri.article_id = 1
        AND TRIM(tri.description) <> ''
      GROUP BY tr.customer_id, customerName, label
      ORDER BY customerName ASC, count DESC, label ASC
      `,
      params
    );

    // Pack into customer buckets
    {
      const byCust = new Map(); // key: customerId|null

      for (const r of regCusRows ?? []) {
        const id = r.customerId == null ? null : Number(r.customerId);
        const key = id ?? "null";

        if (!byCust.has(key)) {
          byCust.set(key, {
            customerId: id,
            customerName: r.customerName ?? "—",
            registered: [],
            custom: [],
          });
        }

        byCust.get(key).registered.push({
          kind: "registered",
          articleId: Number(r.articleId),
          label: String(r.label ?? ""),
          count: Number(r.count ?? 0),
        });
      }

      for (const r of cusRows ?? []) {
        const id = r.customerId == null ? null : Number(r.customerId);
        const key = id ?? "null";

        if (!byCust.has(key)) {
          byCust.set(key, {
            customerId: id,
            customerName: r.customerName ?? "—",
            registered: [],
            custom: [],
          });
        }

        byCust.get(key).custom.push({
          kind: "custom",
          label: String(r.label ?? ""),
          count: Number(r.count ?? 0),
        });
      }

      // Sort within each customer bucket
      for (const v of byCust.values()) {
        v.registered.sort(
          (a, b) => b.count - a.count || a.label.localeCompare(b.label)
        );
        v.custom.sort(
          (a, b) => b.count - a.count || a.label.localeCompare(b.label)
        );
      }

      // Sort customers by name
      articlesByCustomer = [...byCust.values()].sort((a, b) =>
        String(a.customerName).localeCompare(String(b.customerName))
      );
    }

    // -------------------------------------------------------------------------
    // Optional: article timecards by customer (detailed union)
    // -------------------------------------------------------------------------
    const includeArticleTimecards =
      String(req.query.includeArticleTimecards ?? "0") === "1";
    let articlesByCustomerTimecards = undefined;

    if (includeArticleTimecards) {
      const sql = `
        SELECT
          tr.customer_id AS customerId,
          COALESCE(c.company, '—') AS customerName,
          tr.id AS timeReportId,
          DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'), '%Y-%m-%d') AS ymd,
          'registered' AS kind,
          tri.article_id AS articleId,
          COALESCE(
            NULLIF(CONCAT(NULLIF(a.art_nr,''), ' – ', NULLIF(a.name,'')), ' – '),
            NULLIF(a.name, ''),
            CONCAT('Artikel #', tri.article_id)
          ) AS label,
          SUM(COALESCE(tri.amount, 1)) AS qty
        FROM time_report tr
        JOIN users u ON u.id = tr.\`user\`
        JOIN time_report_item tri ON tri.time_report_id = tr.id
        LEFT JOIN customer c ON c.id = tr.customer_id
        LEFT JOIN articles a ON a.id = tri.article_id
        WHERE ${where.join(" AND ")}
          AND tri.article_id IS NOT NULL
          AND tri.article_id <> 1
        GROUP BY tr.customer_id, customerName, tr.id, ymd, tri.article_id, label

        UNION ALL

        SELECT
          tr.customer_id AS customerId,
          COALESCE(c.company, '—') AS customerName,
          tr.id AS timeReportId,
          DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'), '%Y-%m-%d') AS ymd,
          'custom' AS kind,
          NULL AS articleId,
          TRIM(tri.description) AS label,
          SUM(COALESCE(tri.amount, 1)) AS qty
        FROM time_report tr
        JOIN users u ON u.id = tr.\`user\`
        JOIN time_report_item tri ON tri.time_report_id = tr.id
        LEFT JOIN customer c ON c.id = tr.customer_id
        WHERE ${where.join(" AND ")}
          AND tri.article_id = 1
          AND TRIM(tri.description) <> ''
        GROUP BY tr.customer_id, customerName, tr.id, ymd, label

        ORDER BY customerName ASC, ymd ASC, timeReportId ASC, kind ASC, label ASC
      `;

      // NOTE: UNION repeats the same WHERE twice, so params must be duplicated.
      const [tcRows] = await conn.query(sql, [...params, ...params]);

      // Pack: customer -> timecards -> items[]
      const byCust = new Map();
      for (const r of tcRows ?? []) {
        const cid = r.customerId == null ? null : Number(r.customerId);
        const ckey = cid ?? "null";

        if (!byCust.has(ckey)) {
          byCust.set(ckey, {
            customerId: cid,
            customerName: r.customerName ?? "—",
            timecards: [],
          });
        }

        const cust = byCust.get(ckey);
        const tid = Number(r.timeReportId);

        let tc = cust.timecards.find((t) => t.timeReportId === tid);
        if (!tc) {
          tc = { timeReportId: tid, date: String(r.ymd), items: [], totalQty: 0 };
          cust.timecards.push(tc);
        }

        tc.items.push({
          kind: r.kind, // 'registered' | 'custom'
          articleId: r.articleId == null ? undefined : Number(r.articleId),
          label: String(r.label ?? ""),
          qty: Number(r.qty ?? 0),
        });

        tc.totalQty += Number(r.qty ?? 0);
      }

      // Sort timecards and items for stable UI rendering
      for (const v of byCust.values()) {
        v.timecards.sort(
          (a, b) => a.date.localeCompare(b.date) || a.timeReportId - b.timeReportId
        );
        for (const t of v.timecards) {
          t.items.sort(
            (a, b) => b.qty - a.qty || String(a.label).localeCompare(String(b.label))
          );
        }
      }

      articlesByCustomerTimecards = [...byCust.values()].sort((a, b) =>
        String(a.customerName).localeCompare(String(b.customerName))
      );
    }

    // -------------------------------------------------------------------------
    // Optional: facets (for filter dropdowns)
    // -------------------------------------------------------------------------
    async function buildFacets(conn, where, params) {
      // CUSTOMERS
      const [cust] = await conn.query(
        `
        SELECT tr.customer_id AS id,
               COALESCE(c.company, '—') AS label,
               COUNT(*) AS cnt
        FROM time_report tr
        JOIN users u ON u.id = tr.\`user\`
        LEFT JOIN customer c ON c.id = tr.customer_id
        WHERE ${where.join(" AND ")}
        GROUP BY tr.customer_id, c.company
        ORDER BY cnt DESC, label ASC
        LIMIT 500
        `,
        params
      );

      // PROJECTS
      const [proj] = await conn.query(
        `
        SELECT tr.project_id AS id,
               COALESCE(p.projectname, '—') AS label,
               COUNT(*) AS cnt
        FROM time_report tr
        JOIN users u ON u.id = tr.\`user\`
        LEFT JOIN project p ON p.id = tr.project_id
        WHERE ${where.join(" AND ")}
        GROUP BY tr.project_id, p.projectname
        ORDER BY cnt DESC, label ASC
        LIMIT 500
        `,
        params
      );

      // USERS
      const [usr] = await conn.query(
        `
        SELECT u.id AS id,
               COALESCE(u.name, CONCAT('#',u.id)) AS label,
               COUNT(*) AS cnt
        FROM time_report tr
        JOIN users u ON u.id = tr.\`user\`
        WHERE ${where.join(" AND ")}
        GROUP BY u.id, u.name
        ORDER BY cnt DESC, label ASC
        LIMIT 500
        `,
        params
      );

      // CATEGORIES
      const [cat] = await conn.query(
        `
        SELECT tr.category AS id,
               COALESCE(tc.name, '—') AS label,
               COUNT(*) AS cnt
        FROM time_report tr
        JOIN users u ON u.id = tr.\`user\`
        LEFT JOIN time_report_categories tc ON tc.id = tr.category
        WHERE ${where.join(" AND ")}
        GROUP BY tr.category, tc.name
        ORDER BY cnt DESC, label ASC
        LIMIT 500
        `,
        params
      );

      // ARTICLES: REGISTERED
      const [artReg] = await conn.query(
        `
        SELECT
          tri.article_id AS articleId,
          COALESCE(
            NULLIF(CONCAT(NULLIF(a.art_nr,''), ' – ', NULLIF(a.name,'')), ' – '),
            NULLIF(a.name, ''),
            CONCAT('Artikel #', tri.article_id)
          ) AS label,
          COUNT(*) AS cnt
        FROM time_report_item tri
        JOIN time_report tr ON tr.id = tri.time_report_id
        JOIN users u        ON u.id = tr.\`user\`
        LEFT JOIN articles a ON a.id = tri.article_id
        WHERE ${where.join(" AND ")}
          AND tri.article_id IS NOT NULL
          AND tri.article_id <> 1
        GROUP BY tri.article_id, label
        ORDER BY cnt DESC, label ASC
        LIMIT 500
        `,
        params
      );

      // ARTICLES: CUSTOM TOP (article_id = 1)
      const [artCustom] = await conn.query(
        `
        SELECT
          TRIM(tri.description) AS label,
          COUNT(*) AS cnt
        FROM time_report_item tri
        JOIN time_report tr ON tr.id = tri.time_report_id
        JOIN users u        ON u.id = tr.\`user\`
        WHERE ${where.join(" AND ")}
          AND tri.article_id = 1
          AND TRIM(tri.description) <> ''
        GROUP BY label
        ORDER BY cnt DESC, label ASC
        LIMIT 500
        `,
        params
      );

      const normIdName = (rows) =>
        (rows ?? [])
          .filter((r) => r.id != null)
          .map((r) => ({
            id: Number(r.id),
            name: String(r.label ?? "—"),
            count: Number(r.cnt ?? 0),
          }));

      return {
        customers: normIdName(cust),
        projects: normIdName(proj),
        users: normIdName(usr),
        categories: normIdName(cat),
        articles: {
          registered: (artReg ?? []).map((r) => ({
            id: Number(r.articleId),
            name: String(r.label ?? `Artikel #${r.articleId}`),
            count: Number(r.cnt ?? 0),
            label: String(r.label ?? `Artikel #${r.articleId}`),
          })),
          customTop: (artCustom ?? []).map((r) => ({
            label: String(r.label ?? "(no description)"),
            count: Number(r.cnt ?? 0),
          })),
        },
      };
    }

    let facets = undefined;
    if (includeFacets) {
      facets = await buildFacets(conn, where, params);
    }

    // -------------------------------------------------------------------------
    // Final response payload
    // -------------------------------------------------------------------------
    return res.json({
      summary,
      weekHours,
      byCustomer,
      byUser,
      byCategory,
      articles,
      articlesByCustomer,
      ...(includeMissing ? { missingDays } : {}),
      ...(includeArticleTimecards ? { articlesByCustomerTimecards } : {}),
      ...(includeFacets ? { facets } : {}),
    });
  } catch (err) {
    console.error("getAdminTimeReportsStats error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
};

/**
 * getAdminTimeReportsChanges
 *
 * Purpose:
 * - Lightweight "change detector" for admin time overview.
 * - Returns the latest change timestamp/date within the same tenant + filters
 *   as the list endpoint, so the frontend can poll and show a "New updates" banner.
 *
 * Response:
 * - 200: { latestUpdatedAt: string | null }
 *
 * Notes:
 * - Uses MAX(GREATEST(created_date, modified)) as a coarse "version".
 * - If your columns are DATE-only, this is day precision (OK for a refresh banner).
 */
export const getAdminTimeReportsChanges = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const tenantId = req.user?.tenantId ?? null;
    const adminUserId = req.user?.id ?? null;

    if (tenantId == null) {
      return res.status(403).json({ error: "Forbidden (no tenant bound)" });
    }
    if (adminUserId == null) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Default date range = current month (same as list)
    const { start: defStart, end: defEnd } = getThisMonthRangeYMD();
    const start = String(req.query.start ?? defStart).slice(0, 10);
    const end = String(req.query.end ?? defEnd).slice(0, 10);
    const endExclusive = addDaysYMD(end, 1);

    const billed = toBoolOrUndefined(req.query.billed);

    const qRaw = (req.query.q ?? "").toString().trim();
    const qUserId = req.query.userId ? Number(req.query.userId) : undefined;
    const qUserIds =
      typeof req.query.userIds === "string"
        ? req.query.userIds.split(",").map(Number).filter(Number.isFinite)
        : undefined;

    // NOTE: No #id / id:123 in changes endpoint
    const q = qRaw;

    const where = ["tr.`date` >= ?", "tr.`date` < ?", "u.`tenant_id` = ?"];
    const params = [start, endExclusive, tenantId];

    // User filters
    if (typeof qUserId === "number" && Number.isFinite(qUserId)) {
      where.push("tr.`user` = ?");
      params.push(qUserId);
    } else if (qUserIds?.length) {
      where.push("tr.`user` IN (?)");
      params.push(qUserIds);
    }

    // Billed filter
    if (billed !== undefined) {
      where.push("tr.`billed` = ?");
      params.push(billed);
    }

    // Search filters (match list endpoint basics)
    const ymdMatch = q && q.match(/^\d{4}-\d{2}-\d{2}$/);
    const dayOnly = q && q.match(/^\d{1,2}$/);

    if (ymdMatch) {
      where.push(
        `DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') = ?`
      );
      params.push(q);
    } else if (dayOnly) {
      where.push(`DAY(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm')) = ?`);
      params.push(Number(q));
    } else if (q) {
      const like = `%${q}%`;
      where.push(`(
        c.company LIKE ? OR
        p.projectname LIKE ? OR
        cat.name LIKE ? OR
        tr.work_labor LIKE ? OR
        tr.note LIKE ? OR
        DATE_FORMAT(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'),'%Y-%m-%d') LIKE ?
      )`);
      params.push(like, like, like, like, like, like);
    }

    // ✅ Version query uses DATETIME fields (created_at/modified_at)
    const sql = `
      SELECT
        MAX(GREATEST(tr.modified_at, tr.created_at)) AS latestUpdatedAt
      FROM time_report tr
      LEFT JOIN customer               c   ON c.id  = tr.customer_id
      LEFT JOIN project                p   ON p.id  = tr.project_id
      LEFT JOIN time_report_categories cat ON cat.id = tr.category
      JOIN users                       u   ON u.id  = tr.\`user\`
      WHERE ${where.join(" AND ")}
    `;

    const [rows] = await conn.query(sql, params);
    const latest = rows?.[0]?.latestUpdatedAt ?? null;

    const toMs = (v) => {
      if (!v) return null;

      if (v instanceof Date) {
        const t = v.getTime();
        return Number.isFinite(t) ? t : null;
      }

      const s = String(v).trim();
      if (!s) return null;

      // If someone sends ms as string
      if (/^\d{10,13}$/.test(s)) {
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
      }

      // MySQL DATETIME "YYYY-MM-DD HH:mm:ss" -> ISO-ish
      const isoish = s.includes("T") ? s : s.replace(" ", "T");
      const d = new Date(isoish);
      const t = d.getTime();
      return Number.isFinite(t) ? t : null;
    };

    const latestMs = toMs(latest);

    const sinceRaw = (req.query.since ?? "").toString().trim();
    const sinceMs = sinceRaw ? toMs(sinceRaw) : null;

    const changed =
      latestMs != null && sinceMs != null ? latestMs > sinceMs : false;

    return res.json({
      latestMs,
      latestIso: latestMs != null ? new Date(latestMs).toISOString() : null,
      changed,
    });
  } catch (err) {
    console.error("getAdminTimeReportsChanges error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
};



