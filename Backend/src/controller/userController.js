/**
 * User controller module.
 *
 * Contains handlers related to user management, such as:
 * - Creating new users
 * - (Later) updating users
 * - (Later) deactivating users
 */

import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import { isValidEmail, isValidPassword } from "../utils/validation.js";

/**
 * Create a new user.
 *
 * This endpoint is intended to be used from an administrative UI
 * where an authenticated admin can create new users and assign them
 * to a specific tenant (company).
 *
 */
export async function createUser(req, res) {
  try {
    const { name, email, password, tenantId} = req.body;

    if (!name || !email || !password || !tenantId) {
      return res.status(400).json({
        message: "Missing required fields: name, email, password, tenantId",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    const finalRole = "user"

    const [tenantRows] = await db.query(
      "SELECT id FROM tenants WHERE id = ?",
      [tenantId]
    );
    if (tenantRows.length === 0) {
      return res.status(400).json({
        message: "Invalid tenantId: tenant does not exist",
      });
    }

    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingUsers.length > 0) {
      return res.status(409).json({
        message: "Email is already in use",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users
        (name, email, tenant_id, password_hash, is_active, deleted_at, created_at, updated_at, level_id, role)
       VALUES (?, ?, ?, ?, 1, NULL, NOW(), NOW(), NULL, ?)`,
      [name, email, tenantId, passwordHash, finalRole]
    );

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: result.insertId,
        name,
        email,
        tenant_id: Number(tenantId),
        role: finalRole,
        is_active: 1,
      },
    });
  } catch (err) {
    console.error("Error in createUser:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Email already exists (database constraint)",
      });
    }

    return res.status(500).json({
      message: "Internal server error while creating user",
    });
  }
}
