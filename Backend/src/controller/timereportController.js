import { db } from "../config/db.js";
import { toBoolOrUndefined } from "../utils/dateRange.js";
import { createCustomerInFortnox } from "../controller/fortnoxController.js"
/**
 * Create one or more time reports (and optional line items).
 *
 * Input:
 * - Either a single object or an array of objects in req.body.
 * - Each object represents one time_report header, optionally with items.
 *
 * Behaviour:
 * - Validates required fields (customer_id, work_labor, category, date, hours).
 * - Inserts into time_report (one row per payload object).
 * - Updates customer.last_used and time_report_user_company_usage.
 * - Inserts line items into time_report_item if provided.
 * - If no items are sent but draft_id is given, copies items from draft.
 * - Deletes draft + draft items if draft_id is given.
 */
export const createTimeReport = async (req, res) => {
  // Normalize to an array so we support both single and bulk create.
  const payloads = Array.isArray(req.body) ? req.body : [req.body];
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (payloads.length === 0) {
    return res.status(400).json({ ok: false, error: "Empty payload" });
  }

  // Basic validation (billable is optional and converted later).
  const valid = payloads.every(
    (i) =>
      Number.isFinite(i.customer_id) &&
      typeof i.work_labor === "string" &&
      Number.isFinite(i.category) &&
      typeof i.date === "string" &&
      Number.isFinite(i.hours)
  );

  if (!valid) {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid item in payload" });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // ------------------------------------------------------------
    // Determine tenant's "own company" customer_id once
    // If a time report is registered on this customer_id => force billable=0
    // ------------------------------------------------------------
    const [[tenantRow]] = await conn.query(
      `SELECT t.customer_id
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    const tenantCustomerId = tenantRow?.customer_id ?? null;

    const INSERT_ITEM_SQL = `
      INSERT INTO time_report_item (time_report_id, article_id, amount, description, purchase_price)
      VALUES (?, ?, ?, ?, ?)
    `;

    for (let idx = 0; idx < payloads.length; idx++) {
      const i = payloads[idx];

      // ------------------------------------------------------------
      // NEW: force unbillable if user registers time on own company
      // ------------------------------------------------------------
      const isOwnCompany =
        tenantCustomerId != null &&
        Number(i.customer_id) === Number(tenantCustomerId);

      // Convert various truthy/falsey representations to 0/1 or undefined
      // (undefined means we let the DB default apply).
      // But if own company => always 0.
      const billable = isOwnCompany ? 0 : toBoolOrUndefined(i.billable);

      // === 1) Insert time_report header =====================================
      const baseCols = [
        "`user`",
        "`customer_id`",
        "`note`",
        "`work_labor`",
        "`category`",
        "`date`",
        "`hours`",
        "`project_id`",
      ];

      const baseVals = [
        userId,
        i.customer_id,
        i.note ?? "",
        i.work_labor,
        i.category,
        i.date,
        i.hours,
        i.project_id ?? null,
      ];

      // If billable is undefined, we omit the column and let DB default.
      // If own company => billable is 0, so it will ALWAYS be included.
      const sql = `
        INSERT INTO time_report (${baseCols.join(", ")}${
        billable === undefined ? "" : ", `billable`"
      })
        VALUES (${baseCols.map(() => "?").join(", ")}${
        billable === undefined ? "" : ", ?"
      })
      `;

      const params =
        billable === undefined ? baseVals : [...baseVals, billable];

      const [hdr] = await conn.execute(sql, params);
      const timeReportId = hdr.insertId;

      // === 2) Update “recent usage” info for this customer ==================
      await conn.execute(`UPDATE customer SET last_used = NOW() WHERE id = ?`, [
        i.customer_id,
      ]);

      await conn.execute(
        `INSERT INTO time_report_user_company_usage (user_id, customer_id, last_used)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE last_used = NOW()`,
        [userId, i.customer_id]
      );

      // === 3) Insert line items if provided =================================
      let insertedItems = 0;

      if (Array.isArray(i.items) && i.items.length > 0) {
        for (const raw of i.items) {
          const articleId = raw.article_id ?? raw.articleId ?? null;

          const n = Number(raw.amount);
          const amount = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;

          let description = String(raw.description ?? "").trim();
          const purchasePrice = raw.purchasePrice ?? null;

          // If description is empty but an articleId is provided, resolve name.
          if (!description && articleId != null) {
            const [[art]] = await conn.query(
              `SELECT name FROM articles WHERE id = ? LIMIT 1`,
              [articleId]
            );
            if (!art) throw new Error(`Article not found: ${articleId}`);
            description = String(art.name || "").trim();
          }

          if (!description) description = "Item";

          await conn.execute(INSERT_ITEM_SQL, [
            timeReportId,
            articleId,
            amount,
            description,
            purchasePrice,
          ]);

          insertedItems++;
        }
      }

      // === 4) Fallback: copy items from draft if no items were sent =========
      if (!insertedItems && i.draft_id) {
        const [copyRes] = await conn.query(
          `INSERT INTO time_report_item (time_report_id, article_id, amount, description)
           SELECT ?, d.article_id, COALESCE(d.amount, 1), d.description
           FROM time_report_item_draft d
           WHERE d.time_report_draft_id = ?`,
          [timeReportId, i.draft_id]
        );
        insertedItems = copyRes?.affectedRows || 0;
      }

      // === 5) Clean up draft records after successful send ==================
      if (i.draft_id) {
        await conn.execute(
          "DELETE FROM time_report_item_draft WHERE time_report_draft_id = ?",
          [i.draft_id]
        );
        await conn.execute(
          "DELETE FROM time_report_draft WHERE id = ? AND `user` = ?",
          [i.draft_id, userId]
        );
      }
    }

    await conn.commit();

    return res.status(201).json({
      ok: true,
      message: "Time reports created successfully",
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    console.error("createTimeReport error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to insert time reports" });
  } finally {
    conn.release();
  }
};


/**
 * Get all items for a given draft (time_report_item_draft).
 */
export const getDraftItems = async (req, res) => {
  const draftId = Number(req.params.id);
  if (!Number.isFinite(draftId))
    return res.status(400).json({ error: "Bad draft id" });

  try {
    const [rows] = await db.query(
      `SELECT article_id, amount, description
       FROM time_report_item_draft
       WHERE time_report_draft_id = ?
       ORDER BY id ASC`,
      [draftId]
    );

    const items = rows.map((r) => ({
      article_id: r.article_id ?? null,
      amount: r.amount == null ? 1 : Number(r.amount) || 1,
      description: r.description ?? "",
    }));

    res.json(items);
  } catch (err) {
    console.error("getDraftItems error:", err);
    res.status(500).json({ error: "Failed to fetch draft items" });
  }
};

/**
 * Get all projects for a specific customer.
 */
export const getProjectsById = async (req, res) => {
  const { customerId } = req.body;
  try {
    const sql = `SELECT * FROM project WHERE customer_id = ?`;
    const [rows] = await db.query(sql, [customerId]);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get all customers (no filters).
 */
export const getAllCustomers = async (req, res) => {
  try {
    const sql = `SELECT * FROM customer`;
    const [rows] = await db.query(sql);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Search customers by company name (optional ?q= filter).
 */
export const SearchCustomers = async (req, res) => {
  try {
    const q = (req.query.q ?? "").trim();
    let sql = "SELECT * FROM customer";
    const params = [];
    if (q) {
      sql += " WHERE company LIKE ?";
      params.push(`%${q}%`);
    }
    const [rows] = await db.query(sql, params);
    return res.status(200).json(rows);
  } catch (err) {
    console.error("SearchCustomers error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get all time report categories.
 */
export const getCategories = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name FROM time_report_categories ORDER BY id"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

/**
 * Get all labor (work description) templates.
 */
export const getLaborTemplates = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, extended_description FROM time_report_labor_templates ORDER BY id"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching labor templates:", err);
    res.status(500).json({ error: "Failed to fetch labor templates" });
  }
};

/**
 * create labor (work description) templates.
 */
export const postLaborTemplates = async (req,res) => {
  try {
    const userId = req.user.id;
    const { name, extendedDescription } = req.body;

    if (!name || !extendedDescription) {
      return res.status(400).json({ message: "Name and description are required" });
    }

    const [result] = await db.execute(
      `
      INSERT INTO time_report_labor_templates (user, name, extended_description)
      VALUES (?, ?, ?)
      `,
      [userId, name, extendedDescription]
    );

    res.status(201).json({
      id: result.insertId,
      user: userId,
      name,
      extended_description: extendedDescription,
    });
  } catch (err) {
    console.error("Error creating labor template", err);
    res.status(500).json({ message: "Failed to create labor template" });
  }

}

/**
 * delete labor (work description) templates.
 */
export const deleteLaborTemplates = async (req,res) => {
   try {
    const userId = req.user.id;
    const { id } = req.params;

    const [result] = await db.execute(
      `
      DELETE FROM time_report_labor_templates
      WHERE id = ? AND user = ?
      `,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting labor template", err);
    res.status(500).json({ message: "Failed to delete labor template" });
  }
}

/**
 * Get all “owner” customers (billing_owner = 1).
 */
export const getOwnerCompanies = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, company FROM customer WHERE billing_owner = 1 ORDER BY company"
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("getOwnerCompanies error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Quick-create an end-customer attached to an owner customer.
 *
 * Logic:
 * - Validates payload (company + owner_id).
 * - Verifies that owner_id refers to a billing_owner=1 customer.
 * - Sets bill_direct = 1 if owner_id matches DB_ID_IN_BACKEND, else 0.
 */
export const quickAddCustomer = async (req, res) => {
  try {
    if (!req.user || !req.user.id || !req.user.tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    
    const tenantId = req.user.tenantId;
    const { company, owner_id } = req.body;
    
    const trimmedCompany =
    typeof company === "string" ? company.trim() : "";
    
    const ownerIdNum = Number(owner_id);
    
        const [existing] = await db.query(
      `
      SELECT id, customer_id, company, billing_owner, customer_owner, bill_direct
      FROM customer
      WHERE company = ? AND customer_owner = ?
      LIMIT 1
      `,
      [trimmedCompany, ownerIdNum]
    );

    if (existing.length > 0) {
      return res.status(200).json({
        ...existing[0],
        existed: true,
      });
    }

    if (!trimmedCompany || !Number.isInteger(ownerIdNum) || ownerIdNum <= 0) {
      return res.status(400).json({ error: "Invalid payload" });
    } 

    const [tenantRows] = await db.query(
      "SELECT customer_id FROM tenants WHERE id = ?",
      [tenantId]
    );
    console.log(tenantRows);
    
    if (tenantRows.length === 0 || !tenantRows[0].customer_id) {
      return res.status(500).json({
        error: "Configuration error",
        message: "No company customer linked to this tenant.",
      });
    }

    const backendCustomerId = Number(tenantRows[0].customer_id);

    const [owners] = await db.query(
      "SELECT id FROM customer WHERE id = ? AND billing_owner = 1",
      [ownerIdNum]
    );

    if (owners.length === 0) {
      return res
        .status(400)
        .json({ error: "Selected owner is not eligible" });
    }

    const billDirect = ownerIdNum === backendCustomerId ? 1 : 0;

    const fortnoxCustomerNumber = await createCustomerInFortnox({
      name: trimmedCompany,
    });

    console.log(fortnoxCustomerNumber);
    
    // 6. Skapa kund
    const [result] = await db.execute(
      `
      INSERT INTO customer (
        customer_id,
        company,
        billing_owner,
        customer_owner,
        bill_direct
      )
      VALUES (?, ?, 0, ?, ?)
      `,
      [fortnoxCustomerNumber,trimmedCompany, ownerIdNum, billDirect]
    );

    return res.status(201).json({
      id: result.insertId,
      company: trimmedCompany,
      billing_owner: 0,
      customer_owner: ownerIdNum,
      bill_direct: billDirect,
    });
  } catch (err) {
    console.error("quickAddCustomer error:", err);

    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        error: "Invalid reference",
        message: "Owner customer does not exist or is not valid.",
      });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get most recently used customers for the current user.
 */
export const getRecentCustomers = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [rows] = await db.query(
      `SELECT c.id, c.company, c.billing_owner, c.customer_owner, u.last_used
       FROM time_report_user_company_usage u
       JOIN customer c ON u.customer_id = c.id
       WHERE u.user_id = ?
       ORDER BY u.last_used DESC
       LIMIT 10`,
      [userId]
    );

    return res.status(200).json(rows);
  } catch (err) {
    console.error("getRecentCustomers error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update customer usage for the current user.
 *
 * - Updates customer.last_used.
 * - Inserts/updates a row in time_report_user_company_usage.
 */
export const touchCustomerUsage = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { customerId } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!customerId)
      return res.status(400).json({ error: "Invalid customerId" });

    await db.execute(`UPDATE customer SET last_used = NOW() WHERE id = ?`, [
      customerId,
    ]);
    await db.execute(
      `INSERT INTO time_report_user_company_usage (user_id, customer_id, last_used)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_used = NOW()`,
      [userId, customerId]
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("touchCustomerUsage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Save a new time report draft (header + items).
 *
 * Behaviour:
 * - Inserts into time_report_draft.
 * - Optionally inserts related items into time_report_item_draft.
 * - billable is handled in a “soft” way (can be omitted).
 */
export const saveDraft = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const userId = req.user.id;
     if (!userId) return res.status(401).json({ error: "Unauthorized" });
  
    const {
      customer_id,
      note,
      work_labor,
      category,
      date,
      hours,
      billable,
      project_id,
      items,
    } = req.body;

    // Local helper to normalize billable input to 0/1 or undefined.
    const toBoolOrUndefined = (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      if (typeof v === "boolean") return v ? 1 : 0;
      const s = String(v).toLowerCase();
      if (s === "1" || s === "true" || s === "yes") return 1;
      if (s === "0" || s === "false" || s === "no") return 0;
      return undefined;
    };
    const billableVal = toBoolOrUndefined(billable);

    await conn.beginTransaction();

    // 1) Insert draft header.
    const baseCols = [
      "`user`",
      "customer_id",
      "note",
      "work_labor",
      "category",
      "date",
      "hours",
      "project_id",
    ];
    const colsSql =
      billableVal === undefined
        ? baseCols
        : [...baseCols.slice(0, 7), "billable", ...baseCols.slice(7)];
    const placeholders = colsSql.map(() => "?").join(", ");

    const insertSql = `
      INSERT INTO time_report_draft (${colsSql.join(", ")})
      VALUES (${placeholders})
    `;

    const baseParams = [
      userId ?? null,
      String(customer_id ?? ""),
      String(note ?? "").slice(0, 150),
      String(work_labor ?? "").slice(0, 500),
      Number(category ?? 0),
      String(date ?? ""),
      Number(String(hours ?? 0).replace(",", ".")),
      project_id ?? null,
    ];
    const params =
      billableVal === undefined
        ? baseParams
        : [...baseParams.slice(0, 7), billableVal, ...baseParams.slice(7)];

    const [result] = await conn.execute(insertSql, params);
    const draftId = result.insertId;

    // 2) Normalize and insert draft items (including purchase_price).
    const normalize = (raw) => {
      if (!raw) return null;

      const articleId = raw.article_id ?? raw.articleId ?? null;

      const n = Number(raw.amount);
      const amount = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;

      let description = String(raw.description ?? "").trim();
      if (description.length > 100) description = description.slice(0, 100);
      if (articleId == null && description.length === 0) return null;

      // Accept both purchase_price and purchasePrice; normalize decimals.
      let pp = raw.purchase_price ?? raw.purchasePrice ?? null;
      if (pp === "" || pp === undefined) pp = null;
      if (pp !== null) {
        const num = Number(String(pp).replace(",", "."));
        pp = Number.isFinite(num) ? Number(num.toFixed(2)) : null;
      }

      return [draftId, articleId, amount, description || "Item", pp];
    };

    const values =
      Array.isArray(items) && items.length > 0
        ? items.map(normalize).filter(Boolean)
        : [];

    if (values.length > 0) {
      await conn.query(
        `INSERT INTO time_report_item_draft
           (time_report_draft_id, article_id, amount, description, purchase_price)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    return res.status(201).json({ draftId, itemsSaved: values.length });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("saveDraft error:", err);
    return res.status(500).json({ error: "Failed to save draft" });
  } finally {
    conn.release();
  }
};

/**
 * Update an existing draft (header + items).
 *
 * Behaviour:
 * - Updates the time_report_draft row (by id + user).
 * - Deletes all previous items for this draft.
 * - Inserts new items into time_report_item_draft.
 */
export const updateDraft = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const draftId = Number(req.params.id);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      customer_id,
      note,
      work_labor,
      category,
      date,
      hours,
      project_id,
      items,
      billable,
    } = req.body;

    await conn.beginTransaction();

    // 1) Update draft header.
    await conn.execute(
      `UPDATE time_report_draft
         SET customer_id = ?,
             note = ?,
             work_labor = ?,
             category = ?,
             date = ?,
             hours = ?,
             billable = ?,
             project_id = ?,
             modified = CURRENT_TIMESTAMP
       WHERE id = ? AND \`user\` = ?`,
      [
        String(customer_id ?? ""),
        String(note ?? "").slice(0, 150),
        String(work_labor ?? "").slice(0, 500),
        Number(category ?? 0),
        String(date ?? ""),
        Number(String(hours ?? 0).replace(",", ".")),
        billable,
        project_id ?? null,
        draftId,
        userId ?? null,
      ]
    );

    // 2) Delete old items for this draft.
    await conn.execute(
      `DELETE FROM time_report_item_draft WHERE time_report_draft_id = ?`,
      [draftId]
    );

    // 3) Insert new items.
    const norm = (r) => {
      const articleId = r?.article_id ?? r?.articleId ?? null;
      const n = Number(r?.amount);
      const amount = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
      let description = String(r?.description ?? "").trim();
      if (description.length > 100) description = description.slice(0, 100);
      return [draftId, articleId, amount, description || "Item"];
    };

    const values = Array.isArray(items) && items.length ? items.map(norm) : [];

    if (values.length) {
      await conn.query(
        `INSERT INTO time_report_item_draft
           (time_report_draft_id, article_id, amount, description)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    return res.status(200).json({ success: true });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("updateDraft error:", err);
    return res.status(500).json({ error: "Failed to update draft" });
  } finally {
    conn.release();
  }
};

/**
 * Get all drafts for the current user, with optional filters and sorting.
 *
 * Supported query params:
 * - q: search in customer company name
 * - from, to: date range filter (on t.date)
 * - sort: modified | date | created_date | company_name | category_name
 * - order: asc | desc
 * - limit, offset: pagination
 *
 * Also attaches draft items from time_report_item_draft.
 */
export const getDrafts = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      q,
      from,
      to,
      sort = "modified",
      order = "desc",
      limit = "50",
      offset = "0",
    } = req.query;

    const sortMap = {
      modified: "t.modified",
      date: "t.date",
      created_date: "t.created_date",
      company_name: "COALESCE(c.company, '')",
      category_name: "COALESCE(cat.name, '')",
    };
    const sortCol = sortMap[sort] ?? sortMap.modified;
    const orderSql = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

    let sql = `
      SELECT
        t.*,
        DATE_FORMAT(t.date, '%Y-%m-%d') AS date,
        c.company AS company_name,
        cat.name  AS category_name
      FROM time_report_draft t
      LEFT JOIN customer c ON c.id = t.customer_id
      LEFT JOIN time_report_categories cat ON cat.id = t.category
      WHERE t.user = ?
    `;
    const params = [userId];

    if (q && q.trim()) {
      sql += ` AND c.company LIKE ?`;
      params.push(`%${q.trim()}%`);
    }
    if (from) {
      sql += ` AND t.date >= ?`;
      params.push(from);
    }
    if (to) {
      sql += ` AND t.date <= ?`;
      params.push(to);
    }

    sql += ` ORDER BY ${sortCol} ${orderSql} LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const [drafts] = await db.query(sql, params);

    // Attach items per draft.
    if (drafts.length > 0) {
      const draftIds = drafts.map((d) => d.id);
      const [itemRows] = await db.query(
        `SELECT time_report_draft_id, article_id, amount, description, purchase_price
         FROM time_report_item_draft
         WHERE time_report_draft_id IN (?)
         ORDER BY id ASC`,
        [draftIds]
      );

      const byDraft = new Map();
      for (const r of itemRows) {
        const list = byDraft.get(r.time_report_draft_id) ?? [];
        list.push({
          article_id: r.article_id,
          amount: r.amount == null ? 1 : Number(r.amount) || 1,
          description: r.description ?? "",
          purchasePrice: r.purchase_price ?? null,
        });
        byDraft.set(r.time_report_draft_id, list);
      }

      drafts.forEach((d) => {
        d.items = byDraft.get(d.id) ?? [];
      });
    }

    // Mark this response as non-cacheable.
    res.set("Cache-Control", "no-store");
    res.json(drafts);
  } catch (err) {
    console.error("getDrafts error:", err);
    res.status(500).json({ error: "Failed to fetch drafts" });
  }
};

/**
 * Get a single draft and its items by draft id.
 */
export const getDraftsById = async (req, res) => {
  try {
    const { id } = req.params;

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [[draft]] = await db.query(
      `SELECT *,
              DATE_FORMAT(date, '%Y-%m-%d') AS date
       FROM time_report_draft
       WHERE id = ?`,
      [id]
    );
    if (!draft) return res.status(404).json({ error: "Not found" });

    const [items] = await db.query(
      `SELECT article_id, amount, description
       FROM time_report_item_draft
       WHERE time_report_draft_id = ?
       ORDER BY id ASC`,
      [id]
    );

    draft.items = items.map((r) => ({
      article_id: r.article_id,
      amount: r.amount == null ? 1 : Number(r.amount) || 1,
      description: r.description ?? "",
    }));

    res.json(draft);
  } catch (err) {
    console.error("getDraftsById error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Delete a single draft and all its items (for the current user).
 */
export const deleteDraft = async (req, res) => {
  try {
    const { draftId } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!draftId) {
      return res.status(400).json({ error: "draftId required" });
    }

    await db.execute(
      "DELETE FROM time_report_item_draft WHERE time_report_draft_id = ?",
      [draftId]
    );
    await db.execute(
      "DELETE FROM time_report_draft WHERE id = ? AND `user` = ?",
      [draftId, userId]
    );

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("deleteDraft error:", err);
    res.status(500).json({ error: "Failed to delete draft" });
  }
};

/**
 * Delete all drafts (and their items) for the current user.
 */
export const clearDrafts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await db.execute(
      `DELETE h FROM time_report_item_draft h
       JOIN time_report_draft d ON h.time_report_draft_id = d.id
       WHERE d.user = ?`,
      [userId]
    );
    await db.execute("DELETE FROM time_report_draft WHERE `user` = ?", [
      userId,
    ]);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("clearDrafts error:", err);
    res.status(500).json({ error: "Failed to clear drafts" });
  }
};

/**
 * Save a time report template for later reuse.
 *
 * Behaviour:
 * - Each user can have up to 10 templates.
 * - If the limit is reached, the oldest template is overwritten.
 * - Items are stored as JSON in the `items` column.
 */
export const saveTimeTemplate = async (req, res) => {
  const conn = await db.getConnection();
  try {
    // Support both { templates: {...} } and plain body.
    const body = req.body?.templates ?? req.body;

    const name = String(req.body?.name ?? body?.name ?? "").slice(0, 150);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const customerId = String(body?.customerId ?? "");
    const note = String(body?.note ?? "").slice(0, 150);
    const workDescription = String(body?.workDescription ?? "").slice(0, 500);
    const category = Number(body?.category ?? 0);
    const date = String(body?.date ?? ""); // NOT NULL in DB
    const hours = Number(String(body?.hours ?? 0).replace(",", "."));
    const billable =
      body?.billable != null ? Number(Boolean(body.billable)) : 0;
    const projectId = body?.projectId ?? null;
    const itemsJson = JSON.stringify(body?.items ?? []);

    await conn.beginTransaction();

    // 1) Check how many templates the user already has.
    const [[countRow]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM time_report_templates WHERE \`user\` = ?`,
      [userId]
    );
    const total = Number(countRow?.cnt ?? 0);

    if (total >= 10) {
      // 2a) Overwrite the oldest template if limit reached.
      const [[oldest]] = await conn.query(
        `SELECT id FROM time_report_templates
         WHERE \`user\` = ?
         ORDER BY created_date ASC, id ASC
         LIMIT 1`,
        [userId]
      );
      if (!oldest?.id) {
        throw new Error("Could not find oldest template to replace.");
      }

      await conn.execute(
        `UPDATE time_report_templates
           SET \`name\` = ?,
               \`customer_id\` = ?,
               \`note\` = ?,
               \`work_labor\` = ?,
               \`category\` = ?,
               \`date\` = ?,
               \`hours\` = ?,
               \`billable\` = ?,
               \`project_id\` = ?,
               \`items\` = ?,
               \`modified\` = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          name,
          customerId,
          note,
          workDescription,
          category,
          date,
          hours,
          billable,
          projectId,
          itemsJson,
          oldest.id,
        ]
      );

      await conn.commit();
      return res.status(200).json({ templateId: oldest.id, replaced: true });
    }

    // 2b) Otherwise insert a new template row.
    const [result] = await conn.execute(
      `INSERT INTO time_report_templates
        (\`user\`, \`name\`, \`customer_id\`, \`note\`, \`work_labor\`, \`category\`, \`date\`, \`hours\`, \`billable\`, \`project_id\`, \`items\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        name,
        customerId,
        note,
        workDescription,
        category,
        date,
        hours,
        billable,
        projectId,
        itemsJson,
      ]
    );

    await conn.commit();
    return res
      .status(201)
      .json({ templateId: result.insertId, replaced: false });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    console.error("saveTimeTemplate error:", err);
    return res.status(500).json({ error: "Failed to save template" });
  } finally {
    conn.release();
  }
};

/**
 * Get all templates for the current user and parse items JSON.
 */
export const getAllsavedTemplates = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      console.error("getAllsavedTemplates: missing req.user.id", req.user);
      return res.status(401).json({ error: "Unauthorized: missing user id" });
    }

    const sql = "SELECT * FROM `time_report_templates` WHERE `user` = ?";
    const [result] = await db.execute(sql, [userId]);

    const templates = result.map((t) => ({
      ...t,
      items: t.items ? JSON.parse(t.items) : [],
    }));

    return res.status(200).json(templates);
  } catch (error) {
    console.error("getAllsavedTemplates error:", error);
    return res.status(500).json({ error: "Failed to get templates" });
  }
};

/**
 * Get a specific template by id for the current user.
 */
export const getsavedTemplatesById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      console.error("getsavedTemplatesById: missing req.user.id", req.user);
      return res.status(401).json({ error: "Unauthorized: missing user id" });
    }

    const sql =
      "SELECT * FROM `time_report_templates` WHERE `id` = ? AND `user` = ?";
    const [result] = await db.execute(sql, [id, userId]);

    return res.status(200).json(result);
  } catch (error) {
    console.error("getsavedTemplatesById error:", error);
    return res.status(500).json({ error: "Failed to get templates" });
  }
};

/**
 * Delete a template by id for the current user.
 */
export const deletesavedTemplatesById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      console.error("deletesavedTemplatesById: missing req.user.id", req.user);
      return res.status(401).json({ error: "Unauthorized: missing user id" });
    }

    const sql =
      "DELETE FROM `time_report_templates` WHERE `id` = ? AND `user` = ? LIMIT 1";
    const [result] = await db.execute(sql, [id, userId]);

    return res.status(200).json(result);
  } catch (error) {
    console.error("deletesavedTemplatesById error:", error);
    return res.status(500).json({ error: "Failed to delete template" });
  }
};

/**
 * Search / list articles (materials/products).
 *
 * Query params:
 * - q: search by name, art_nr, description (optional).
 * - limit, offset: pagination (limit capped at 50).
 */
export const getArticles = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (!q) {
      // No search term -> latest articles first.
      const [rows] = await db.query(
        `SELECT id, art_nr, name, description, purchase_price
         FROM articles
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return res.json(rows);
    }

    const like = `%${q}%`;
    const [rows] = await db.query(
      `SELECT id, art_nr, name, description, purchase_price
       FROM articles
       WHERE name LIKE ? OR art_nr LIKE ? OR description LIKE ?
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [like, like, like, limit, offset]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /timereport/articles error:", err);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
};

/**
 * Replace all items for a given time_report with a new list.
 *
 * Behaviour:
 * - Deletes existing time_report_item rows for the given report id.
 * - Inserts new items (article_id, amount, description).
 * - If articleId is provided but no description, description is pulled from articles.name.
 */
export const addOrReplaceItems = async (req, res) => {
  const reportId = Number(req.params.id);
  const items = Array.isArray(req.body?.items) ? req.body.items : null;

  if (!Number.isFinite(reportId)) {
    return res.status(400).json({ error: "Bad report id" });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Delete existing rows for this report.
    await conn.query("DELETE FROM time_report_item WHERE time_report_id = ?", [
      reportId,
    ]);

    const insertSql = `
      INSERT INTO time_report_item
        (time_report_id, article_id, amount, description)
      VALUES (?, ?, ?, ?)
    `;

    for (const it of items) {
      const articleId = it.articleId ?? null;
      const rawAmount = Number(it.amount || 1);
      const amount =
        Number.isFinite(rawAmount) && rawAmount > 0 ? Math.floor(rawAmount) : 1;

      let description = (it.description || "").trim();

      // If no description but articleId exists, resolve from articles table.
      if (articleId && !description) {
        const [[a]] = await conn.query(
          "SELECT name FROM articles WHERE id = ? LIMIT 1",
          [articleId]
        );
        if (!a) throw new Error(`Article not found: ${articleId}`);
        description = a.name;
      }

      if (!description) throw new Error("Description required");

      await conn.query(insertSql, [reportId, articleId, amount, description]);
    }

    await conn.commit();
    res.json({ ok: true, count: items.length });
  } catch (err) {
    await conn.rollback();
    console.error("PUT /time-report/:id/items error:", err);
    res.status(400).json({ error: String(err.message || err) });
  } finally {
    conn.release();
  }
};

/**
 * Get all line items for a given time_report id.
 * Note: unit price is not included here.
 */
export const getItemsForReport = async (req, res) => {
  const reportId = Number(req.params.id);
  if (!Number.isFinite(reportId))
    return res.status(400).json({ error: "Bad report id" });

  try {
    const [rows] = await db.query(
      `SELECT id, time_report_id, article_id, amount, description
       FROM time_report_item
       WHERE time_report_id = ?
       ORDER BY id ASC`,
      [reportId]
    );
    res.json(rows);
  } catch (err) {
    console.error("getItemsForReport error:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
};
