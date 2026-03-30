---
status: pending
priority: p1
issue_id: "104"
tags: [code-review, security, auth]
dependencies: []
---

# JWT Verification Missing `algorithms: ['RS256']` — `alg:none` Bypass Risk

## Problem Statement

`server/auth-session.ts` calls `jwtVerify(token, jwks, { issuer, audience })` without an `algorithms` field. Clerk issues RS256 tokens. Without pinning the algorithm, some versions of `jose` will accept tokens with `alg: none` or `alg: HS256`, bypassing signature verification entirely. This is in the direct path for Vercel edge gateway entitlement enforcement — a bypass here means an attacker can craft a JWT with any `sub` claim and access any tier-gated endpoint.

## Findings

- `server/auth-session.ts:35` — `jwtVerify` has no `algorithms` option
- Identified in existing todo #035 (pending P1)
- The entitlement enforcement path in `server/gateway.ts` → `resolveSessionUserId` → `verifyClerkToken` → `jwtVerify` is the critical path

## Proposed Solutions

### Option 1: Add `algorithms: ['RS256']` to `jwtVerify` options

```ts
const { payload } = await jwtVerify(token, jwks, {
  issuer: issuerDomain,
  audience: undefined,
  algorithms: ['RS256'],
});
```

**Effort:** 2 minutes
**Risk:** None — Clerk always issues RS256

## Recommended Action

Option 1. One-line fix. Zero risk.

## Technical Details

**Affected files:**
- `server/auth-session.ts` — add `algorithms: ['RS256']` to `jwtVerify` options

## Resources

- **PR:** koala73/worldmonitor#2024
- **Prior todo:** `todos/035-pending-p1-jwtverify-missing-algorithms-allowlist.md`
- **Identified by:** learnings-researcher + security-sentinel

## Acceptance Criteria

- [ ] `jwtVerify` call includes `algorithms: ['RS256']`
- [ ] Tokens with `alg: none` are rejected
- [ ] `tsc --noEmit` + `vitest run` pass

## Work Log

### 2026-03-31 - Identified (round-6 review)
