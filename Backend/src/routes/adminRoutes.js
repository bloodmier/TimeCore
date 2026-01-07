// routes/admin.route.js
import { Router } from "express";
import {
  getAdminTimeReports,
  AdminDeleteTimereportById,
  getAdminTimeReportsSummary,
  adminUpdateTimereport,
  getUsers,
  getAdminTimeReportsStats,
  getAdminTimeReportsChanges
} from "../controller/admin-Time-reportsController.js";

const r = Router();

/**
 * Admin time reporting overview endpoints.
 * All routes are protected at mount-level:
 * /admin -> requireAuth -> requireRole("admin")
 */

r.get("/timeoverveiw/entries", getAdminTimeReports);
r.get("/users", getUsers);
r.delete("/timeoverveiw/entries/:id", AdminDeleteTimereportById);
r.get("/timeoverveiw/timereportsummary", getAdminTimeReportsSummary);
r.put("/timeoverveiw/updateentries/:id", adminUpdateTimereport);
r.get("/timeoverveiw/stats", getAdminTimeReportsStats);
r.get("/timeoverveiw/changes", getAdminTimeReportsChanges);

export default r;
