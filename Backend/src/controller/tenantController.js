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
export async function getTenants(req, res) {
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
 