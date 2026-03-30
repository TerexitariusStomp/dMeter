---
status: complete
priority: p1
issue_id: "107"
tags: [code-review, architecture, payments, data-integrity]
dependencies: []
---

# Concurrent Webhook Events Can Produce Duplicate `entitlements` Rows

## Problem Statement

`upsertEntitlements` in `convex/payments/subscriptionHelpers.ts` performs a read-check-then-write. Two concurrent Convex mutations operating on different `subscriptions` documents for the same userId can both observe zero entitlement rows and both `ctx.db.insert()`. Convex has no uniqueness constraint on the `entitlements.by_userId` index — duplicate rows are possible.

`getEntitlementsForUser` uses `.first()` (not `.unique()`) so it won't throw, but which row wins is non-deterministic. A paying user's active plan might be shadowed by a stale duplicate row.

## Findings

- `convex/payments/subscriptionHelpers.ts:63-107` — read-then-write without uniqueness guarantee
- `convex/schema.ts:129-142` — no unique index annotation on `entitlements` table
- Narrow window but structurally present: `subscription.active` + `payment.succeeded` for same user can both call `upsertEntitlements` concurrently
- Test `convex/__tests__/entitlements.test.ts:134` confirms query survives duplicates but does not assert which row wins
- Identified by: architecture-strategist (round-6 review)

## Proposed Solutions

### Option 1: Application-level deduplication guard in `upsertEntitlements`

Before inserting, check again inside the mutation using `.first()`. If a row already exists by the time we reach the insert branch, patch it instead. This is safe because Convex mutations are serialized — the second one will see the first one's write.

The current code already does this check, but the race window is between the initial `.first()` returning null and the subsequent `insert`. Since Convex mutations are serialized *per document*, two mutations on different documents can race. The fix is to use a single Convex mutation that handles both cases atomically with `.withIndex("by_userId").first()` re-checked at write time (Convex's OCC will retry on conflict).

**Effort:** Small
**Risk:** Low

### Option 2: Post-insert deduplication cleanup job

Schedule a cleanup action that periodically merges duplicate `entitlements` rows, keeping the one with the highest tier/latest `validUntil`.

**Effort:** Medium
**Risk:** Low (can run alongside the fix from Option 1)

## Recommended Action

Option 1: Add a second `.first()` check immediately before insert in `upsertEntitlements`, and add a comment documenting the race window and Convex's OCC protection.

## Technical Details

**Affected files:**
- `convex/payments/subscriptionHelpers.ts:63-107` — add post-read re-check before insert
- `convex/schema.ts` — add comment that Convex doesn't support unique indexes natively

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** architecture-strategist

## Acceptance Criteria

- [ ] `upsertEntitlements` re-checks for existing row immediately before inserting
- [ ] Concurrent duplicate webhook events for same userId result in exactly one entitlement row
- [ ] Test added: seed duplicate rows, process `subscription.active`, verify single row result

## Work Log

### 2026-03-31 - Identified (round-6 review)
