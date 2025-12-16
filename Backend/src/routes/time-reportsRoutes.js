import { Router } from "express";

import {
  listTimeReports,
  getTimeReportSummary,
  updateTimeReport,
  deleteTimeReport,
} from "../controller/time-reportsController.js";

const r = Router();

/**
 * Returns a paginated list of time report entries for the authenticated user.
 * Supports filtering by date range, search query, billed status, cursor pagination, etc.
 */
r.get("/", listTimeReports);

/**
 * Returns aggregated summary stats (hours, billable, vacation, sick, etc.)
 * scoped to "me" (default) or (if admin) user/all scopes.
 */
r.get("/summary", getTimeReportSummary);

/**
 * Updates a time report entry and optionally its item rows (delete + upsert).
 */
r.put("/:id", updateTimeReport);

/**
 *
 * Deletes a single time report entry (and its related item rows) owned by the authenticated user.
 */
r.delete("/:id", deleteTimeReport);

export default r;
