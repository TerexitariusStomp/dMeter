---
status: complete
priority: p1
issue_id: "103"
tags: [code-review, security, payments]
dependencies: []
---

# `_debug` Object in `validateApiKey` Leaks All Valid API Keys

## Problem Statement

`api/_api-key.js` returns a `_debug` object on invalid key attempts that contains `envVarRaw` (the raw `WORLDMONITOR_VALID_KEYS` value) and `parsedKeys` (every valid key as a parsed array). Although the gateway currently only surfaces `keyCheck.error` (a string) in the HTTP response, the full `_debug` object is held in `keyCheck` in memory. Any future logging middleware, error reporter, or Sentry breadcrumb that serializes `keyCheck` would leak ALL valid API keys to external observers.

This is one refactor away from a full key disclosure incident.

## Findings

- `api/_api-key.js:59-65` — `_debug` object contains `envVarRaw`, `parsedKeys`, `receivedKey`, `receivedKeyLen`, `envVarLen`
- `server/gateway.ts` currently only propagates `keyCheck.error` (string) to HTTP response — leakage is latent, not immediate
- Identified by: security-sentinel (round-6 review)

## Proposed Solutions

### Option 1: Delete the `_debug` block entirely

**Approach:** Remove lines 59-65 from `api/_api-key.js`. The function returns only `{ valid, required, error }`.

**Pros:** Eliminates risk entirely. Simple change.
**Cons:** Loses diagnostic data (not meaningful — logs should not contain secrets anyway).
**Effort:** 5 minutes
**Risk:** None

### Option 2: Gate `_debug` behind `ENABLE_KEY_DEBUG=true` env var

**Approach:** Only attach `_debug` when `process.env.ENABLE_KEY_DEBUG === 'true'`. Never set this in production.

**Pros:** Preserves debug capability for local development.
**Cons:** Env var must never be set in production; adds a conditional that could be mistakenly enabled.
**Effort:** 10 minutes
**Risk:** Low (if the env var discipline holds)

## Recommended Action

Option 1. Delete the `_debug` block. No diagnostic value justifies storing all valid API keys in a runtime object.

## Technical Details

**Affected files:**
- `api/_api-key.js:59-65` — remove `_debug` block

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** security-sentinel, round-6 review 2026-03-31

## Acceptance Criteria

- [ ] `_debug` block removed from `validateApiKey` return value
- [ ] `validateApiKey` still returns `{ valid, required, error }` for invalid key cases
- [ ] `tsc --noEmit` + `vitest run` pass

## Work Log

### 2026-03-31 - Identified

**By:** security-sentinel (round-6 /ce-review)

- Latent high — not in HTTP response today but one logging-middleware addition away from full disclosure
