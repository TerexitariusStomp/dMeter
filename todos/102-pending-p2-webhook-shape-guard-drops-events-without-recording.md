---
status: pending
priority: p2
issue_id: "102"
tags: [code-review, payments, architecture, webhooks]
dependencies: [096]
---

# Webhook Shape Guard Silently Drops Events Without Recording Them in `webhookEvents`

## Problem Statement

The shape guard added in `convex/payments/webhookMutations.ts` (todo 096 fix) returns early (clean 200) when `rawPayload.data` is malformed. This is intentional for Dodo to not retry. However, the early `return` at line 63 (and line 77) exits before the `webhookEvents` INSERT at line 119, meaning dropped events are never recorded. They are invisible to any audit trail.

## Findings

**Current flow in `processWebhookEvent`:**
1. Shape guard checks → if malformed, `console.error(...)` + `return`
2. (rest of handler — event type switch, ctx.db.insert("webhookEvents", ...) at line ~119)

The `return` before the INSERT means: malformed events produce a console log in Convex dashboard logs but leave no record in the `webhookEvents` table. If a Dodo API schema change causes systematic malformed payloads, the only evidence is transient Convex function logs (which have a retention period), not a permanent DB record.

The design intent (200, no retry) is correct for malformed payloads that can't be fixed by retrying. The gap is the missing audit record.

Agent that identified this: architecture-strategist (BLOCKING).

## Proposed Solutions

### Option 1: Insert a "rejected" event record before returning

```ts
if (!data || typeof data !== 'object') {
  console.error("[webhook] rawPayload.data is missing or not an object", { ... });
  // Record the rejection for auditability
  await ctx.db.insert("webhookEvents", {
    webhookId: args.webhookId,
    eventType: args.eventType,
    status: "rejected",
    rejectionReason: "data_missing_or_not_object",
    rawPayload: args.rawPayload,
  });
  return;
}
```

**Note:** Requires `webhookEvents` schema to support a `"rejected"` status value and `rejectionReason` field. Check current schema before implementing.

**Pros:** Full audit trail; ops team can query for rejected events
**Cons:** Schema change required; must handle the case where the INSERT itself fails

**Effort:** Small-Medium
**Risk:** Low

### Option 2: Log to a separate `rejectedWebhookEvents` table

Create a separate table `rejectedWebhookEvents` with `webhookId`, `eventType`, `reason`, and a timestamp. Avoids polluting the main `webhookEvents` table with rejected/invalid entries.

**Effort:** Medium
**Risk:** Low

### Option 3: Accept the current design — console logs are sufficient

The Convex dashboard preserves function logs. For true schema-change incidents, the logs would be visible. The 200 response is correct. Accept the current state.

**Effort:** None
**Risk:** None (logging debt)

## Recommended Action

Option 3 for this PR (acceptable risk during initial launch). Option 1 as a follow-up in a separate PR once the schema can be reviewed. The priority is to not block PR #2024 merge over audit trail completeness.

## Technical Details

- **Affected file:** `convex/payments/webhookMutations.ts` — `processWebhookEvent` handler
- Check `convex/schema.ts` `webhookEvents` table definition before implementing Option 1

## Acceptance Criteria

- [ ] Rejected events produce at least a console.error (already done)
- [ ] (Option 1) A `webhookEvents` record with `status: "rejected"` is created for malformed payloads
- [ ] No change to the 200 response behavior (Dodo does not retry malformed payloads)

## Work Log

- 2026-03-30: Identified by architecture-strategist during round-4 /ce-review of PR #2024
