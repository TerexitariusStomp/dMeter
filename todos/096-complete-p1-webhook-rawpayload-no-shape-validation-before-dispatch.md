---
status: pending
priority: p1
issue_id: "096"
tags: [code-review, typescript, convex, payments, reliability]
dependencies: []
---

# Webhook `rawPayload.data` Has No Shape Validation Before Handler Dispatch

## Problem Statement

`convex/payments/webhookMutations.ts` passes `args.rawPayload.data` (typed as `v.any()`) directly to handlers like `handleSubscriptionActive(ctx, data, args.timestamp)` which then access it as `DodoSubscriptionData`. There is no runtime validation of the payload shape before dispatch. A malformed webhook payload or a future Dodo API schema change will cause a runtime exception inside the handler rather than a clean, recoverable validation failure at the entrypoint.

## Findings

```ts
// webhookMutations.ts
const data = args.rawPayload.data; // v.any() — no type, no validation

await handleSubscriptionActive(ctx, data, args.timestamp);
// data accessed as DodoSubscriptionData inside — unchecked cast
```

TypeScript reviewer finding [5]: "A malformed webhook payload (or a future Dodo API change) will cause a runtime error rather than a clean validation failure. The webhook already verifies the signature, but it does not validate the payload shape before dispatch."

The webhook signature verification (`verifyWebhookPayload`) confirms authenticity but says nothing about field completeness or schema conformance. A Dodo API change that renames `subscription_id` to `subscriptionId` would pass signature verification and fail silently mid-handler.

## Proposed Solutions

### Option 1: Add field presence checks at dispatch boundary (Minimal)

**Approach:** Before each handler call, assert the presence of required top-level fields:

```ts
if (!data?.subscription_id || !data?.customer?.customer_id) {
  console.error("[webhook] Missing required fields in payload", eventType);
  return; // clean skip, not a crash
}
```

**Pros:** Zero new dependencies, fast to implement
**Cons:** Manual, doesn't catch nested field renames

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Zod validation at the dispatch boundary (Recommended)

**Approach:** Define minimal Zod schemas for each event type's required fields. Validate before dispatch:

```ts
const SubscriptionPayloadSchema = z.object({
  subscription_id: z.string(),
  customer: z.object({ customer_id: z.string() }),
  product_id: z.string(),
  status: z.string(),
});

const parsed = SubscriptionPayloadSchema.safeParse(data);
if (!parsed.success) {
  console.error("[webhook] Payload validation failed", parsed.error);
  return;
}
handleSubscriptionActive(ctx, parsed.data, args.timestamp);
```

Note: `zod` is likely already a dependency (it's a peer dep of `@dodopayments/core`).

**Pros:**
- Type-safe dispatch — `parsed.data` is fully typed
- Future schema changes caught at the boundary
- No silent partial failures

**Cons:** Requires defining schemas per event type

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

Option 1 as a minimal fix for this PR. Option 2 as a follow-up hardening.

## Technical Details

- **Affected file:** `convex/payments/webhookMutations.ts`
- **Handlers affected:** `handleSubscriptionActive`, `handleSubscriptionCancelled`, `handleSubscriptionUpdated`, `handleDisputeEvent`, `handlePaymentSucceeded`, `handlePaymentFailed`

## Acceptance Criteria

- [ ] Malformed payload does not cause unhandled exception inside handler
- [ ] Validation failure is logged with event type and missing fields
- [ ] Clean return (no re-throw) so the webhook returns 200 and Dodo does not retry indefinitely

## Work Log

- 2026-03-30: Identified by kieran-typescript-reviewer during final /ce-review pass on PR #2024
