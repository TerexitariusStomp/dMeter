---
status: pending
priority: p2
issue_id: "090"
tags: [code-review, security, payments, convex]
dependencies: []
---

# `claimSubscription` Has No Rate Limiting

## Problem Statement

`claimSubscription` is a public mutation (browser-callable) that patches subscription, entitlement, customer, and payment records to a new userId. There is no rate limiting or call-frequency guard. A malicious or malfunctioning client could spam it rapidly, causing excessive Convex DB writes and unnecessary Redis cache invalidations per call.

## Findings

- `claimSubscription` in `convex/payments/billing.ts` uses `requireUserId(ctx)` for auth but has no per-user call frequency limit
- Each call dispatches 2 Convex scheduler jobs (`deleteEntitlementCache` + `syncEntitlementCache`) — each call has a real operational cost
- Multiple rapid calls are harmless from a data-correctness perspective (patching the same records to the same userId is idempotent) but create unnecessary load
- Security review flagged as HIGH in previous rounds; still not addressed
- Convex has an official `@convex-dev/ratelimiter` component that integrates cleanly

## Proposed Solutions

### Option 1: Convex Rate Limiter component (Recommended)

**Approach:** Use `@convex-dev/ratelimiter` to limit `claimSubscription` to once per user per 60 seconds.

```ts
import { rateLimiter } from "../lib/rateLimiter"; // or inline with the component

// In claimSubscription handler:
const { ok } = await rateLimiter.limit(ctx, "claimSubscription", { key: realUserId });
if (!ok) throw new Error("Rate limit exceeded — wait before retrying claim");
```

**Pros:**
- Official Convex pattern
- Persistent per-user rate limit stored in Convex DB
- Configurable window and burst

**Cons:**
- Adds `@convex-dev/ratelimiter` dependency if not already present (check `package.json`)

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Simple timestamp check on entitlement record

**Approach:** Read the entitlement's `updatedAt` field. If it was updated within 60 seconds, reject the claim call.

**Pros:** No new dependency

**Cons:** Only rate-limits on entitlement-based users; anon users with no entitlement get no rate limiting

**Effort:** 30 min

**Risk:** Medium

## Recommended Action

Option 1 if `@convex-dev/ratelimiter` is already a dependency. Option 2 as a stopgap otherwise.

## Technical Details

- **Affected file:** `convex/payments/billing.ts:claimSubscription`

## Acceptance Criteria

- [ ] Calling `claimSubscription` more than once per minute per `realUserId` returns a rate limit error
- [ ] First call within window succeeds normally
- [ ] Rate limit does not block legitimate single-call claim flow

## Work Log

- 2026-03-30: Flagged HIGH by security-sentinel in previous review rounds; still open after all fixes applied
