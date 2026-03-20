/**
 * Utility to extract the better-auth session token from the crossDomainClient's
 * localStorage storage. Used by the web fetch redirect to attach Bearer tokens
 * to premium API requests.
 */

/** localStorage key used by the crossDomainClient plugin to persist cookies. */
const COOKIE_STORAGE_KEY = 'better-auth_cookie';

/** Key within the parsed cookie JSON that holds the session token. */
const SESSION_TOKEN_KEY = 'better-auth.session_token';

// WARNING: Depends on internal localStorage shape of better-auth's crossDomainClient plugin.
// Verified against better-auth@1.5.5 + @convex-dev/better-auth@0.11.2.
// If better-auth changes storage format, this silently returns null.
// Verify after any version upgrade.

/**
 * Read the better-auth session token from the crossDomainClient localStorage
 * cookie storage. Returns the raw token string suitable for a Bearer header,
 * or null if no valid session exists.
 */
export function getSessionBearerToken(): string | null {
  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<
      string,
      { value: string; expires?: string | null }
    >;
    const entry = parsed[SESSION_TOKEN_KEY];
    if (!entry?.value) return null;

    // Reject expired tokens
    if (entry.expires && new Date(entry.expires) < new Date()) return null;

    return entry.value;
  } catch {
    return null;
  }
}
