/**
 * Tests for server/auth-session.ts + CORS origin matching from convex/http.ts
 *
 * Verifies that validateBearerToken:
 *  - Calls the authenticated /api/user-role endpoint (not the public query API)
 *  - Returns valid session with role on success
 *  - Fails closed to 'free' when role fetch fails
 *  - Returns invalid on bad/missing session
 */

// Set env BEFORE dynamic import so CONVEX_SITE_URL is captured at module load
process.env.CONVEX_SITE_URL = 'https://valiant-bison-406.convex.site';

import assert from 'node:assert/strict';
import { describe, it, before, afterEach } from 'node:test';

const SITE_URL = process.env.CONVEX_SITE_URL!;

// ---------------------------------------------------------------------------
// Module loaded after env var is set
// ---------------------------------------------------------------------------

let validateBearerToken: (token: string) => Promise<{ valid: boolean; userId?: string; role?: string }>;

before(async () => {
  const mod = await import('../server/auth-session.ts');
  validateBearerToken = mod.validateBearerToken;
});

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

const fetchCalls: Array<{ url: string; method: string; authHeader: string | undefined }> = [];
let _originalFetch: typeof globalThis.fetch;

function installFetchMock(responses: Record<string, { ok: boolean; body: unknown }>) {
  _originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const hdrs = (init?.headers ?? {}) as Record<string, string>;
    const authHeader = hdrs['Authorization'] ?? hdrs['authorization'];
    fetchCalls.push({ url: String(url), method, authHeader });

    const match = responses[String(url)];
    if (!match) {
      // Return un-parseable body to exercise catch blocks
      return new Response('Not found', { status: 404 });
    }
    return new Response(JSON.stringify(match.body), {
      status: match.ok ? 200 : 401,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

function uninstallFetchMock() {
  (globalThis as any).fetch = _originalFetch;
  fetchCalls.length = 0;
}

// Use unique tokens per test so the in-module session cache never interferes
let tokenCounter = 0;
function freshToken() {
  return `test-token-${++tokenCounter}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Tests — validateBearerToken
// ---------------------------------------------------------------------------

describe('validateBearerToken', () => {
  afterEach(uninstallFetchMock);

  it('returns valid session with role from get-session response', async () => {
    const token = freshToken();
    installFetchMock({
      [`${SITE_URL}/api/auth/get-session`]: {
        ok: true,
        body: { user: { id: 'user-1', role: 'pro' } },
      },
    });

    const result = await validateBearerToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.userId, 'user-1');
    assert.equal(result.role, 'pro');

    const call = fetchCalls.find((c) => c.url.includes('/api/auth/get-session'));
    assert.ok(call);
    assert.equal(call!.authHeader, `Bearer ${token}`);
  });

  it('falls back to /api/user-role (not public /api/query) when role absent from get-session', async () => {
    const token = freshToken();
    installFetchMock({
      [`${SITE_URL}/api/auth/get-session`]: {
        ok: true,
        body: { user: { id: 'user-2' } }, // no role field
      },
      [`${SITE_URL}/api/user-role`]: {
        ok: true,
        body: { role: 'pro' },
      },
    });

    const result = await validateBearerToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.role, 'pro');

    const roleCall = fetchCalls.find((c) => c.url.includes('/api/user-role'));
    assert.ok(roleCall, 'Should call /api/user-role');
    assert.equal(roleCall!.method, 'POST');
    assert.equal(roleCall!.authHeader, `Bearer ${token}`);

    const publicQueryCall = fetchCalls.find((c) => c.url.includes('/api/query'));
    assert.equal(publicQueryCall, undefined, 'Must NOT call public /api/query');
  });

  it('fails closed to free when /api/user-role fetch fails', async () => {
    const token = freshToken();
    installFetchMock({
      [`${SITE_URL}/api/auth/get-session`]: {
        ok: true,
        body: { user: { id: 'user-3' } }, // no role — triggers fallback
      },
      // /api/user-role not in map → 404 with non-JSON body → JSON parse throws → caught → free
    });

    const result = await validateBearerToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.role, 'free');
  });

  it('returns invalid when get-session returns non-ok', async () => {
    const token = freshToken();
    installFetchMock({
      [`${SITE_URL}/api/auth/get-session`]: { ok: false, body: { error: 'Unauthorized' } },
    });

    const result = await validateBearerToken(token);
    assert.equal(result.valid, false);
  });

  it('returns invalid when get-session has no user.id', async () => {
    const token = freshToken();
    installFetchMock({
      [`${SITE_URL}/api/auth/get-session`]: { ok: true, body: {} },
    });

    const result = await validateBearerToken(token);
    assert.equal(result.valid, false);
  });
});

// ---------------------------------------------------------------------------
// CORS origin matching — pure logic extracted from convex/http.ts
// ---------------------------------------------------------------------------

describe('CORS origin matching (convex/http.ts)', () => {
  function matchOrigin(origin: string, pattern: string): boolean {
    if (pattern.startsWith('*.')) {
      return origin.endsWith(pattern.slice(1));
    }
    return origin === pattern;
  }

  function allowedOrigin(origin: string | null, trusted: string[]): string | null {
    if (!origin) return null;
    return trusted.some((p) => matchOrigin(origin, p)) ? origin : null;
  }

  const TRUSTED = [
    'https://worldmonitor.app',
    '*.worldmonitor.app',
    'http://localhost:3000',
  ];

  it('allows exact match', () => {
    assert.equal(allowedOrigin('https://worldmonitor.app', TRUSTED), 'https://worldmonitor.app');
  });

  it('allows wildcard subdomain', () => {
    const origin = 'https://preview-xyz.worldmonitor.app';
    assert.equal(allowedOrigin(origin, TRUSTED), origin);
  });

  it('allows localhost', () => {
    assert.equal(allowedOrigin('http://localhost:3000', TRUSTED), 'http://localhost:3000');
  });

  it('blocks unknown origin', () => {
    assert.equal(allowedOrigin('https://evil.com', TRUSTED), null);
  });

  it('blocks partial domain match', () => {
    assert.equal(allowedOrigin('https://attackerworldmonitor.app', TRUSTED), null);
  });

  it('returns null for null origin — no ACAO header emitted', () => {
    assert.equal(allowedOrigin(null, TRUSTED), null);
  });
});
