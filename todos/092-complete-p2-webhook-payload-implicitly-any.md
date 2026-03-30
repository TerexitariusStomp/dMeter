---
status: pending
priority: p2
issue_id: "092"
tags: [code-review, typescript, payments, convex]
dependencies: []
---

# `let payload;` in `webhookHandlers.ts` Is Implicitly Typed as `any`

## Problem Statement

In `convex/payments/webhookHandlers.ts`, the webhook payload variable is declared without a type annotation before being assigned inside a try block. TypeScript infers `any` for the outer binding in this pattern, silently stripping all type safety for every subsequent access of `payload.data`, `payload.type`, etc.

## Findings

```ts
let payload;  // TypeScript infers: any
try {
  payload = await verifyWebhookPayload({ ... });
} catch (err) {
  // ...
}
// Every payload.xxx access below has no type checking
```

TypeScript reviewer finding [15]: "payload is implicitly typed as `any` here because it is declared without a type annotation and assigned inside a try block."

The return type of `verifyWebhookPayload` is known — it should be used to annotate the declaration.

## Proposed Solutions

### Option 1: Annotate with the return type of `verifyWebhookPayload` (Recommended)

**Approach:**
```ts
import type { WebhookPayload } from "../lib/webhookVerification"; // whatever the return type is

let payload: Awaited<ReturnType<typeof verifyWebhookPayload>>;
// or explicitly:
let payload: WebhookPayload;
```

**Pros:**
- Full type safety on all subsequent `payload.*` accesses
- Catches typos at compile time

**Cons:**
- None

**Effort:** 10 min

**Risk:** Low

---

### Option 2: Refactor to avoid split declaration

**Approach:** Return early or restructure to avoid assigning inside try:
```ts
const payload = await verifyWebhookPayload(...).catch((err) => {
  // handle error
  return null;
});
if (!payload) return;
```

**Pros:** Cleaner code — no `let` declaration needed

**Cons:** Changes control flow pattern; slightly more refactoring

**Effort:** 20 min

**Risk:** Low

## Recommended Action

Option 1 for a minimal fix. Option 2 if the control flow lends itself to it.

## Technical Details

- **Affected file:** `convex/payments/webhookHandlers.ts`
- Look for `let payload;` declaration before the try block

## Acceptance Criteria

- [ ] `payload` has explicit type annotation matching `verifyWebhookPayload` return type
- [ ] No `any` in this code path
- [ ] `tsc --noEmit` passes

## Work Log

- 2026-03-30: Identified by kieran-typescript-reviewer during final /ce-review pass on PR #2024
