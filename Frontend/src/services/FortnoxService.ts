// src/services/fortnox.ts
/**
 * FortnoxService
 *
 * Frontend service responsible for interacting with Fortnox-related backend endpoints.
 *
 * Responsibilities:
 * - Check Fortnox connection status for the current admin session
 * - Initiate a Fortnox OAuth session (used for re-authentication flows)
 *
 * Important notes:
 * - Authentication is fully cookie-based; no access tokens are handled in the frontend
 * - Session refresh and retry logic is handled centrally by the Axios interceptor
 * - This service only communicates with the backend API, never directly with Fortnox
 *
 * The backend is the single source of truth for:
 * - Fortnox credentials
 * - OAuth tokens
 * - Session state and expiration handling
 */

import { getData, postData } from "../services/basicservice";

export type FortnoxStatus = {
  needsReauth: boolean;
};

export const FortnoxService = {
  /**
   * Fetch the current Fortnox connection status.
   *
   * Used by admin views to determine whether the user needs to
   * re-authenticate Fortnox before performing invoice operations.
   */
  getStatus: () =>
    getData<FortnoxStatus>("/fortnox/status"),

  /**
   * Create a short-lived Fortnox OAuth session on the backend.
   *
   * The returned session id (sid) is typically used to construct
   * a redirect URL or popup flow for Fortnox re-authentication.
   *
   * Throws if the backend fails to create a session.
   */
  createOAuthSession: async (): Promise<string> => {
    const res = await postData<{ sid?: string }>("/fortnox/oauth/session");

    if (!res?.sid) {
      throw new Error("No session id returned from Fortnox OAuth session endpoint");
    }

    return res.sid;
  },
};
