/**
 * User controller module.
 *
 * Contains handlers related to user management, such as:
 * - Creating new users
 * - (Later) updating users
 * - (Later) deactivating users
 * You change role on new accounts on row 50
 */

import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import { isValidEmail, isValidPassword } from "../utils/validation.js";

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
    // user or admin
    const finalRole = "admin"

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

/**
 * PUT /api/users/me/avatar
 *
 * Update the currently authenticated user's avatar.
 * Expects:
 *   - Auth cookie (requireAuth middleware)
 *   - multipart/form-data with "avatar" (image file)
 */
export async function updateAvatar(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const userId = req.user.id;

    const avatarsDir = path.join(__dirname, "..", "uploads", "avatars");
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    const [existingUserRows] = await db.query(
      `SELECT avatar_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    const oldAvatarUrl = existingUserRows[0]?.avatar_url ?? null;

    const timestamp = Date.now();
    const fileName = `user-${userId}-${timestamp}.webp`;
    const filePath = path.join(avatarsDir, fileName);

    await sharp(req.file.buffer)
      .resize(512, 512, {
        fit: "cover",
        position: "centre",
      })
      .toFormat("webp")
      .webp({ quality: 80 })
      .toFile(filePath);

    const avatarUrl = `/uploads/avatars/${fileName}`;

    await db.query(
      `UPDATE users
       SET avatar_url = ?, updated_at = NOW()
       WHERE id = ?`,
      [avatarUrl, userId]
    );

    if (oldAvatarUrl && oldAvatarUrl !== avatarUrl) {
      try {
        const oldPath = path.join(
          __dirname,
          "..",
          oldAvatarUrl.startsWith("/") ? oldAvatarUrl.substring(1) : oldAvatarUrl
        );
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (cleanupErr) {
        console.warn("Failed to remove old avatar file:", cleanupErr.message);
      }
    }

    const [rows] = await db.query(
      `SELECT id, name, email, tenant_id, role, avatar_url
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found after update" });
    }

    return res.status(200).json({
      message: "Avatar updated",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenant_id: user.tenant_id,
        role: user.role,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    console.error("Error in updateAvatar:", err);
    return res
      .status(500)
      .json({ message: "Internal server error while updating avatar" });
  }
}


