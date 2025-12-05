/**
 * Authentication controller.
 *
 * Handles:
 * - User login (email + password)
 * - (Later) logout, refresh token, password reset, etc.
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import { signAccessToken } from "../utils/jwt.js";
import { sendPasswordResetEmail } from "../lib/mail.js";
import { isValidEmail, isValidPassword } from "../utils/validation.js";

/**
 * POST /api/auth/login
 *
 * Authenticate user using email and password.
 *
 * Expected request body:
 * {
 *   "email": "user@example.com",
 *   "password": "Password123!"
 * }
 *
 * On success:
 * - Sets an HttpOnly cookie with a JWT access token.
 * - Returns basic user info (without password).
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    const [rows] = await db.query(
      `SELECT 
    u.id,
    u.name,
    u.email,
    u.tenant_id,
    u.password_hash,
    u.is_active,
    u.deleted_at,
    u.role,
    u.avatar_url,
    t.name AS tenant_name
    FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.email = ?
    LIMIT 1`,
      [email]
    );

    const user = rows[0];
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.is_active || user.deleted_at) {
      return res
        .status(403)
        .json({ message: "User account is disabled or deleted" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const tokenPayload = {
      sub: user.id,
      tenantId: user.tenant_id,
      tenantName: user.tenant_name,
      name: user.name,
      role: user.role,
      email: user.email,
      avatarUrl: user.avatar_url,
    };

    const accessToken = signAccessToken(tokenPayload);

    const isProd = process.env.NODE_ENV === "production";

    res.cookie("tc_access", accessToken, {
      httpOnly: true,
      secure: isProd, // true in production (HTTPS)
      sameSite: isProd ? "strict" : "lax",
      maxAge: 60 * 60 * 1000, // 1 hour (should match JWT expiry)
      path: "/",
    });

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenant_id: user.tenant_id,
        tenantName: user.tenant_name,
        role: user.role,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    console.error("Error in login:", err);
    return res
      .status(500)
      .json({ message: "Internal server error during login" });
  }
}

/**
 * GET /api/auth/me
 *
 * Return the currently authenticated user based on the JWT cookie.
 * This route is protected with the requireAuth middleware.
 */

export async function getMe(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.user.id ?? req.user.sub;

    const [rows] = await db.query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.tenant_id,
        u.role,
        u.avatar_url,
        t.name AS tenant_name
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        tenantName: user.tenant_name,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}


/**
 * POST /api/auth/logout
 *
 * Logs out the current user by clearing the authentication cookie.
 *
 */
export async function logout(req, res) {
  try {
    const isProd = process.env.NODE_ENV === "production";

    res.clearCookie("tc_access", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      path: "/",
    });

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Error in logout:", err);
    return res
      .status(500)
      .json({ message: "Internal server error during logout" });
  }
}

/**
 * POST /api/auth/forgot-password
 *
 * Starts a password reset flow for the given email address.
 * Always returns a generic success message to avoid user enumeration.
 *
 * Expected body:
 * {
 *   "email": "user@example.com"
 * }
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res
        .status(400)
        .json({ message: "A valid email address is required" });
    }

    const [rows] = await db.query(
      `SELECT id, email, is_active, deleted_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];

    const genericResponse = {
      message:
        "If an account with that email exists, a password reset link has been sent.",
    };

    if (!user || !user.is_active || user.deleted_at) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.query(
      `INSERT INTO password_reset_tokens
        (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, tokenHash, expiresAt]
    );

    const frontendOrigin =
      process.env.FRONTEND_ORIGIN || "http://localhost:5173";
    const resetUrl = `${frontendOrigin}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail(user.email, resetUrl);
    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    return res
      .status(500)
      .json({ message: "Internal server error during password reset request" });
  }
}

/**
 * POST /api/auth/reset-password
 *
 * Completes the password reset flow using a reset token and a new password.
 *
 * Expected body:
 * {
 *   "token": "<raw_token_from_email>",
 *   "password": "NewPassword123!"
 * }
 */
export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [rows] = await db.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at,
              u.email, u.is_active, u.deleted_at, u.tenant_id, u.role, u.name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ?
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    const record = rows[0];

    if (!record) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset token" });
    }

    if (!record.is_active || record.deleted_at) {
      return res
        .status(403)
        .json({ message: "User account is disabled or deleted" });
    }

    const newPasswordHash = await bcrypt.hash(password, 10);

    await db.query(
      `UPDATE users
       SET password_hash = ?, updated_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, record.user_id]
    );

    await db.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = ?`,
      [record.id]
    );

    const tokenPayload = {
      sub: record.user_id,
      tenantId: record.tenant_id,
      role: record.role,
      email: record.email,
      avatarUrl: user.avatar_url,
    };

    const accessToken = signAccessToken(tokenPayload);
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("tc_access", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      message: "Password has been reset successfully",
      user: {
        id: record.user_id,
        name: record.name,
        email: record.email,
        tenant_id: record.tenant_id,
        role: record.role,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (err) {
    console.error("Error in resetPassword:", err);
    return res
      .status(500)
      .json({ message: "Internal server error during password reset" });
  }
}

/**
 * POST /api/auth/change-password
 *
 * Allows a logged-in user to change their password by providing
 * the current password and a new password.
 *
 * Expected body:
 * {
 *   "currentPassword": "OldPassword123!",
 *   "newPassword": "NewPassword123!"
 * }
 */
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current password and new password are required" });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.user.id;


    const [rows] = await db.query(
      `SELECT id, password_hash, is_active, deleted_at, tenant_id, email, role, name
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.is_active || user.deleted_at) {
      return res
        .status(403)
        .json({ message: "User account is disabled or deleted" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Current password is incorrect" });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users
       SET password_hash = ?, updated_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, userId]
    );

    const tokenPayload = {
      sub: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
      name: user.name,
      avatarUrl: req.user.avatarUrl ?? null,
      tenantName: req.user.tenantName ?? null,
    };

    const accessToken = signAccessToken(tokenPayload);
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("tc_access", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("Error in changePassword:", err);
    return res
      .status(500)
      .json({ message: "Internal server error during password change" });
  }
}
