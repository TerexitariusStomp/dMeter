---
status: pending
priority: p3
issue_id: "115"
tags: [code-review, quality, tests]
dependencies: []
---

# Test Plumbing in Production Exports + Dispute Tests Not Parameterized

## Problem Statement

Two test-quality issues in the PR:

1. `server/_shared/entitlement-check.ts` exports `_testCheckEntitlement` and a `_checkEntitlementCore` function purely for test injection. This leaks test scaffolding into the production export surface. Tests could instead use `vi.spyOn` on the `getEntitlements` function (already exported) to achieve the same injection.

2. `convex/__tests__/webhook.test.ts` has four near-identical test cases for `dispute.opened`, `dispute.won`, `dispute.lost`, `dispute.closed` (lines 438-480). These 40 lines collapse to one `test.each` block.

## Findings

- `server/_shared/entitlement-check.ts:167-239` — `_checkEntitlementCore` and `_testCheckEntitlement` exist only for test injection
- `convex/__tests__/webhook.test.ts:438-480` — four identical dispute tests differing only in event type string
- Identified by: code-simplicity-reviewer (round-6 review)

## Proposed Solutions

### Option 1: Remove test scaffolding + parameterize tests

```ts
// Replace 4 dispute tests with:
test.each([
  ['dispute.opened', 'dispute_opened'],
  ['dispute.won', 'dispute_won'],
  ['dispute.lost', 'dispute_lost'],
  ['dispute.closed', 'dispute_closed'],
])('dispute %s → paymentEvents status %s', async (eventType, expectedStatus) => {
  // ...
});
```

Remove `_checkEntitlementCore` and `_testCheckEntitlement`. Have tests `vi.spyOn(entitlementCheck, 'getEntitlements')` instead.

**Effort:** Small (1 hour)
**Risk:** Low

## Recommended Action

Option 1.

## Technical Details

**Affected files:**
- `server/_shared/entitlement-check.ts:167-239` — remove test-only exports
- `server/__tests__/entitlement-check.test.ts` — update to use `vi.spyOn`
- `convex/__tests__/webhook.test.ts:438-480` — convert to `test.each`

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** code-simplicity-reviewer

## Acceptance Criteria

- [ ] `_testCheckEntitlement` and `_checkEntitlementCore` removed from production exports
- [ ] All entitlement-check tests pass using `vi.spyOn`
- [ ] Four dispute tests replaced with one parameterized `test.each`
- [ ] `vitest run` passes

## Work Log

### 2026-03-31 - Identified (round-6 review)
