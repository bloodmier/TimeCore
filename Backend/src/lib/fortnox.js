// src/lib/fortnox.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import crypto from "node:crypto";

/**
 * This module is the Fortnox integration core:
 * - Loads Fortnox OAuth client credentials from a dedicated env file ("fortnox_env")
 * - Stores and loads OAuth tokens from a JSON file ("fortnox_token.json")
 * - Automatically refreshes access tokens when needed (single-flight refresh)
 * - Calls Fortnox endpoints with proper headers and error normalization
 * - Provides a tiny in-memory session store used during OAuth flows (short-lived)
 */

// Token persistence file (bind-mount friendly).
const tokenFile = path.resolve(process.cwd(), "fortnox_token.json");
const tmpTokenFile = tokenFile + ".tmp";

// ---------------- Utils: file IO ----------------

/**
 * Reads and parses JSON from disk.
 * Assumes the file exists; caller is responsible for checking existence first.
 */
function readJsonFile(file) {
  const txt = fs.readFileSync(file, "utf-8");
  return JSON.parse(txt);
}

/**
 * Writes JSON safely to disk.
 *
 * Why this pattern exists:
 * - On some Docker/bind-mounted volumes, naive "rename temp->real" is not reliable.
 * - So we write the content to a temp file, then overwrite the real file in-place.
 *
 * NOTE: You currently always write to `tmpTokenFile` (global), not `file + ".tmp"`.
 * That is OK as long as you only ever manage one token file in this module.
 */
function writeJsonFileAtomically(file, obj) {
  const data = JSON.stringify(obj, null, 2);

  // Write JSON to a temporary file first (useful for debugging and some FS behaviors)
  fs.writeFileSync(tmpTokenFile, data);

  // Overwrite the real file's contents in-place (works fine for bind-mounted files)
  const fd = fs.openSync(file, "w");
  fs.writeSync(fd, data);
  fs.closeSync(fd);

  // Cleanup temporary file
  fs.unlinkSync(tmpTokenFile);
}

// ---------------- ENV / CREDS ----------------

let _credsLogged = false;

/**
 * Loads OAuth client credentials (CLIENT_ID and CLIENT_SECRET) from environment.
 * Throws a CONFIG_MISSING error if they are not present.
 */
function getClientCreds() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const e = new Error(
      "Fortnox CLIENT_ID/CLIENT_SECRET is missing – check fortnox_env or .env and where the server is started from."
    );
    e.code = "CONFIG_MISSING";
    throw e;
  }

  // Placeholder for optional one-time logging.
  if (!_credsLogged) {
    _credsLogged = true;
  }

  return { clientId, clientSecret };
}

// ---------------- Tokens ----------------

/**
 * Creates a standardized error that upstream routes/controllers can detect.
 * The rest of the backend treats code === "REAUTHORIZE" as "user must re-run OAuth flow".
 */
function reauthError(msg = "Fortnox needs re-authorization") {
  const e = new Error(msg);
  e.code = "REAUTHORIZE";
  return e;
}

/**
 * Loads tokens from fortnox_token.json.
 *
 * Behavior:
 * - If token file doesn't exist -> null (treated as not authorized)
 * - If refresh token is missing -> null (cannot recover)
 * - Access token may be empty -> caller will refresh using refresh_token
 */
function loadToken() {
  if (!fs.existsSync(tokenFile)) return null;

  const t = readJsonFile(tokenFile) || {};
  const access = typeof t.access_token === "string" ? t.access_token.trim() : "";
  const refresh = typeof t.refresh_token === "string" ? t.refresh_token.trim() : "";

  // Refresh token is mandatory; without it you cannot refresh silently.
  if (!refresh) return null;

  return { access_token: access || "", refresh_token: refresh };
}

/**
 * Persists tokens to disk.
 */
function saveToken(token) {
  writeJsonFileAtomically(tokenFile, token);
}

// ---------------- Refresh (single-flight) ----------------

/**
 * Single-flight refresh:
 * If multiple requests hit Fortnox at the same time and the access token is expired,
 * you want exactly ONE refresh request running, and all other requests wait for it.
 */
let refreshInFlight = null;

/**
 * Performs the refresh_token request against Fortnox OAuth.
 * Stores the new token on disk.
 *
 * Fortnox may rotate refresh_token; this code preserves the old refresh token if none is returned.
 */
async function doRefreshToken(currentRefreshToken) {
  const { clientId, clientSecret } = getClientCreds();
  const encodedAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://apps.fortnox.se/oauth-v1/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodedAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: currentRefreshToken,
    }),
  });

  const txt = await res.text().catch(() => "");
  if (!res.ok) {
    const e = new Error(`Token refresh failed: ${res.status} ${res.statusText} ${txt}`);
    e._raw = txt;
    throw e;
  }

  const data = JSON.parse(txt || "{}");
  const next = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || currentRefreshToken,
  };

  saveToken(next);
  return next;
}

/**
 * Ensures only one refresh is executed at a time.
 * Everyone else awaits the same promise.
 */
async function refreshTokenSafe(currentRefreshToken) {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        return await doRefreshToken(currentRefreshToken);
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

// ---------------- URL builder ----------------

/**
 * Builds a Fortnox URL for a given endpoint:
 * - If endpoint starts with "api/" => use https://api.fortnox.se/
 * - Otherwise => use https://api.fortnox.se/3/ (v3 API base)
 *
 * Query params are appended using URLSearchParams.
 */
function buildUrl(endpoint, query) {
  const baseUrl = endpoint.startsWith("api/")
    ? "https://api.fortnox.se/"
    : "https://api.fortnox.se/3/";

  const qs = new URLSearchParams(query || {}).toString();
  return `${baseUrl}${endpoint}${qs ? `?${qs}` : ""}`;
}

/**
 * callFortnoxApi(endpoint, query, method, body)
 *
 * The main Fortnox API wrapper used throughout the backend.
 *
 * Responsibilities:
 * - Loads tokens and ensures we have an access token (refreshes if needed)
 * - Builds request URL (base + endpoint + query params)
 * - Adds Fortnox-required headers:
 *   - Authorization: Bearer <access_token>
 *   - Client-Secret: <clientSecret>
 * - Sends request and parses JSON response if possible
 * - Normalizes Fortnox errors into an Error with metadata:
 *   err._status, err._code, err._message, err._data, err._txt, err._url, err._method
 * - If request fails due to auth (401 or specific Fortnox 403 code), auto-refreshes and retries once
 */
export async function callFortnoxApi(endpoint, query = {}, method = "GET", body = null) {
  const { clientSecret } = getClientCreds();
  if (!clientSecret) throw new Error("Missing Client-Secret");

  // Load tokens from disk.
  let tok = loadToken();
  if (!tok) throw reauthError("Missing Fortnox tokens");

  // If access token is missing/empty, attempt refresh using refresh token.
  if (!tok.access_token) tok = await refreshTokenSafe(tok.refresh_token);

  /**
   * Inner request function that uses a provided access token.
   * This makes it easy to retry after refresh without duplicating logic.
   */
  const makeReq = async (accessToken) => {
    const url = buildUrl(endpoint, query);

    // Detect body type:
    // - FormData => send as-is (do not set Content-Type manually)
    // - Plain object => JSON encode it (Content-Type: application/json)
    const isFormData =
      body && method !== "GET" && typeof FormData !== "undefined" && body instanceof FormData;

    const isJsonBody =
      body && method !== "GET" && typeof body === "object" && !isFormData;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Client-Secret": clientSecret,
      Accept: "application/json",
    };

    let reqBody = null;
    if (isFormData) {
      reqBody = body;
    } else if (isJsonBody) {
      headers["Content-Type"] = "application/json";
      reqBody = JSON.stringify(body);
    }

    const res = await fetch(url, { method, headers, body: reqBody });
    const txt = await res.text().catch(() => "");

    // Try to parse JSON regardless of status (Fortnox errors often return JSON).
    const tryParse = () => {
      try {
        return txt ? JSON.parse(txt) : undefined;
      } catch {
        return undefined;
      }
    };
    const data = tryParse();

    if (res.ok) {
      // Fortnox normally returns JSON on success.
      return data ?? {};
    }

    // Extract Fortnox ErrorInformation if present.
    const fxCode =
      data?.ErrorInformation?.code ??
      data?.ErrorInformation?.Code ??
      undefined;

    const fxMessage =
      data?.ErrorInformation?.message ??
      data?.ErrorInformation?.Message ??
      res.statusText ??
      "Fortnox error";

    // Normalize to a consistent error shape for upstream handlers.
    const err = new Error(fxMessage);
    err._status = res.status;
    err._code = fxCode;
    err._message = fxMessage;
    err._data = data;   // parsed response body (may contain ErrorInformation)
    err._txt = txt;     // raw text response
    err._url = url;
    err._method = method;
    err._isFortnox = true;
    throw err;
  };

  try {
    // First attempt with current access token.
    return await makeReq(tok.access_token);
  } catch (e) {
    /**
     * Auto-refresh + retry once when:
     * - 401 Unauthorized
     * - OR 403 with Fortnox-specific code 2000311 (often means token is invalid/expired)
     */
    if (e?._status === 401 || (e?._status === 403 && String(e?._code) === "2000311")) {
      tok = await refreshTokenSafe(tok.refresh_token);
      return await makeReq(tok.access_token);
    }
    throw e;
  }
}

// ==============================
// Short-lived in-memory sessions
// ==============================

/**
 * These session helpers provide a minimal in-memory store with a TTL.
 * Typical use-case: OAuth "state" or transient handshake data between redirects.
 *
 * NOTE:
 * - In-memory store means sessions are lost on server restart and do not scale across instances.
 * - TTL is set to 5 minutes.
 */
const SESS_TTL_MS = 5 * 60 * 1000;
const store = new Map();

/**
 * Creates a session record and returns a random session id (UUID).
 */
export function createSession(payload) {
  const sid = crypto.randomUUID();
  const exp = Date.now() + SESS_TTL_MS;
  store.set(sid, { ...payload, exp });
  return sid;
}

/**
 * Reads a session by id.
 * Automatically expires and deletes it if TTL has passed.
 */
export function getSession(sid) {
  const data = store.get(sid);
  if (!data) return null;

  if (Date.now() > data.exp) {
    store.delete(sid);
    return null;
  }

  return data;
}

/**
 * Reads a session and deletes it immediately (one-time use).
 * Useful for OAuth callbacks where the session should not be reusable.
 */
export function consumeSession(sid) {
  const data = getSession(sid);
  if (data) store.delete(sid);
  return data;
}
