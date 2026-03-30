---
status: pending
priority: p1
issue_id: "089"
tags: [code-review, payments, convex, billing]
dependencies: []
---

# `getCustomerPortalUrl` Is Dead Code — Billing Portal Always Shows Generic URL

## Problem Statement

`convex/payments/billing.ts:getCustomerPortalUrl` creates a real Dodo Customer Portal session (with a personalized URL per customer), but it is declared as `internalAction` and has no server-side caller in the PR. As a result, `src/services/billing.ts:openBillingPortal` always falls back to the generic portal URL (`https://customer.dodopayments.com`), regardless of whether the user has a `dodoCustomerId`. Users who click "Manage Billing" are dropped at a generic portal landing where they must search for their account — they cannot land directly in their subscription management view.

## Findings

- `getCustomerPortalUrl` in `convex/payments/billing.ts` is `internalAction` — browser cannot call it directly (correct)
- `src/services/billing.ts:openBillingPortal` has a TODO: "Call `getCustomerPortalUrl` once Clerk auth is wired"
- Clerk auth WAS merged (PR #1812 into `dodo_payments`) — the prerequisite is now satisfied, but the wiring was not done
- Architecture review: "getCustomerPortalUrl remains internalAction despite its prerequisite now being satisfied, and openBillingPortal always opens the generic portal"
- Security review: "getCustomerPortalUrl — dead code today. No tested code path for billing management."
- The missing piece is a Vercel Edge endpoint (`/api/billing/portal`) or a public Convex action that accepts an authenticated request and delegates to the internal action

## Proposed Solutions

### Option 1: Promote to public Convex action (Recommended)

**Approach:** Convert `getCustomerPortalUrl` from `internalAction` to `action` (public, authenticated). Use `requireUserId(ctx)` for auth. The frontend can call it directly via the Convex client.

```ts
export const getCustomerPortalUrl = action({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    // ... existing implementation using userId
  },
});
```

**Pros:**
- Simple promotion, no new files
- Clerk auth is already wired via `requireUserId`

**Cons:**
- Public Convex action means browser can call it — but it's auth-gated, so that's fine

**Effort:** 30 min

**Risk:** Low

---

### Option 2: Add `/api/billing/portal` Vercel Edge endpoint

**Approach:** Create `api/billing/portal.ts` that reads auth session, calls `getCustomerPortalUrl` via Convex client, and returns the portal URL.

**Pros:**
- Keeps billing logic in Convex, edge handles auth
- Consistent with other `/api/billing/*` patterns

**Cons:**
- New file required
- More indirection than Option 1

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

Option 1 is simpler since Clerk auth is already integrated via `requireUserId`. Promote to public `action` and wire `openBillingPortal` to call it.

## Technical Details

- **Affected files:** `convex/payments/billing.ts`, `src/services/billing.ts`
- **Prerequisite:** Already satisfied (Clerk auth in dodo_payments via PR #1812)

## Acceptance Criteria

- [ ] `getCustomerPortalUrl` is callable from the browser (public action or API endpoint)
- [ ] `openBillingPortal` uses the real portal URL when `dodoCustomerId` exists
- [ ] Falls back to generic URL only when no customer record is found
- [ ] Manual test: authenticated user with subscription sees personalized portal on "Manage Billing" click

## Work Log

- 2026-03-30: Identified by architecture-strategist and security-sentinel during final /ce-review pass on PR #2024
