---
status: pending
priority: p1
issue_id: "106"
tags: [code-review, typescript, payments]
dependencies: []
---

# `any` ctx Type in `getEntitlementsHandler` Breaks Convex Type Safety

## Problem Statement

`convex/entitlements.ts` defines `getEntitlementsHandler(ctx: { db: any }, userId: string)` with `db: any`. This bypasses all Convex-generated type checking for DB operations inside this function — TypeScript cannot catch typos in index names, field names, or return types. For a security-critical billing module this is unacceptable.

## Findings

- `convex/entitlements.ts:25-26` — `ctx: { db: any }` parameter type
- The `(q: any)` cast on the index callback at line 31 compounds this
- This function is called from both `query` and `internalQuery` handlers — the correct type is `QueryCtx`
- Identified by: kieran-typescript-reviewer (round-6 review)

## Proposed Solutions

### Option 1: Use `QueryCtx` from `_generated/server`

```ts
import type { QueryCtx } from "./_generated/server";

async function getEntitlementsHandler(ctx: QueryCtx, userId: string) {
```

Remove the `(q: any)` cast — the index callback will be fully typed once `ctx` is `QueryCtx`.

**Effort:** 5 minutes
**Risk:** None — tightens types, no behavior change

## Recommended Action

Option 1. Import `QueryCtx` and replace `{ db: any }`.

## Technical Details

**Affected files:**
- `convex/entitlements.ts:25-26` — change parameter type
- `convex/entitlements.ts:31` — remove `(q: any)` cast

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** kieran-typescript-reviewer

## Acceptance Criteria

- [ ] `getEntitlementsHandler` uses `QueryCtx` type from `_generated/server`
- [ ] No `any` types in the function signature or body
- [ ] `tsc --noEmit` produces zero errors

## Work Log

### 2026-03-31 - Identified (round-6 review)
