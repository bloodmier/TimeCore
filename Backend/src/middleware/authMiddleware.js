// src/middleware/authMiddleware.js

/**
 * Authentication middleware.
 *
 * Verifies the JWT access token stored in the HttpOnly cookie `tc_access`.
 * If valid, attaches a `user` object to `req` and calls next().
 * If invalid or missing, responds with 401 Unauthorized.
 */

import { verifyAccessToken } from "../utils/jwt.js";

/**
 * Require an authenticated user.
 *
 * Usage:
 *   router.get("/protected", requireAuth, (req, res) => { ... });
 */
export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.tc_access;

    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const payload = verifyAccessToken(token);
    
    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      tenantName: payload.tenantName,
      name:payload.name,
      role: payload.role,
      email: payload.email,
      avatarUrl: payload.avatarUrl ?? null,
    };

    return next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res
      .status(401)
      .json({ message: "Invalid or expired authentication token" });
  }
}


/**
 * Require that the authenticated user is an administrator.
 *
 * Usage:
 *   router.get("/admin-only", requireAuth, requireAdmin, handler);
 *
 * This middleware must always be used AFTER requireAuth,
 * because it relies on req.user being set by the JWT cookie verification.
 */
export function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "You do not have permission to perform this action"
      });
    }

    return next();
  } catch (err) {
    console.error("Admin check error:", err.message);
    return res.status(500).json({ message: "Internal server error" });
  }
}