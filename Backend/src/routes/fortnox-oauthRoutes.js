import { Router } from "express";
import { startOAuth, callbackOAuth } from "../controller/fortnoxOAuthController.js";
import { requireAuth } from "../middleware/authMiddleware.js"
import { requireRole } from "../middleware/requireRole.js";
import { createSession, consumeSession } from "../lib/fortnox.js";

const r = Router();

/**
 * GET api/fortnox/oauth/start
 *
 * Starts the Fortnox OAuth flow.
 *
 * Security model used here:
 * - The frontend first calls POST /fortnox/oauth/session (admin-protected)
 *   which returns a short-lived "sid".
 * - The frontend then redirects the user to /fortnox/oauth/start?sid=...
 * - This route consumes that sid (one-time use) and reconstructs req.user
 *   so your startOAuth controller can proceed as if the user is authenticated.
 *
 * Why consumeSession:
 * - Prevents replay: the same sid cannot be used twice.
 * - The sid has a TTL (5 minutes in fortnox.js).
 */
r.get(
  "/start",
  (req, res, next) => {
 
    const sid = String(req.query.sid || "");

    // One-time read + delete of the in-memory session.
    const sess = consumeSession(sid);

    // If sid is missing/expired/invalid, we do not start OAuth.
    if (!sess) return res.status(401).send("Invalid or expired sid");

    // Rehydrate user context for the startOAuth controller.
    // This avoids needing auth middleware on this route (since redirects often lose auth headers).
    req.user = { id: sess.userId, email: sess.email };

    // Continue into the real OAuth starter controller.
    next();
  },
  startOAuth
);

/**
 * POST api/fortnox/oauth/session
 *
 * Creates a short-lived in-memory session ("sid") that is used once when starting OAuth.
 *
 * Protected by:
 * - requireScope("access_as_user")  -> user has a valid access scope/token
 * - ensureUser                     -> loads req.user
 * - requireRole("admin")           -> only admins may connect Fortnox
 *
 * Response:
 * - sid: a random UUID
 * - ttlSeconds: how long the sid is valid (300 seconds)
 *
 * Typical usage:
 * 1) Frontend calls this endpoint to get sid
 * 2) Frontend redirects browser to /fortnox/oauth/start?sid=<sid>
 */
r.post(
  "/session",
   requireAuth,
  requireRole("admin"),
  (req, res) => {
    const sid = createSession({ userId: req.user.id, email: req.user.email });
    res.status(201).json({ sid, ttlSeconds: 300 });
  }
);

/**
 * GET api/fortnox/oauth/callback
 *
 * OAuth callback endpoint.
 * Fortnox redirects here after the user authorizes the app.
 *
 * The callbackOAuth controller typically:
 * - validates state
 * - exchanges authorization code for tokens
 * - stores tokens (e.g. fortnox_token.json)
 * - redirects back to your frontend
 */
r.get("/callback", callbackOAuth);

export default r;
