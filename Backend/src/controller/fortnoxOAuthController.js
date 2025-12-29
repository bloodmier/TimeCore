import fs from "fs";
import path from "path";

/**
 * Fortnox OAuth controller
 *
 * Responsibilities:
 * - startOAuth: redirect user to Fortnox authorization endpoint
 * - callbackOAuth: handle redirect back from Fortnox, exchange code for tokens,
 *   store tokens on disk, then close the popup and notify the opener window
 *
 * Tokens are stored in: fortnox_token.json (in the server's working directory)
 */

const tokenFile = path.resolve(process.cwd(), "fortnox_token.json");
const tmpTokenFile = tokenFile + ".tmp";

/**
 * OAuth configuration read from environment:
 * - CLIENT_ID / CLIENT_SECRET: Fortnox app credentials
 * - REDIRECT_URI: must match what Fortnox has registered
 * - IN_PRODUCTION: used to decide if cookies should be secure-only
 *
 * NOTE: cookieSecure here is a string if coming from env (e.g. "true").
 * In Express cookie options, secure expects boolean.
 * If IN_PRODUCTION is "false", it's still truthy unless you normalize it.
 */
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const cookieSecure = String(process.env.IN_PRODUCTION).toLowerCase() === "true";

/**
 * Space-separated scopes, defaulting to invoice read/write.
 * Fortnox expects the "scope" param as a space separated string.
 */
const scopes = (process.env.SCOPES || "invoice:read invoice:write").split(/\s+/);

/**
 * Writes the token JSON to disk in an "atomic-ish" way:
 * - write to a temp file
 * - rename temp file to the real file
 *
 * This pattern ensures the token file is either fully written or unchanged.
 *
 * NOTE: On Docker bind mounts, rename can sometimes be problematic depending on FS.
 * In lib/fortnox.js you used a more bind-mount friendly "overwrite in place" approach.
 */
function saveTokenAtomically(obj) {
  fs.writeFileSync(tmpTokenFile, JSON.stringify(obj, null, 2));
  fs.renameSync(tmpTokenFile, tokenFile);
}

/**
 * GET /fortnox/oauth/start
 *
 * Starts OAuth:
 * - Generates a random "state" string (CSRF protection)
 * - Stores state in a short-lived httpOnly cookie
 * - Redirects user to Fortnox /auth endpoint with:
 *   client_id, redirect_uri, response_type=code, scope, state
 */
export function startOAuth(req, res) {
     console.log("[Fortnox OAuth start]", {
  redirectUri,
  scopes: scopes.join(" "),
});
  // Random state used to prevent CSRF
  const state = Math.random().toString(36).slice(2);

  // Store state in an httpOnly cookie so JS cannot read it
  res.cookie("fnx_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure, // should be boolean in production
    maxAge: 5 * 60 * 1000,
    path: "/",
  });

  // Build authorization URL
  const authorizeUrl = new URL("https://apps.fortnox.se/oauth-v1/auth");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", scopes.join(" "));
  authorizeUrl.searchParams.set("state", state);

  // Redirect the browser to Fortnox login/consent page
  res.redirect(authorizeUrl.toString());
}

/**
 * GET /fortnox/oauth/callback
 *
 * Handles Fortnox redirect back to your server.
 *
 * Steps:
 * 1) Read "code" and "state" from query parameters
 * 2) Validate "state" matches the cookie value (CSRF protection)
 * 3) Exchange "code" for access_token + refresh_token (token endpoint)
 * 4) Save tokens to fortnox_token.json
 * 5) Clear the state cookie
 * 6) Return an HTML page that:
 *    - notifies the opener window via postMessage
 *    - closes the popup window
 */
export async function callbackOAuth(req, res) {
  try {
    console.log("jag körs");
    
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Missing code");

    // Verify state matches cookie (prevents CSRF / cross-site injection)
    const cookieState = req.cookies?.fnx_oauth_state;
    if (!cookieState || cookieState !== state) {
      return res.status(400).send("Invalid state");
    }

    // Basic auth header with client credentials
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://apps.fortnox.se/oauth-v1/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const txt = await tokenRes.text().catch(() => "");

    // If Fortnox rejects the exchange, return the raw response for debugging
    if (!tokenRes.ok) {
      return res
        .status(500)
        .send(`Token exchange failed: ${tokenRes.status} ${tokenRes.statusText} ${txt}`);
    }

    const data = JSON.parse(txt || "{}");

    // Fortnox must return both tokens (access + refresh)
    if (!data.access_token || !data.refresh_token) {
      return res.status(500).send("Token exchange failed: missing tokens");
    }

    // Persist tokens to disk so other API calls can reuse them
    saveTokenAtomically({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    // Clear state cookie once it has been validated/used
    res.clearCookie("fnx_oauth_state", { path: "/" });

    // Return HTML that closes popup and signals the opener window
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html><body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage("FORTNOX_AUTH_OK", "*");
      window.close();
    } else {
      document.write("Fortnox connected. You can close this window.");
    }
  } catch (e) {}
</script>
</body></html>`);
  } catch (err) {
    console.error("Fortnox OAuth callback error:", err);
    res.status(500).send("OAuth callback failed");
  }
}
