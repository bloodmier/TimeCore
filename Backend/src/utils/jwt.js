/**
 * JWT helper functions for signing and verifying access tokens.
 *
 * Uses:
 * - jsonwebtoken
 * - secrets & expiry values from environment variables.
 *
 * Required env vars:
 * - JWT_ACCESS_SECRET
 * - JWT_ACCESS_EXPIRES (e.g. "1h", "15m", "7d")
 */

import jwt from "jsonwebtoken";

/**
 * Create a signed JWT access token for a given user.
 *
 * @param {object} payload - Data to include in the token (e.g. user id, tenant, role).
 * @returns {string} Signed JWT string.
 */
export function signAccessToken(payload) {
  const secret = process.env.JWT_ACCESS_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRES || "1h";

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set");
  }

  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify and decode a JWT access token.
 *
 * @param {string} token - Access token string from client.
 * @returns {object} Decoded payload if valid.
 * @throws {Error} If token is invalid or expired.
 */
export function verifyAccessToken(token) {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set");
  }

  return jwt.verify(token, secret);
}
