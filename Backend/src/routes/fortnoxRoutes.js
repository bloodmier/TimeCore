import { Router } from "express";
import { callFortnoxApi } from "../lib/fortnox.js";
import { handleFortnoxPost,syncCustomersFromFortnox } from "../controller/fortnoxController.js";

const r = Router();

/**
 * GET /fortnox/status
 * Lightweight "ping" endpoint to verify that:
 * - the stored Fortnox access token is valid, and
 * - the API is reachable.
 *
 * If Fortnox indicates the token is invalid/expired, your lib throws a
 * custom error with code === "REAUTHORIZE". In that case we tell the frontend
 * it needs to re-run the OAuth flow.
 */
r.get("/status", async (req, res) => {
  try {
    // Lightweight call to Fortnox (companyinformation is cheap and safe)
    await callFortnoxApi("companyinformation");
    return res.json({ needsReauth: false });
  } catch (err) {
    if (err?.code === "REAUTHORIZE") {
      return res.json({
        needsReauth: true,
        authorize_url: "/fortnox/oauth/start",
      });
    }
    console.error("Fortnox status error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

/**
 * GET /fortnox/:scope
 * Generic proxy endpoint into Fortnox:
 * - :scope decides which Fortnox resource you are calling (e.g. "invoices")
 * - query params are forwarded as Fortnox query params
 *
 * Special behavior:
 * - If scope === "invoices" and query store=true -> it also writes customers
 *   into your local database by parsing invoice data.
 */
r.get("/:scope", async (req, res) => {
  try {
    const data = await callFortnoxApi(req.params.scope, req.query);
    res.json(data);
  } catch (err) {
    if (err?.code === "REAUTHORIZE") {
      return res.status(401).json({
        error: "Fortnox needs re-authorization",
        authorize_url: "/fortnox/oauth/start",
      });
    }
    res.status(500).json({ error: String(err?.message || err) });
  }
});

/**
 * POST /fortnox/:scope
 * Sends payloads to Fortnox (typically invoices).
 * The controller enriches/sanitizes payloads first (prices, rows, currency, etc.),
 * then performs the POST with retry logic and good error reporting.
 */
r.post("/:scope", handleFortnoxPost);


r.post("/sync/customers", async (req, res) => {
  try {
    const limit = Number(req.body?.limit ?? 500);
    const result = await syncCustomersFromFortnox({ limit });
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err?.code === "REAUTHORIZE") {
      return res.status(401).json({
        ok: false,
        error: "Fortnox needs re-authorization",
        authorize_url: "/fortnox/oauth/start",
      });
    }
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default r;
