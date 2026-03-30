---
status: pending
priority: p3
issue_id: "113"
tags: [code-review, quality, payments]
dependencies: []
---

# `handlePaymentEvent` / `handleRefundEvent` Duplication + `handleDisputeEvent` Inlines `upsertEntitlements`

## Problem Statement

Three simplification opportunities in `convex/payments/subscriptionHelpers.ts`:

1. `handlePaymentEvent` and `handleRefundEvent` (lines 522-575) are ~27-line functions differing only in `type: "charge"` vs `type: "refund"` and the status field prefix. This is copy-paste that will diverge.
2. `handleDisputeEvent`'s `dispute.lost` block (lines 619-647) manually patches the entitlement table and hand-rolls a `ctx.scheduler.runAfter` — identical logic already exists in `upsertEntitlements`. Should call `upsertEntitlements(ctx, userId, "free", eventTimestamp)` instead.
3. `getFeaturesForPlan("free")` is called twice in the `dispute.lost` block. Should be captured once as `const freeFeatures = getFeaturesForPlan("free")`.

## Findings

- `subscriptionHelpers.ts:522-575` — near-identical payment/refund handlers
- `subscriptionHelpers.ts:619-647` — inline entitlement revocation duplicating `upsertEntitlements`
- `subscriptionHelpers.ts:631,642` — double `getFeaturesForPlan("free")` call
- Identified by: code-simplicity-reviewer (round-6 review)
- Estimated LOC savings: ~45 lines

## Proposed Solutions

### Option 1: Merge payment/refund handlers + call upsertEntitlements

```ts
async function handlePaymentOrRefundEvent(
  ctx: MutationCtx,
  data: DodoPaymentData,
  eventType: string,
  timestamp: number,
): Promise<void> {
  const recordType = eventType.startsWith("refund") ? "refund" : "charge";
  // ... single implementation
}
```

For `dispute.lost`, replace the inline block with:
```ts
await upsertEntitlements(ctx, userId, "free", eventTimestamp);
```

**Effort:** Small (~1 hour)
**Risk:** Low — behavior-preserving refactor

## Recommended Action

Option 1.

## Technical Details

**Affected files:**
- `convex/payments/subscriptionHelpers.ts:522-575` — merge two functions
- `convex/payments/subscriptionHelpers.ts:619-647` — replace inline with `upsertEntitlements` call

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** code-simplicity-reviewer

## Acceptance Criteria

- [ ] `handlePaymentEvent` and `handleRefundEvent` merged into single function
- [ ] `dispute.lost` block calls `upsertEntitlements` instead of inline patch
- [ ] `vitest run` passes
- [ ] No behavior change

## Work Log

### 2026-03-31 - Identified (round-6 review)
