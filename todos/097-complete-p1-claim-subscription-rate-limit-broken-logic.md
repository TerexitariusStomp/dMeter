---
status: complete
priority: p1
issue_id: "097"
tags: [code-review, payments, security, rate-limiting]
dependencies: [090]
---

# `claimSubscription` Rate Limit Has Broken Logic — Bypassed for New Users, False Positive on Renewals

## Problem Statement

The rate limit implemented in `claimSubscription` (todo 090 fix) has three distinct logic errors that make it simultaneously ineffective for the cases it is meant to protect and harmful for legitimate use.

## Findings

### Error 1: Bypassed entirely for new users (the exact attack case)
`convex/payments/billing.ts` lines 196-202 query `entitlements.by_userId` for `realUserId`. New users making their first claim have no entitlement row. `recentEntitlement` is `null`, the condition short-circuits to `null?.updatedAt === undefined`, and the rate limit never fires — for anyone who is calling `claimSubscription` for the first time, which is the only case that matters.

### Error 2: False positive on subscription renewals
`entitlements.updatedAt` is patched by every webhook event (renewals, plan changes, trial activations). If a subscription renewal fires within 60 seconds of a user signing in, `claimSubscription` throws "Too many claim attempts" for a completely legitimate sign-in claim. The rate limit timestamp conflates two unrelated events: subscription lifecycle updates vs. user-initiated claim operations.

### Error 3: Concurrent calls race past it
The check is not an atomic compare-and-set. Two concurrent `claimSubscription` calls both read `null` (no entitlement) and both proceed. Convex serializes mutations within a deployment, so actual DB writes are safe, but the rate limit provides no protection against parallel inflight calls that both pass the null-check simultaneously.

Agents that identified this: security-sentinel (BLOCKING), performance-oracle (BLOCKING), architecture-strategist (BLOCKING), code-simplicity-reviewer (BLOCKING).

## Proposed Solutions

### Option 1: Remove the broken guard (recommended for now)
Remove the `recentEntitlement` rate-limit query entirely. The mutation is already idempotent (records already migrated are skipped). The risk of abuse is bounded by the fact that `claimSubscription` only reassigns records that exist under the `anonId` — a user has nothing to gain from calling it repeatedly with the same `anonId` once the records are claimed.

**Pros:** Eliminates the false-positive blocks; removes 2 DB reads; no new infrastructure needed
**Cons:** No protection against rapid repeated calls with different anonIds

**Effort:** Small
**Risk:** Low

### Option 2: Dedicated claim-attempt timestamp field on entitlements
Add a `lastClaimAttemptAt?: number` field to the entitlements schema. In `claimSubscription`, after `requireUserId`, query the user's real-user entitlement row. If `lastClaimAttemptAt` exists and `Date.now() - lastClaimAttemptAt < 60_000`, throw. Always write `lastClaimAttemptAt = Date.now()` at the end of the handler (even on no-op claims).

**Pros:** Correct semantics — rate limits claim attempts specifically
**Cons:** Schema change required; migration needed if entitlements already exist in production

**Effort:** Medium
**Risk:** Medium

### Option 3: `@convex-dev/ratelimiter`
Use the Convex ratelimiter component. Not in package.json; requires adding the dependency.

**Pros:** Purpose-built, correct
**Cons:** New dependency; overkill for this use case

**Effort:** Medium
**Risk:** Low

## Recommended Action

Option 1 (remove the guard) for the immediate fix. The guard is actively harmful. The mutation is idempotent and a claimed subscription cannot be re-claimed. Add Option 2 if abuse is observed in production metrics.

## Technical Details

- **Affected file:** `convex/payments/billing.ts` lines 196-202
- Remove the `recentEntitlement` query and the `if (recentEntitlement?.updatedAt ...)` block
- The query at line 222 (`existingEntitlement`) for the actual merge logic is still needed and should remain

## Acceptance Criteria

- [ ] `recentEntitlement` rate-limit query removed from `claimSubscription`
- [ ] Users with no prior entitlement can call `claimSubscription` without any "rate limit" error
- [ ] A subscription renewal webhook does not cause `claimSubscription` to throw on the next sign-in
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes

## Work Log

- 2026-03-30: Identified by security-sentinel, performance-oracle, architecture-strategist, code-simplicity-reviewer during round-4 /ce-review of PR #2024
