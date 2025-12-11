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
import { getTenants,getCompany } from "../controller/tenantController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/tenants
 *
 * Get a list of all tenants (companies).
 * Access: Admin only.
 */
router.get("/", getTenants);
router.get("/company",requireAuth, getCompany);

export default router;
