/**
 * JWT helper functions for signing and verifying access & refresh tokens.
 *
 * Uses:
 * - jsonwebtoken
 * - secrets & expiry values from environment variables.
 *
 * Required env vars:
 * - JWT_ACCESS_SECRET
 * - JWT_ACCESS_EXPIRES (e.g. "1h", "15m", "7d")
 * - JWT_REFRESH_SECRET
 * - JWT_REFRESH_EXPIRES (e.g. "7d", "30d")
 */

import jwt from "jsonwebtoken";

// Access token config
const accessSecret = process.env.JWT_ACCESS_SECRET;
const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES || "1h";

// Refresh token config
const refreshSecret = process.env.JWT_REFRESH_SECRET;
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES || "7d";

/**
 * Create a signed JWT access token for a given user.
 *
 * @param {object} payload - Data to include in the token (e.g. user id, tenant, role).
 * @returns {string} Signed JWT string.
 */
export function signAccessToken(payload) {
  if (!accessSecret) {
    throw new Error("JWT_ACCESS_SECRET is not set");
  }

  return jwt.sign(payload, accessSecret, { expiresIn: accessExpiresIn });
}

/**
 * Verify and decode a JWT access token.
 *
 * @param {string} token - Access token string from client.
 * @returns {object} Decoded payload if valid.
 * @throws {Error} If token is invalid or expired.
 */
export function verifyAccessToken(token) {
  if (!accessSecret) {
    throw new Error("JWT_ACCESS_SECRET is not set");
  }

  return jwt.verify(token, accessSecret);
}

/**
 * Create a signed JWT refresh token.
 *
 * @param {object} payload - Minimal data, usually { sub: userId }.
 * @returns {string} Signed JWT string.
 */
export function signRefreshToken(payload) {
  if (!refreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is not set");
  }

  return jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn });
}

/**
 * Verify and decode a JWT refresh token.
 *
 * @param {string} token - Refresh token string from client.
 * @returns {object} Decoded payload if valid.
 * @throws {Error} If token is invalid or expired.
 */
export function verifyRefreshToken(token) {
  if (!refreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is not set");
  }

  return jwt.verify(token, refreshSecret);
}
