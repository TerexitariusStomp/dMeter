---
status: pending
priority: p3
issue_id: "094"
tags: [code-review, agent-native, payments, billing]
dependencies: [089]
---

# Agent-Native Billing Gaps: Portal, Plan Listing, and Cancellation

## Problem Statement

Only 3 of 8 billing UI actions are currently agent-accessible (checkout, entitlement check, subscription status read). Five key billing actions have no agent-callable path: portal access, plan listing, subscription cancellation, invoice history, and plan change. This blocks agents from completing the full self-serve billing lifecycle.

## Findings

Agent-native reviewer assessment: "3 of 8 current UI billing actions are agent-accessible — NEEDS WORK."

Gaps:
1. **Portal URL** — `openBillingPortal` always uses generic fallback URL; no API endpoint returns a personalized portal URL (related: todo 089)
2. **Plan listing** — `listProductPlans` is an internal Convex query; no public `/api/billing/plans` endpoint exists for agents to discover available plans or pick a product ID for checkout
3. **Cancellation** — no Convex action or API endpoint to cancel a subscription (would call `dodoClient.subscriptions.cancel(subscriptionId)`)
4. **Invoice history** — no API endpoint
5. **Plan change** — `changePlan` exists in Convex but requires `activeSubscription.subscriptionId` which is not easily discoverable by agents

## Proposed Solutions

### Option 1: Expose `/api/billing/plans` public endpoint (Quick Win)

**Approach:** Create `api/billing/plans.ts` that calls `listProductPlans` and returns plan data. Unauthenticated, read-only.

**Effort:** 1 hour
**Risk:** Low

---

### Option 2: Promote `getCustomerPortalUrl` to public action (Related to 089)

**Approach:** As described in todo 089 — promotes portal URL generation to a browser-callable action. Resolving 089 also resolves this gap.

**Effort:** 30 min
**Risk:** Low

---

### Option 3: Add `cancelSubscription` public Convex action

**Approach:**
```ts
export const cancelSubscription = action({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const activeSub = await ctx.runQuery(internal.payments.billing.getActiveSubscription, { userId });
    if (!activeSub) throw new Error("No active subscription to cancel");
    const client = getDodoClient();
    await client.subscriptions.cancel(activeSub.subscriptionId);
    // webhook will handle DB update
  },
});
```

**Effort:** 1-2 hours
**Risk:** Medium (test in Dodo test_mode first)

## Recommended Action

Prioritize as Phase 18 items. Resolve 089 first (portal URL). Then add `/api/billing/plans`. Cancellation can follow in a separate PR.

## Technical Details

- **Affected files (future):** `api/billing/plans.ts` (new), `convex/payments/billing.ts` (new action)
- **Depends on:** Todo 089 (portal URL promotion)

## Acceptance Criteria

- [ ] `/api/billing/plans` returns available plans (unauthenticated)
- [ ] Authenticated agent can retrieve personalized portal URL
- [ ] Authenticated agent can cancel active subscription
- [ ] All three tested against Dodo test_mode

## Work Log

- 2026-03-30: Identified by agent-native-reviewer during final /ce-review pass on PR #2024
