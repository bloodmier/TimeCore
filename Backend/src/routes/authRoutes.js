/**
 * Authentication routes.
 *
 * Base path: /api/auth
 */

import express from "express";
import { login, getMe,logout,forgotPassword,resetPassword,changePassword,refreshAccessToken } from "../controller/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";



const router = express.Router();

/**
 * POST /api/auth/login
 * User login with email + password.
 */
router.post("/login", login);

/**
 * GET /api/auth/me
 * Get the currently authenticated user (based on JWT cookie).
 */
router.get("/me", requireAuth, getMe);

/**
 * POST /api/auth/logout
 * Clear the authentication cookie and log the user out.
 */
router.post("/logout", logout);

/**
 * POST /api/auth/forgot-password
 * Start password reset flow for a given email.
 */
router.post("/forgot-password", forgotPassword);

/**
 * POST /api/auth/reset-password
 * Complete password reset using reset token and new password.
 */
router.post("/reset-password", resetPassword);
/**
 * POST /api/auth/reset-password
 * Change password for logged in users.
 */
router.post("/change-password", requireAuth, changePassword);

/**
 * POST /api/auth/refresh
 * Refreshtoken when expired
 */
router.post("/refresh", refreshAccessToken);


export default router;
