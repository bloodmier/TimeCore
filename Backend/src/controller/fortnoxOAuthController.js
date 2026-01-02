import { saveFortnoxToken } from "../lib/fortnox.js";

/**
 * Fortnox OAuth controller
 *
 * - startOAuth: redirects the user to Fortnox authorization
 * - callbackOAuth: exchanges the authorization code for tokens and persists them
 *
 * Token storage is handled by lib/fortnox.js and written to the container data volume:
 *   /app/data/fortnox_token.json
 */

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

// IN_PRODUCTION is stored as a string in env, normalize to boolean.
const cookieSecure = String(process.env.IN_PRODUCTION).toLowerCase() === "true";

// Fortnox expects scope as a space-separated string.
const scopes = (process.env.SCOPES || "invoice:read invoice:write").split(/\s+/);

export function startOAuth(req, res) {
  console.log("[Fortnox OAuth start]", {
    redirectUri,
    scopes: scopes.join(" "),
  });

  const state = Math.random().toString(36).slice(2);

  res.cookie("fnx_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    maxAge: 5 * 60 * 1000,
    path: "/",
  });

  const authorizeUrl = new URL("https://apps.fortnox.se/oauth-v1/auth");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", scopes.join(" "));
  authorizeUrl.searchParams.set("state", state);

  res.redirect(authorizeUrl.toString());
}

export async function callbackOAuth(req, res) {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Missing code");

    const cookieState = req.cookies?.fnx_oauth_state;
    if (!cookieState || cookieState !== state) {
      return res.status(400).send("Invalid state");
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

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

    if (!tokenRes.ok) {
      return res
        .status(500)
        .send(`Token exchange failed: ${tokenRes.status} ${tokenRes.statusText} ${txt}`);
    }

    const data = JSON.parse(txt || "{}");

    if (!data.access_token || !data.refresh_token) {
      return res.status(500).send("Token exchange failed: missing tokens");
    }

    saveFortnoxToken({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    res.clearCookie("fnx_oauth_state", { path: "/" });

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
