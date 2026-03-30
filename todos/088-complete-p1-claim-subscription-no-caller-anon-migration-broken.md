---
status: pending
priority: p1
issue_id: "088"
tags: [code-review, payments, convex, auth]
dependencies: []
---

# `claimSubscription` Has No Caller — Anon-to-Authed Migration Never Runs

## Problem Statement

`convex/payments/billing.ts:claimSubscription` implements the migration path from an anonymous purchase ID (`wm-anon-id` in localStorage) to an authenticated Clerk user. This mutation exists but is never called automatically on Clerk sign-in. As a result, users who purchase while anonymous and then create/sign into a Clerk account permanently lose their entitlements — they cannot access the plan they paid for.

## Findings

- `claimSubscription` is exported from `billing.ts` with full implementation and Redis cache sync
- No Clerk `onSignIn` hook, Convex auth callback, or frontend listener calls `claimSubscription` after authentication
- The PR description acknowledges this as a "Phase 17/18" item, but Clerk auth (PR #1812) was already merged into `dodo_payments` — the prerequisite is satisfied
- Architecture review confirmed: "claimSubscription has no caller in this PR. Paying anon users lose entitlements permanently."
- Simplicity review confirmed: "no integration test coverage for the tier-comparison merge logic"
- Referenced issue: koala73/worldmonitor#2078

## Proposed Solutions

### Option 1: Wire to Clerk `useAuth` sign-in callback in frontend (Recommended)

**Approach:** In the Clerk sign-in success callback (or in the `useUser` hook when `isSignedIn` transitions from false→true), read `localStorage.getItem('wm-anon-id')` and call `convexClient.mutation(api.payments.billing.claimSubscription, { anonId })`.

```ts
// src/services/user-identity.ts or Clerk event handler
if (isSignedIn && anonId) {
  await convex.mutation(api.payments.billing.claimSubscription, { anonId });
  localStorage.removeItem('wm-anon-id');
}
```

**Pros:**
- Runs exactly once on first sign-in
- Clears the anon ID from storage after successful claim

**Cons:**
- Requires identifying the correct Clerk sign-in hook in the frontend

**Effort:** 1-2 hours

**Risk:** Low — mutation is idempotent (patches records, no duplicate side-effects)

---

### Option 2: Trigger from Convex auth callback

**Approach:** Use Convex's `onUserCreated` or equivalent auth hook to call `claimSubscription` server-side.

**Pros:** No frontend change required

**Cons:** Convex doesn't have a native "on first login" hook; would need a custom approach

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

Option 1. Wire the call in `src/services/user-identity.ts` or wherever Clerk auth state transitions are observed.

## Technical Details

- **Affected files:** `src/services/user-identity.ts` (or Clerk auth hook), `convex/payments/billing.ts`
- **Prerequisite:** Clerk auth in `dodo_payments` (already merged via PR #1812)
- **Related issue:** koala73/worldmonitor#2078

## Acceptance Criteria

- [ ] `claimSubscription` is called automatically when a user signs into Clerk and `wm-anon-id` exists in localStorage
- [ ] `wm-anon-id` is cleared from localStorage after successful claim
- [ ] Integration test: create anon subscription, sign in, verify entitlement migrated to authed user
- [ ] Duplicate call is safe (idempotent)

## Work Log

- 2026-03-30: Identified by architecture-strategist agent during final /ce-review pass on PR #2024
