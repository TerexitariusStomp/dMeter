---
status: pending
priority: p2
issue_id: "091"
tags: [code-review, quality, payments, frontend]
dependencies: []
---

# Dead Exports: `resetEntitlementState` and `customerPortal` Wrapper

## Problem Statement

Two exported functions have no callers in the current codebase. Exported dead code increases the perceived API surface, creates maintenance burden (the functions must be kept up to date), and can mislead future developers.

## Findings

1. **`resetEntitlementState` in `src/services/entitlements.ts`** — added in this PR as a complement to `destroyEntitlementSubscription`. The plan described it as "for explicit reset (e.g., logout)". No logout handler calls it. No other caller exists.

2. **`customerPortal` shorthand in `convex/lib/dodo.ts`** — mirrors the `checkout` shorthand export. No Convex action calls it — the customer portal in `billing.ts` uses the direct `dodopayments` REST SDK (`client.customers.customerPortal.create`), not the `@dodopayments/convex` component SDK.

The simplicity reviewer confirmed: both are dead exports with no callers anywhere in the PR.

## Proposed Solutions

### Option 1: Remove both dead exports (Recommended)

**Approach:**
- Delete `export function resetEntitlementState()` and its JSDoc from `src/services/entitlements.ts`
- Delete the `customerPortal` wrapper from `convex/lib/dodo.ts`

**Pros:**
- Reduces API surface
- No maintenance burden
- If needed later, trivial to add back

**Cons:**
- If a caller is added shortly after, it needs to be re-added

**Effort:** 10 min

**Risk:** Low — no callers to break

---

### Option 2: Mark as `@internal` with TODO comment

**Approach:** Add comments indicating these are pre-wired for a future caller.

**Pros:** No code deletion

**Cons:** Documents dead code instead of removing it; YAGNI violation

**Effort:** 5 min

**Risk:** Low (but wrong approach)

## Recommended Action

Option 1. Remove both. If `resetEntitlementState` is needed for logout, it can be added when the logout flow is wired. If `customerPortal` in `dodo.ts` is needed, it should be added when a Convex action calls it.

## Technical Details

- **Affected files:**
  - `src/services/entitlements.ts` — remove `export function resetEntitlementState()`
  - `convex/lib/dodo.ts` — remove `export function customerPortal(...)`

## Acceptance Criteria

- [ ] `resetEntitlementState` removed from `src/services/entitlements.ts`
- [ ] `customerPortal` wrapper removed from `convex/lib/dodo.ts`
- [ ] `tsc --noEmit` passes after removal

## Work Log

- 2026-03-30: Identified by code-simplicity-reviewer during final /ce-review pass on PR #2024
