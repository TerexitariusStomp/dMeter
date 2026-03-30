---
status: pending
priority: p1
issue_id: "099"
tags: [code-review, payments, performance]
dependencies: [088]
---

# `wm-anon-id` Not Cleared on All Claim Success Paths — Fires Convex Cold Init on Every Sign-In

## Problem Statement

`localStorage.removeItem('wm-anon-id')` in `src/App.ts` is only called when `result.claimed.subscriptions > 0 || result.claimed.entitlements > 0`. Users whose anon session had purchases stored only as `customers` or `paymentEvents` rows (not subscriptions or entitlements), or users who browsed anonymously without purchasing, will never have `wm-anon-id` removed. Their key stays in `localStorage` forever, and every subsequent sign-in re-triggers `Promise.all([getConvexClient(), getConvexApi()])` → Convex WebSocket cold-open → `claimSubscription` mutation.

## Findings

**Current code (`src/App.ts` lines 804-807):**
```ts
if (result.claimed.subscriptions > 0 || result.claimed.entitlements > 0) {
  console.log('[billing] Claimed anon subscription on sign-in:', result.claimed);
  localStorage.removeItem('wm-anon-id');
}
```

**Scenario 1 — Non-purchasing user:** User visits site (anon ID set), never buys, creates an account. `claimSubscription` runs, finds nothing, returns `{ claimed: { subscriptions: 0, entitlements: 0, customers: 0, payments: 0 } }`. `wm-anon-id` is NOT removed. Every future sign-in runs the full claim mutation.

**Scenario 2 — Partial claim:** If subscriptions and entitlements are already migrated in a previous session but `customers` or `paymentEvents` records remain under the anon ID, `claimSubscription` returns `{ subscriptions: 0, entitlements: 0, customers: 1, payments: N }`. The anon ID is NOT removed.

**Performance impact:** Each "wasted" `claimSubscription` call on a non-purchasing user:
1. Calls `Promise.all([getConvexClient(), getConvexApi()])` — potentially 2 dynamic imports + WebSocket connection init
2. Makes a Convex mutation call over the wire
3. Executes 5 DB reads inside the mutation (rate-limit + subscription + entitlement + customer + payment queries)

This happens on EVERY sign-in for the lifetime of the browser session.

Agent that identified this: performance-oracle (BLOCKING), code-simplicity-reviewer (BLOCKING), architecture-strategist.

## Proposed Solutions

### Option 1: Remove `wm-anon-id` after any non-throwing completion (recommended)

```ts
void Promise.all([getConvexClient(), getConvexApi()])
  .then(async ([client, api]) => {
    const result = await client.mutation(api.payments.billing.claimSubscription, { anonId });
    const claimed = result?.claimed;
    const totalClaimed = (claimed?.subscriptions ?? 0) + (claimed?.entitlements ?? 0) +
                         (claimed?.customers ?? 0) + (claimed?.payments ?? 0);
    if (totalClaimed > 0) {
      console.log('[billing] Claimed anon subscription on sign-in:', claimed);
    }
    // Always remove — mutation is idempotent, no value in retrying
    localStorage.removeItem('wm-anon-id');
  })
  .catch((err: unknown) => {
    console.warn('[billing] claimSubscription failed:', err);
    // Do NOT remove — failure may be transient (network, auth error)
    // Will retry on next sign-in
  });
```

**Pros:** Non-purchasing users don't pay the cold-init cost on every sign-in; clean
**Cons:** If the mutation succeeds but returns zero claims for a legitimate anon user (race condition where webhook hasn't processed yet), the anon ID is removed and future sign-ins won't retry

**Effort:** Small
**Risk:** Low

### Option 2: Remove `wm-anon-id` on any claimed count > 0 (all record types)

Extend the condition to include customers and payments:
```ts
if ((claimed?.subscriptions ?? 0) + (claimed?.entitlements ?? 0) +
    (claimed?.customers ?? 0) + (claimed?.payments ?? 0) > 0) {
  localStorage.removeItem('wm-anon-id');
}
```

**Pros:** Only removes if something was actually migrated
**Cons:** Non-purchasing users still carry the key forever

**Effort:** Small
**Risk:** Very low

## Recommended Action

Option 1. The mutation is idempotent — retrying with the same `anonId` after all records are already migrated is a no-op. There is no value in keeping the key after a successful claim attempt. Non-purchasing users should not pay the reconnect cost on every sign-in.

## Technical Details

- **Affected file:** `src/App.ts` lines 800-813 (the `claimSubscription` call block)

## Acceptance Criteria

- [ ] After a successful `claimSubscription` call (any result, no throw), `wm-anon-id` is removed from `localStorage`
- [ ] After a failed `claimSubscription` call (network error, auth error), `wm-anon-id` is NOT removed (will retry next sign-in)
- [ ] A user with no purchases does not get `wm-anon-id` re-created on the next page load
- [ ] `npx tsc --noEmit` passes

## Work Log

- 2026-03-30: Identified by performance-oracle, code-simplicity-reviewer, architecture-strategist during round-4 /ce-review of PR #2024
