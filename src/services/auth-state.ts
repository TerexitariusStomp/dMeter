import { authClient } from './auth-client';
import { getSessionBearerToken } from './auth-token';

/** Minimal user profile exposed to UI components. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: 'free' | 'pro';
}

/** Simplified auth session state for UI consumption. */
export interface AuthSession {
  user: AuthUser | null;
  isPending: boolean;
}

// ---------------------------------------------------------------------------
// Raw session types — typed boundary for the better-auth nanostore atom
// ---------------------------------------------------------------------------

interface RawSessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface RawSessionValue {
  data?: { user?: RawSessionUser } | null;
  isPending?: boolean;
}

// ---------------------------------------------------------------------------
// Role fetching via authenticated /api/user-role Convex HTTP action
// ---------------------------------------------------------------------------

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;

let cachedRole: 'free' | 'pro' = 'free';
let cachedRoleUserId: string | null = null;

/**
 * Fetch the user's role from the authenticated /api/user-role endpoint.
 * Falls back to "free" on any non-abort error. AbortError is propagated.
 */
async function fetchUserRole(signal?: AbortSignal): Promise<'free' | 'pro'> {
  if (!CONVEX_SITE_URL) return 'free';

  const token = getSessionBearerToken();
  if (!token) return 'free';

  try {
    const resp = await fetch(`${CONVEX_SITE_URL}/api/user-role`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
    });
    const data = await resp.json();
    const role: 'free' | 'pro' = data.role === 'pro' ? 'pro' : 'free';
    cachedRole = role;
    return role;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return 'free';
  }
}

// ---------------------------------------------------------------------------
// Helpers to map raw session data to AuthUser
// ---------------------------------------------------------------------------

function mapRawUser(rawUser: RawSessionUser): AuthUser {
  return {
    id: rawUser.id,
    name: rawUser.name,
    email: rawUser.email,
    image: rawUser.image ?? null,
    role: cachedRole,
  };
}

// ---------------------------------------------------------------------------
// TOCTOU guard for async role fetches
// ---------------------------------------------------------------------------

let _roleGeneration = 0;
let _roleAbortController: AbortController | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call once at app startup, before any UI subscribes to auth state.
 * Hydrates session from localStorage or OTT redirect, then pre-warms role cache.
 */
export async function initAuthState(): Promise<void> {
  const url = new URL(window.location.href);
  const ottToken = url.searchParams.get('ott');

  if (ottToken) {
    url.searchParams.delete('ott');
    window.history.replaceState({}, '', url.toString());

    try {
      const result = await (authClient as any).crossDomain.oneTimeToken.verify({ token: ottToken });
      const session = result?.data?.session;

      if (session) {
        await authClient.getSession({
          fetchOptions: {
            headers: { Authorization: `Bearer ${session.token}` },
          },
        });
        (authClient as any).updateSession?.();
      }
    } catch (err) {
      console.warn('[auth-state] OTT verification failed:', err);
    }
  } else {
    try {
      await authClient.getSession();
    } catch (err) {
      console.warn('[auth-state] Session hydration failed:', err);
    }
  }

  const raw = authClient.useSession.get() as RawSessionValue;
  if (raw.data?.user?.id) {
    await fetchUserRole();
    cachedRoleUserId = raw.data.user.id;
  }
}

/**
 * Subscribe to reactive auth state changes.
 * Fixes TOCTOU race via generation counter + AbortController: rapid sign-in/sign-out
 * cannot produce a stale role for the wrong user.
 *
 * @returns Unsubscribe function.
 */
export function subscribeAuthState(callback: (state: AuthSession) => void): () => void {
  return authClient.useSession.subscribe((value) => {
    const raw = value as RawSessionValue;
    const rawUser = raw.data?.user;

    // Abort any in-flight role fetch from a previous event
    _roleAbortController?.abort();
    _roleAbortController = null;

    if (!rawUser) {
      _roleGeneration++;
      cachedRole = 'free';
      cachedRoleUserId = null;
      callback({ user: null, isPending: raw.isPending ?? false });
      return;
    }

    // User changed (A→B direct switch): reset cached role BEFORE emitting
    // so user B is never shown user A's role even briefly
    const userChanged = rawUser.id !== cachedRoleUserId;
    if (userChanged) {
      cachedRole = 'free';
      cachedRoleUserId = rawUser.id;
    }

    callback({
      user: mapRawUser(rawUser),
      isPending: raw.isPending ?? false,
    });

    if (userChanged) {
      const gen = ++_roleGeneration;
      const ac = new AbortController();
      _roleAbortController = ac;

      fetchUserRole(ac.signal).then((role) => {
        if (gen !== _roleGeneration) return; // stale — discard
        if (role !== cachedRole || rawUser.id !== cachedRoleUserId) {
          cachedRole = role;
          cachedRoleUserId = rawUser.id;
          callback({
            user: mapRawUser(rawUser),
            isPending: raw.isPending ?? false,
          });
        }
      }).catch((err) => {
        if (err?.name === 'AbortError') return; // expected during rapid auth transitions
        console.warn('[auth-state] Role fetch failed:', err);
      });
    }
  });
}

/**
 * Synchronous snapshot of the current auth state.
 * Role uses the last cached value; defaults to "free" if not yet fetched.
 */
export function getAuthState(): AuthSession {
  const raw = authClient.useSession.get() as RawSessionValue;
  return {
    user: raw.data?.user ? mapRawUser(raw.data.user) : null,
    isPending: raw.isPending ?? false,
  };
}
