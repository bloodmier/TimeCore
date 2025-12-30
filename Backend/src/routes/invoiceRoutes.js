import { Router } from "express";
import {
  collectAllInvoiceData,
  lockAndMarkBilled,
  lockAndMarkItems
} from "../controller/invoiceController.js";

const r = Router();

/**
 * POST /invoice/collect
 * Collects invoiceable data from the database (time reports + material/items),
 * groups it per customer/company, and returns a structured dataset used to
 * build invoice drafts / invoice previews in the UI.
 */
r.post("/collect", collectAllInvoiceData);

/**
 * POST /invoice/lock-and-mark
 * Locks selected time report rows (FOR UPDATE) and marks them as billed
 * by writing billed=1 and invoice_number=<invoiceNumber>.
 * This prevents double invoicing when multiple admins are working at once.
 */
r.post("/lock-and-mark", lockAndMarkBilled);

/**
 * POST /invoice/lock-and-mark-items
 * Locks selected time report item rows (FOR UPDATE) and marks them as invoiced
 * by writing invoice_number=<invoiceNumber>.
 * This prevents double invoicing of material rows.
 */
r.post("/lock-and-mark-items", lockAndMarkItems);

export default r;
