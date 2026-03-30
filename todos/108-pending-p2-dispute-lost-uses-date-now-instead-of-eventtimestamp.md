---
status: pending
priority: p2
issue_id: "108"
tags: [code-review, payments, data-integrity]
dependencies: []
---

# `dispute.lost` Revocation Uses `Date.now()` Instead of `eventTimestamp`

## Problem Statement

In `handleDisputeEvent`, when `dispute.lost` fires and revokes the user's entitlement, the code calls `Date.now()` three separate times for `validUntil`, `updatedAt`, and the Redis cache sync args. Every other handler in `subscriptionHelpers.ts` consistently uses `eventTimestamp` (the webhook timestamp) for these fields — specifically to support the out-of-order event guard `isNewerEvent`. Using `Date.now()` in the dispute.lost block breaks this protection: a later-replayed older event with a smaller `timestamp` will pass the `isNewerEvent` check and overwrite the revocation with restored entitlements. For a chargeback scenario, this is a meaningful correctness gap — paid access could be unintentionally restored.

## Findings

- `convex/payments/subscriptionHelpers.ts:638-649` — three `Date.now()` calls in `dispute.lost` block
- All other handlers use `eventTimestamp` parameter passed to `handleDisputeEvent`
- Identified by: kieran-typescript-reviewer + architecture-strategist (round-6)

## Proposed Solutions

### Option 1: Capture `eventTimestamp` once, use consistently

```ts
const now = eventTimestamp; // consistent with all other handlers
await ctx.db.patch(existing._id, {
  planKey: "free",
  features: getFeaturesForPlan("free"),
  validUntil: now,
  updatedAt: now,
});
// ...scheduler...
  validUntil: now,
```

**Effort:** 2 minutes
**Risk:** None

## Recommended Action

Option 1. Replace all three `Date.now()` calls with `eventTimestamp`.

## Technical Details

**Affected files:**
- `convex/payments/subscriptionHelpers.ts:638,639,649` — replace `Date.now()` with `eventTimestamp`

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** kieran-typescript-reviewer, architecture-strategist

## Acceptance Criteria

- [ ] All `Date.now()` calls in `dispute.lost` block replaced with `eventTimestamp`
- [ ] A replayed older event after `dispute.lost` does NOT restore entitlements
- [ ] `vitest run` passes

## Work Log

### 2026-03-31 - Identified (round-6 review)
