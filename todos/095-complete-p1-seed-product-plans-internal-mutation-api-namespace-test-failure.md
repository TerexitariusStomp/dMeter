---
status: pending
priority: p1
issue_id: "095"
tags: [code-review, typescript, convex, tests, payments]
dependencies: []
---

# `seedProductPlans` Test Calls `api.*` for an `internalMutation` — Will Fail at Runtime

## Problem Statement

`convex/payments/seedProductPlans.ts` declares `seedProductPlans` as `internalMutation`, meaning it is only accessible via `internal.*` in Convex. However, the test in `convex/__tests__/checkout.test.ts` calls it via `api.payments.seedProductPlans.seedProductPlans` (the public API namespace). Convex test infrastructure resolves function references strictly — calling an internal function via the public API reference will fail at runtime when tests run.

## Findings

```ts
// convex/payments/seedProductPlans.ts
export const seedProductPlans = internalMutation({
```

```ts
// convex/__tests__/checkout.test.ts:77
await t.mutation(api.payments.seedProductPlans.seedProductPlans, {});
//              ^^^  Public namespace — wrong for internalMutation
```

TypeScript reviewer finding [4]: "This will fail at runtime when convex-test resolves the function reference. The test calls `api.payments.seedProductPlans.seedProductPlans` which points to the public API namespace, but the function is registered as internal."

## Proposed Solutions

### Option 1: Fix test to use `internal.*` namespace (Recommended for internalMutation)

**Approach:**
```ts
import { internal } from "../../_generated/api";
await t.mutation(internal.payments.seedProductPlans.seedProductPlans, {});
```

**Pros:** Keeps `seedProductPlans` as internal (correct — seeding should not be browser-callable)
**Cons:** None

**Effort:** 5 min

**Risk:** None

---

### Option 2: Promote `seedProductPlans` to `mutation` with an admin guard

**Approach:** Change `internalMutation` to `mutation` and add an env-based guard that only allows execution when `CONVEX_IS_DEV === "true"`.

**Pros:** `api.*` call in test works
**Cons:** Public mutation for seeding is riskier; admin guard must be watertight

**Effort:** 20 min

**Risk:** Medium

## Recommended Action

Option 1. Fix the test to use `internal.*`. Seeding should remain internal.

## Technical Details

- **Affected file:** `convex/__tests__/checkout.test.ts` (the import/call site)
- **Change required:** `api.payments.seedProductPlans.seedProductPlans` → `internal.payments.seedProductPlans.seedProductPlans`

## Acceptance Criteria

- [ ] Test uses `internal.payments.seedProductPlans.seedProductPlans`
- [ ] `npx vitest run` passes
- [ ] `seedProductPlans` remains `internalMutation`

## Work Log

- 2026-03-30: Identified by kieran-typescript-reviewer during final /ce-review pass on PR #2024
