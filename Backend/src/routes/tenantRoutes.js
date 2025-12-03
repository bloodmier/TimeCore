// src/routes/tenantRoutes.js

/**
 * Tenant routes.
 *
 * Base path: /api/tenants
 *
 * These endpoints are typically used from administrative UIs,
 * for example when creating new users and assigning them to a company.
 */

import express from "express";
import { getTenants } from "../controller/tenantController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/tenants
 *
 * Get a list of all tenants (companies).
 * Access: Admin only.
 */
router.get("/", getTenants);

export default router;
