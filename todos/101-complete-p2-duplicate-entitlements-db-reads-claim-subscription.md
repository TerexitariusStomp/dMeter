---
status: complete
priority: p2
issue_id: "101"
tags: [code-review, performance, payments]
dependencies: [097]
---

# `claimSubscription` Makes Two Redundant `entitlements.by_userId` Reads

## Problem Statement

`claimSubscription` in `convex/payments/billing.ts` queries `entitlements.by_userId` for `realUserId` twice in the same mutation transaction: once for the (broken) rate-limit check and once for the actual entitlement merge. The first query result is discarded and the same index is queried again.

## Findings

After todo 097 removes the rate-limit block, this duplication becomes irrelevant. However, if a corrected rate-limit is added back later (Option 2 in todo 097), the two reads will exist again unless the result is cached.

**Lines in `convex/payments/billing.ts`:**
- Line ~196-199: `recentEntitlement = ctx.db.query("entitlements").withIndex("by_userId", q => q.eq("userId", realUserId)).first()` (rate-limit check)
- Line ~222-225: Same query again as `existingEntitlement` for the merge logic

The rate-limit query result is structurally identical to the merge query result and can be reused directly.

Agent that identified this: performance-oracle (BLOCKING).

## Proposed Solutions

### Option 1: Reuse the first query result

If the rate-limit guard is replaced with a correct implementation (todo 097, Option 2), pass the first query result into the merge logic:

```ts
const existingEntitlement = await ctx.db
  .query("entitlements")
  .withIndex("by_userId", (q) => q.eq("userId", realUserId))
  .first();

// Rate limit check using existingEntitlement (if dedicated timestamp field added)
if (existingEntitlement?.lastClaimAttemptAt &&
    Date.now() - existingEntitlement.lastClaimAttemptAt < 60_000) {
  throw new Error("Too many claim attempts. Wait 60 seconds before retrying.");
}

// Use existingEntitlement directly in merge logic (no second query)
```

**Effort:** Small
**Risk:** Very low

### Option 2: Defer until rate-limit is finalized (dependency on 097)

If todo 097 removes the rate-limit query entirely, this issue resolves automatically. Track as a dependent cleanup.

**Effort:** None (resolved by 097)

## Recommended Action

Resolve with todo 097. If a corrected rate-limit is added, ensure the first query result is reused.

## Technical Details

- **Affected file:** `convex/payments/billing.ts` — `claimSubscription` handler

## Acceptance Criteria

- [ ] `entitlements.by_userId` for `realUserId` is queried at most once per `claimSubscription` call
- [ ] No behavioral change to merge logic

## Work Log

- 2026-03-30: Identified by performance-oracle during round-4 /ce-review of PR #2024
