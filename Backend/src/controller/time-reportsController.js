import { db } from "../config/db.js";
import {
  getThisMonthRangeYMD,
  addDaysYMD,
  toBoolOrUndefined,
  toYMDLocal,
} from "../utils/dateRange.js";



/**
 * List time reports for the authenticated user.
 *
 * Purpose:
 * - Fetches time_report rows owned by the current user.
 * - Supports filtering, searching, and cursor-based pagination.
 *
 * Query parameters (optional):
 * - start (YYYY-MM-DD): Start date (inclusive). Defaults to current month start.
 * - end (YYYY-MM-DD): End date (inclusive). Defaults to current month end.
 * - billed (true|false): Filter by billed status.
 * - q (string): Free-text search or date token.
 *   Supported date tokens:
 *   - Exact date:        2025-10-05
 *   - Month:             2025-10
 *   - Year:              2025
 *   - Range:             2025-10-01..2025-10-15
 *   - Slashes:           05/10/2025 or 2025/10/05
 *   - Keywords:          today, yesterday, idag, igår, last 24h
 *   - ID lookup:         #123 or id:123
 * - limit (number): Max items per page (default 50, max 200).
 * - cursor (string): Cursor for pagination (base64 encoded).
 *
 * Behaviour:
 * - Enforces ownership: users only see their own time reports.
 * - Orders results by date DESC, id DESC (newest first).
 * - Uses cursor-based pagination for stable infinite scrolling.
 * - Automatically joins customer, project, category, and item rows.
 *
 * Response:
 * - items: Array of enriched time report objects.
 * - nextCursor: Cursor for the next page (if more results exist).
 */
export const listTimeReports = async (req, res) => {
  const conn = await db.getConnection();

  // Cursor encoding/decoding for pagination
  const encodeCursor = (o) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const decodeCursor = (s) => {
    if (!s) return null;
    try {
      return JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  };

  // --- Date query helpers ------------------------------------------------------

  function toMySQLDateTimeLocal(d) {
    // Convert local JS Date -> "YYYY-MM-DD HH:MM:SS" for MySQL DATETIME filters
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /** Parse "dd/mm/yyyy" or "yyyy/mm/dd" -> YYYY-MM-DD (local) */
  function parseSlashDateToYMD(s) {
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      const ymd = toYMDLocal(d);
      if (ymd) return ymd;
    }
    m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const ymd = toYMDLocal(d);
      if (ymd) return ymd;
    }
    return null;
  }

  function nextYearMonth(y, m) {
    return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  }

  /**
   * Parse "q" into a date window if it looks like a date intent.
   * Returns: { start, endExclusive } or null
   */
  function parseDateQueryToken(qRaw) {
    const q = (qRaw || "").trim().toLowerCase();
    if (!q) return null;

    if (q === "idag" || q === "today") {
      const s = toYMDLocal(new Date());
      return s ? { start: s, endExclusive: addDaysYMD(s, 1) } : null;
    }

    if (q === "igår" || q === "igar" || q === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const s = toYMDLocal(d);
      return s ? { start: s, endExclusive: addDaysYMD(s, 1) } : null;
    }

    if (q === "last 24h" || q === "24h" || q === "senaste dygnet") {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return {
        start: toMySQLDateTimeLocal(start),
        endExclusive: toMySQLDateTimeLocal(end),
      };
    }

    // yyyy-mm-dd
    let m = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const s = `${m[1]}-${m[2]}-${m[3]}`;
      return { start: s, endExclusive: addDaysYMD(s, 1) };
    }

    // slashes
    const sDate = parseSlashDateToYMD(q);
    if (sDate) return { start: sDate, endExclusive: addDaysYMD(sDate, 1) };

    // yyyy-mm (whole month)
    m = q.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mon = Number(m[2]);
      const start = `${m[1]}-${m[2]}-01`;
      const { y: yn, m: mn } = nextYearMonth(y, mon);
      const endExclusive = `${String(yn).padStart(4, "0")}-${String(
        mn
      ).padStart(2, "0")}-01`;
      return { start, endExclusive };
    }

    // yyyy (whole year)
    m = q.match(/^(\d{4})$/);
    if (m) {
      const y = Number(m[1]);
      return { start: `${y}-01-01`, endExclusive: `${y + 1}-01-01` };
    }

    // yyyy-mm-dd .. yyyy-mm-dd (.., to, or -)
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

  try {
    // requireAuth guarantees req.user is present
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ error: "Unauthorized" });

    // Default date window = current month
    const { start: defaultStart, end: defaultEnd } = getThisMonthRangeYMD();
    let start = String(req.query.start ?? defaultStart).slice(0, 10);
    let end = String(req.query.end ?? defaultEnd).slice(0, 10);
    let endExclusive = addDaysYMD(end, 1);

    const billed = toBoolOrUndefined(req.query.billed);
    const qRaw = (req.query.q ?? "").toString().trim();

    // If q is a date token, treat it as date filtering (and skip text search)
    const dateToken = parseDateQueryToken(qRaw);
    const q = dateToken ? "" : qRaw;
    if (dateToken) {
      start = dateToken.start;
      endExclusive = dateToken.endExclusive;
    }

    // Pagination limit (max 200)
    const limitRaw = Number(req.query.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

    const cursor = decodeCursor(req.query.cursor ? String(req.query.cursor) : "");

    // --- Special case: ID lookup (#123 / id:123) -------------------------------
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
        WHERE tr.id = ? AND tr.\`user\` = ?
        LIMIT 1
      `;

      const [oneRows] = await conn.query(headSqlById, [id, authUserId]);
      if (!oneRows?.length) return res.json({ items: [], nextCursor: undefined });

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
        _cursorYmd: r.dateUTC,
      };

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

    // --- Regular listing (newest -> oldest) ------------------------------------

    const where = ["tr.`date` >= ?", "tr.`date` < ?", "tr.`user` = ?"];
    const params = [start, endExclusive, authUserId];

    if (billed !== undefined) {
      where.push("tr.`billed` = ?");
      params.push(billed);
    }

    // If q is only 1-2 digits, treat it as day-of-month search (local day)
    if (/^\d{1,2}$/.test(q)) {
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

    // Cursor pagination (DESC order): fetch rows "older" than cursor
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
      WHERE ${where.join(" AND ")}
      ORDER BY tr.date DESC, tr.id DESC
      LIMIT ?
    `;

    const [rows] = await conn.query(headSql, [...params, limit + 1]);

    const hasNext = Array.isArray(rows) && rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;

    if (!pageRows?.length) return res.json({ items: [], nextCursor: undefined });

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
      _cursorYmd: r.dateUTC,
    }));

    // Fetch item rows for this page
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

      const byReport = new Map();
      for (const it of itemRows ?? []) {
        const reportId = Number(it.timeReportId);
        const arr = byReport.get(reportId) ?? [];
        arr.push({
          id: Number(it.id),
          timeReportId: reportId,
          articleId: it.articleId != null ? Number(it.articleId) : null,
          amount: it.amount != null ? Number(it.amount) : null,
          description: it.description ?? "",
        });
        byReport.set(reportId, arr);
      }

      for (const r of items) r.items = byReport.get(r.id) ?? [];
    }

    // Next cursor = last row of this page (oldest row in DESC)
    const last = pageRows[pageRows.length - 1];
    const nextCursor = hasNext
      ? encodeCursor({ ymd: last.dateUTC, id: Number(last.id) })
      : undefined;

    return res.json({ items, nextCursor });
  } catch (err) {
    console.error("Error in getUserTimeReports:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
};

/**
 * Update a single time report entry.
 *
 * Purpose:
 * - Partially updates a time_report row owned by the authenticated user.
 * - Optionally updates, inserts, or deletes related item rows.
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
 * - note (string)
 * - workDescription (string)
 * - billable (boolean)
 * - billed (boolean)
 * - items:
 *   - delete: number[]   -> item ids to delete
 *   - upsert: object[]   -> items to update or insert
 *
 * Behaviour:
 * - Enforces ownership: user can only update their own reports.
 * - Builds a dynamic UPDATE statement (only provided fields are changed).
 * - Runs all operations in a transaction.
 * - Supports item-level delete and upsert in the same request.
 * - Updates the modified timestamp for auditing.
 *
 * Response:
 * - Returns the updated time report with enriched fields
 *   (customer, project, category names, and items).
 */
export const updateTimeReport = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });


  const userId = req.user?.id ;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // --- Small local helpers -----------------------------------------------------

  const isDef = (v) => v !== undefined && v !== null;

  // Ensure we never store NULL strings unless explicitly intended
  const toNonNullStr = (v, fallback = "") => {
    if (v === null || v === undefined) return fallback;
    return String(v);
  };

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

  /**
   * Build a dynamic UPDATE statement.
   * Only fields that exist in the request will be updated.
   */
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
  mainSets.push("`modified` = CURRENT_DATE");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Ownership check: user can only update their own report row
    const [rows] = await conn.execute(
      "SELECT id FROM `time_report` WHERE id = ? AND `user` = ? LIMIT 1",
      [id, userId]
    );

    if (!rows || rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Time report not found" });
    }

    // Update the main time_report row (only if there are fields to update)
    if (mainSets.length > 0) {
      const sql = `UPDATE \`time_report\` SET ${mainSets.join(
        ", "
      )} WHERE id = ? AND \`user\` = ?`;
      await conn.execute(sql, [...mainParams, id, userId]);
    }

    // Handle items: delete + upsert within the same transaction
    if (items && (Array.isArray(items.delete) || Array.isArray(items.upsert))) {
      // DELETE item rows (only the specified ids under this time report)
      if (Array.isArray(items.delete) && items.delete.length > 0) {
        const deleteIds = items.delete.map(Number).filter(Number.isFinite);
        if (deleteIds.length) {
          const ph = deleteIds.map(() => "?").join(", ");
          await conn.execute(
            `DELETE FROM \`time_report_item\` WHERE time_report_id = ? AND id IN (${ph})`,
            [id, ...deleteIds]
          );
        }
      }

      // UPSERT item rows
      if (Array.isArray(items.upsert)) {
        for (const it of items.upsert) {
          const itemId = it.id || it.itemId || null;

          const articleId = isDef(it.articleId) ? it.articleId : null;

          // Accept multiple field names from client: amount/qty/quantity
          const amount = isDef(it.amount)
            ? it.amount
            : isDef(it.qty)
            ? it.qty
            : isDef(it.quantity)
            ? it.quantity
            : null;

          const description = toNonNullStr(it.description, "");

          if (itemId) {
            // UPDATE existing item row
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
                `UPDATE \`time_report_item\` SET ${setPieces.join(
                  ", "
                )} WHERE id = ? AND time_report_id = ?`,
                [...setParams, itemId, id]
              );
            }
          } else {
            // INSERT new item row
            await conn.execute(
              "INSERT INTO `time_report_item` (`time_report_id`, `article_id`, `amount`, `description`) VALUES (?, ?, ?, ?)",
              [id, articleId, amount, description]
            );
          }
        }
      }
    }

    // Return an enriched, frontend-friendly payload after update
    const [[main]] = await conn.query(
      `
      SELECT
        tr.id,
        tr.\`user\`                 AS userId,
        tr.customer_id             AS customerId,
        c.company                  AS customerName,
        tr.\`category\`            AS categoryId,
        cat.name                   AS categoryName,
        DATE(tr.\`date\`)          AS date,
        tr.\`hours\`               AS hours,
        tr.\`note\`                AS note,
        tr.\`work_labor\`          AS workDescription,
        tr.\`billable\`            AS billable,
        tr.\`project_id\`          AS projectId,
        p.projectname              AS projectName,
        tr.\`billed\`              AS billed,
        DATE(tr.\`modified\`)      AS modified,
        DATE(tr.\`created_date\`)  AS createdDate
      FROM \`time_report\` tr
      LEFT JOIN \`customer\` c ON c.id = tr.customer_id
      LEFT JOIN \`project\`  p ON p.id = tr.project_id
      LEFT JOIN \`time_report_categories\` cat ON cat.id = tr.\`category\`
      WHERE tr.id = ? AND tr.\`user\` = ?
      LIMIT 1
      `,
      [id, userId]
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

    // Normalize payload types (numbers/booleans/strings)
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
    await conn.rollback();
    console.error("Error in updateTimereport:", error);
    return res.status(500).json({ error: "Couldn't update time report" });
  } finally {
    conn.release();
  }
};

/**
 * Get aggregated summary data for time reports.
 *
 * Purpose:
 * - Returns aggregated statistics for time reporting.
 * - Used by dashboards, overview pages, and admin reports.
 *
 * Query parameters (optional):
 * - start (YYYY-MM-DD): Start date (inclusive). Defaults to current month start.
 * - end (YYYY-MM-DD): End date (inclusive). Defaults to current month end.
 * - billed (true|false): Filter by billed status.
 * - q (string): Free-text search across customers, projects, categories, notes, and dates.
 * - scope (me | user | all): Scope of aggregation (admin only for user/all).
 * - userId (number): Aggregate data for a specific user (admin only).
 * - userIds (csv): Aggregate data for multiple users (admin only).
 *
 * Behaviour:
 * - Non-admin users are always restricted to their own data.
 * - Admin users can aggregate across users or entire tenants.
 * - Calculates:
 *   - totalHours
 *   - billableHours
 *   - nonBillableHours
 *   - daysReported
 *   - vacationHours
 *   - sickHours
 *
 * Response:
 * - Aggregated numeric values normalized to fixed decimals.
 * - Monetary amount is currently a placeholder (0) until pricing is applied.
 */
export const getTimeReportSummary = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Default date window = current month if no query provided
    const { start: defStart, end: defEnd } = getThisMonthRangeYMD();
    const start = String(req.query.start ?? defStart).slice(0, 10);
    const end = String(req.query.end ?? defEnd).slice(0, 10);
    const endExclusive = addDaysYMD(end, 1);

    // Optional filters
    const billed = toBoolOrUndefined(req.query.billed);
    const q = (req.query.q ?? "").toString().trim();

    // Base WHERE: date range + ownership
    const where = ["tr.`date` >= ?", "tr.`date` < ?", "tr.`user` = ?"];
    const params = [start, endExclusive, userId];

    // Optional billed filter
    if (billed !== undefined) {
      where.push("tr.`billed` = ?");
      params.push(billed);
    }

    // Optional text search
    if (q) {
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

    const sql = `
      SELECT
        -- Total reported hours
        SUM(tr.hours + 0) AS totalHours,

        -- Billable hours
        SUM(
          CASE WHEN tr.billable = 1
               THEN (tr.hours + 0)
               ELSE 0
          END
        ) AS billableHours,

        -- Number of distinct days with any reported time (local timezone day)
        COUNT(
          DISTINCT DATE(CONVERT_TZ(tr.date,'UTC','Europe/Stockholm'))
        ) AS daysReported,

        -- Vacation hours
        SUM(
          CASE
            WHEN LOWER(tr.work_labor) = 'vacation'
              OR LOWER(cat.name) = 'vacation'
            THEN (tr.hours + 0)
            ELSE 0
          END
        ) AS vacationHours,

        -- Sick hours
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
      WHERE ${where.join(" AND ")}
    `;

    const [rows] = await conn.query(sql, params);
    const agg = rows?.[0] ?? {};

    const totalHoursRaw = Number(agg.totalHours ?? 0);
    const billableHoursRaw = Number(agg.billableHours ?? 0);
    const nonBillableHoursRaw = totalHoursRaw - billableHoursRaw;

    const vacationHoursRaw = Number(agg.vacationHours ?? 0);
    const sickHoursRaw = Number(agg.sickHours ?? 0);


    return res.json({
      totalHours: Number(totalHoursRaw.toFixed(2)),
      billableHours: Number(billableHoursRaw.toFixed(2)),
      nonBillableHours: Number(nonBillableHoursRaw.toFixed(2)),
      daysReported: Number(agg.daysReported ?? 0),
      vacationHours: Number(vacationHoursRaw.toFixed(2)),
      sickHours: Number(sickHoursRaw.toFixed(2)),
    });
  } catch (err) {
    console.error("getTimeReportSummary error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
};


/**
 * Delete a single time report entry.
 *
 * Purpose:
 * - Permanently deletes a time_report row owned by the authenticated user.
 * - Also deletes all related item rows.
 *
 * Path parameters:
 * - id (number): Time report id.
 *
 * Behaviour:
 * - Enforces ownership: user can only delete their own reports.
 * - Deletes child rows (time_report_item) before deleting the parent row.
 * - Runs inside a transaction to ensure consistency.
 *
 * Response:
 * - success: true
 * - deletedId: id of the deleted time report
 */
export const deleteTimeReport = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query("DELETE FROM `time_report_item` WHERE time_report_id = ?", [
      id,
    ]);

    const [result] = await conn.query(
      "DELETE FROM `time_report` WHERE id = ? AND `user` = ?",
      [id, userId]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res
        .status(404)
        .json({ error: "No record found or not owned by user" });
    }

    await conn.commit();
    res.status(200).json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Delete error:", error);
    await conn.rollback();
    res.status(400).json({ error: "Bad request, couldn't remove item" });
  } finally {
    conn.release();
  }
};

