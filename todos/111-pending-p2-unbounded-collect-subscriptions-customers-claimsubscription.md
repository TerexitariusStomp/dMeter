---
status: pending
priority: p2
issue_id: "111"
tags: [code-review, payments, performance]
dependencies: []
---

# Unbounded `.collect()` on `subscriptions` and `customers` in `claimSubscription`

## Problem Statement

`claimSubscription` in `convex/payments/billing.ts` uses `.collect()` (unbounded) on both `subscriptions` and `customers` queries for the `anonId`. The `paymentEvents` query was already bounded with `.take(1000)` in the previous fix round, but `subscriptions` and `customers` remain unbounded. A pathological anonymous session with many subscription rows (e.g. from retry loops or test data) would load all of them in a single mutation transaction.

Additionally, all four reads (subscriptions, entitlement, customers, paymentEvents) are sequential when they could be parallelized with `Promise.all`, reducing mutation latency by ~3 round trips.

## Findings

- `convex/payments/billing.ts:206-210` — `subscriptions` query uses `.collect()` (unbounded)
- `convex/payments/billing.ts:261-264` — `customers` query uses `.collect()` (unbounded)
- `paymentEvents` already uses `.take(1000)` (fixed in previous round)
- All four reads are sequential; only entitlement read depends on anonId entitlement result
- Identified by: kieran-typescript-reviewer + performance-oracle (round-6)

## Proposed Solutions

### Option 1: Bound + parallelize

```ts
const [subs, anonEntitlement, customers, payments] = await Promise.all([
  ctx.db.query("subscriptions").withIndex("by_userId", q => q.eq("userId", args.anonId)).take(50),
  ctx.db.query("entitlements").withIndex("by_userId", q => q.eq("userId", args.anonId)).first(),
  ctx.db.query("customers").withIndex("by_userId", q => q.eq("userId", args.anonId)).take(10),
  ctx.db.query("paymentEvents").withIndex("by_userId", q => q.eq("userId", args.anonId)).take(1000),
]);
```

Then handle the conditional real-user entitlement lookup after.

**Effort:** Small
**Risk:** Low — `.take(50)` matches `getSubscriptionForUser`; `.take(10)` is conservative for customers

## Recommended Action

Option 1.

## Technical Details

**Affected files:**
- `convex/payments/billing.ts:206-275` — add bounds + `Promise.all` for independent reads

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** kieran-typescript-reviewer, performance-oracle

## Acceptance Criteria

- [ ] `subscriptions` query uses `.take(50)`
- [ ] `customers` query uses `.take(10)`
- [ ] Independent reads parallelized with `Promise.all`
- [ ] `vitest run` passes

## Work Log

### 2026-03-31 - Identified (round-6 review)
