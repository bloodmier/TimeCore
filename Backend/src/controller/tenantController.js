/**
 * Tenant controller.
 *
 * Handles operations related to tenants/companies, such as:
 * - Listing all tenants (for admin user management).
 * - (Later) creating or updating tenant information.
 */

import { db } from "../config/db.js";

/**
 * GET /api/tenants
 *
 * Returns a list of all tenants.
 * This endpoint is intended to be used when an admin creates new users
 * and needs to assign them to a specific tenant (company).
 *
 * Response example:
 * [
 *   {
 *     "id": 1,
 *     "name": "TimeCore AB",
 *     "org_number": "559123-4567"
 *   },
 *   ...
 * ]
 */
export const getTenants = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, org_number FROM tenants ORDER BY name ASC"
    );

    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error in getTenants:", err);
    return res
      .status(500)
      .json({ message: "Internal server error while fetching tenants" });
  }
}
 

/**
 * GET /api/tenants/company
 *
 * Returns the company customer ID associated with the authenticated user's tenant.
 * This value is used to determine which customer represents the owning/billing
 * company inside TimeCore. If no company customer is configured for the tenant,
 * the endpoint returns a 500 error.
 *
 * Successful response example:
 * {
 *   "customerId": 42
 * }
 *
 * Error responses:
 * 500 — No company customer configured or internal server error.
 *
 * Notes:
 * - Requires authentication (req.user.tenantId must be present).
 * - Reads the customer_id from the tenants table.
 */

export const getCompany = async (req,res) => {
try {
  const [rows] = await db.query(
    "SELECT customer_id FROM tenants WHERE id = ?",
    [req.user.tenantId]
  );

  if (!rows.length || !rows[0].customer_id) {
    return res.status(500).json({ error: "No company customer configured" });
  }

  res.json({ customerId: rows[0].customer_id });
  
} catch (err) {
  console.error("Error in getTenants:", err);
  return res
      .status(500)
      .json({ message: "Internal server error while fetching companyid" });
}
}