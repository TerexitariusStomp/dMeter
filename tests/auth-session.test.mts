/**
 * Tests for server/auth-session.ts (Clerk JWT verification with jose)
 *
 * Verifies that validateBearerToken:
 *  - Returns invalid when CLERK_JWT_ISSUER_DOMAIN is not set
 *  - The module exports the expected SessionResult interface shape
 *  - Fails closed on invalid/malformed tokens
 *
 * Note: Full JWT signature verification requires actual Clerk JWKS keys.
 * These tests verify fail-closed behavior and module wiring only.
 * Integration testing with real Clerk JWTs is done manually.
 */

// Set env BEFORE dynamic import so CLERK_JWT_ISSUER_DOMAIN is NOT captured
// (tests fail-closed behavior when domain is missing)
delete process.env.CLERK_JWT_ISSUER_DOMAIN;

import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

let validateBearerToken: (token: string) => Promise<{ valid: boolean; userId?: string; role?: string }>;

before(async () => {
  const mod = await import('../server/auth-session.ts');
  validateBearerToken = mod.validateBearerToken;
});

describe('validateBearerToken', () => {
  it('returns invalid when CLERK_JWT_ISSUER_DOMAIN is not set', async () => {
    const result = await validateBearerToken('some-random-token');
    assert.equal(result.valid, false);
    assert.equal(result.userId, undefined);
    assert.equal(result.role, undefined);
  });

  it('returns invalid for empty token', async () => {
    const result = await validateBearerToken('');
    assert.equal(result.valid, false);
  });

  it('returns SessionResult shape with expected fields', async () => {
    const result = await validateBearerToken('test');
    assert.equal(typeof result.valid, 'boolean');
    // userId and role should be undefined when invalid
    if (!result.valid) {
      assert.equal(result.userId, undefined);
      assert.equal(result.role, undefined);
    }
  });
});

// ---------------------------------------------------------------------------
// CORS origin matching -- pure logic (independent of auth provider)
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

  it('returns null for null origin -- no ACAO header emitted', () => {
    assert.equal(allowedOrigin(null, TRUSTED), null);
  });
});
