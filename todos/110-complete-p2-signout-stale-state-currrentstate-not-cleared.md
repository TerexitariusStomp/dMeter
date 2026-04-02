---
status: complete
priority: p2
issue_id: "110"
tags: [code-review, frontend, auth, payments]
dependencies: []
---

# Sign-Out Stale State — `currentState`/Subscription Not Cleared on Sign-Out

## Problem Statement

The sign-out path in `src/App.ts` calls `cloudPrefsSignOut()` but does NOT call `destroyEntitlementSubscription()` or `destroySubscriptionWatch()`. This means after sign-out, `currentState` in `entitlements.ts` and `currentSubscription` in `billing.ts` retain the previous user's data. If a second user signs in on the same browser session without a full page reload, `isEntitled()` and `hasFeature()` return stale data for the previously-logged-out user. Panel gating would display incorrect access for the new user.

## Findings

- `src/App.ts:819-821` — sign-out branch calls `cloudPrefsSignOut()` only
- `src/services/entitlements.ts:74` — `destroyEntitlementSubscription()` does not null `currentState` (by design for reconnects)
- `src/App.ts:800-803` — destroy+reinit only runs on sign-IN, not sign-OUT
- Identified by: performance-oracle (round-6 review)

## Proposed Solutions

### Option 1: Add destroy + explicit state reset on sign-out

In `App.ts` sign-out branch (`userId === null && _prevUserId !== null`):
```ts
destroyEntitlementSubscription();
destroySubscriptionWatch();
// Explicit state reset on logout (not done on destroy to preserve reconnect state)
resetEntitlementState();  // new export from entitlements.ts that nulls currentState
```

Export `resetEntitlementState()` from `entitlements.ts` that sets `currentState = null`.

**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1.

## Technical Details

**Affected files:**
- `src/App.ts:819` — add destroy + reset calls in sign-out branch
- `src/services/entitlements.ts` — export `resetEntitlementState()` that nulls `currentState`
- `src/services/billing.ts` — verify `destroySubscriptionWatch()` already clears `currentSubscription`

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** performance-oracle

## Acceptance Criteria

- [ ] After sign-out, `isEntitled()` returns false
- [ ] After sign-out followed by new sign-in, new user gets correct entitlement state (not previous user's)
- [ ] `destroyEntitlementSubscription` + `destroySubscriptionWatch` called on sign-out

## Work Log

### 2026-03-31 - Identified (round-6 review)
