import { Router } from "express";
import {
  generateWorklogPdf,
  getWorklogPdf,
  PdfQueue,
  PdfQueuestatus,
  getCustomerSendPrefs,
  sendPDFToCustomer,
  getPDFinRange,
} from "../controller/worklogPdfController.js";

const r = Router();

/**
 * Worklog PDF routes (admin-only).
 *
 * IMPORTANT:
 * - These routes are meant to be mounted behind:
 *     app.use("/api/worklogpdf", requireAuth, requireRole("admin"), worklogPdfRoutes);
 * - We keep static routes before param routes to avoid future routing conflicts.
 */

// Queue routes
r.get("/queue/status", PdfQueuestatus);
r.post("/queue", PdfQueue);

// PDF generation + fetch
r.post("/generate", generateWorklogPdf);
r.get("/:invoiceId/pdf", getWorklogPdf);

// Email / customer preferences
r.get("/getEmails/:id", getCustomerSendPrefs);
r.post("/sendPDFToCustomer", sendPDFToCustomer);

// Search PDFs
r.post("/getpdfsInrange", getPDFinRange);

export default r;