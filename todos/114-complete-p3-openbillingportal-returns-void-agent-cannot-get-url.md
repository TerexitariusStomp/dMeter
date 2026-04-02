---
status: complete
priority: p3
issue_id: "114"
tags: [code-review, agent-native, payments]
dependencies: []
---

# `openBillingPortal()` Returns `void` — Agent Cannot Retrieve Portal URL

## Problem Statement

`src/services/billing.ts` `openBillingPortal()` calls the Convex action to get `portal_url` then immediately calls `window.open(url, '_blank')` and returns `void`. An agent that can authenticate with Clerk and call Convex actions directly can get the URL from `api.payments.billing.getCustomerPortalUrl`, but any code that calls `openBillingPortal()` (the service wrapper) throws the URL away. If an agent is instructed to "use the billing service module", it hits a dead end.

Additionally, the fallback URL `'https://customer.dodopayments.com'` is hardcoded in three separate locations within the function.

## Findings

- `src/services/billing.ts:120-145` — `openBillingPortal()` returns `void`
- Three separate `window.open('https://customer.dodopayments.com', '_blank')` calls in the function
- Identified by: agent-native-reviewer (round-6 review)

## Proposed Solutions

### Option 1: Return `Promise<string | null>` + extract fallback constant

```ts
const DODO_PORTAL_FALLBACK_URL = 'https://customer.dodopayments.com';

export async function openBillingPortal(): Promise<string | null> {
  // ...
  const url = result?.portal_url ?? DODO_PORTAL_FALLBACK_URL;
  window.open(url, '_blank');
  return url;
}
```

**Effort:** Trivial (5 minutes)
**Risk:** None — additive return value

## Recommended Action

Option 1.

## Technical Details

**Affected files:**
- `src/services/billing.ts:120-145` — change return type to `Promise<string | null>`, extract constant

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** agent-native-reviewer, code-simplicity-reviewer

## Acceptance Criteria

- [ ] `openBillingPortal()` returns the portal URL (or fallback URL)
- [ ] `DODO_PORTAL_FALLBACK_URL` extracted as a named constant (used in one place)
- [ ] Existing behavior (opening tab) unchanged

## Work Log

### 2026-03-31 - Identified (round-6 review)
