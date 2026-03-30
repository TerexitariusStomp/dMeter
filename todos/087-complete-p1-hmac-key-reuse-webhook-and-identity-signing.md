---
status: pending
priority: p1
issue_id: "087"
tags: [code-review, security, payments, convex]
dependencies: []
---

# HMAC Signing Key Reuse: Webhook Secret Used for Both Webhook Verification and userId Signing

## Problem Statement

`DODO_PAYMENTS_WEBHOOK_SECRET` is used for two distinct cryptographic purposes in the same pipeline:

1. Standard Webhooks signature verification (`verifyWebhookPayload`) — validates Dodo sent the webhook
2. HMAC userId identity signing (`identity-signing.ts`) — signs caller-supplied userId inside checkout metadata

These are independent security boundaries with independent rotation needs. Reusing the same key means rotating the webhook secret silently breaks identity verification in checkout, with no error until a purchase is attempted.

## Findings

- `convex/lib/identity-signing.ts` reads `process.env.DODO_PAYMENTS_WEBHOOK_SECRET` for userId HMAC
- `convex/payments/webhookHandlers.ts` reads the same `DODO_PAYMENTS_WEBHOOK_SECRET` for Standard Webhooks HMAC-SHA256 verification
- Key rotation is a normal operational event (Dodo recommends periodic rotation). A secret rotation after a security incident would break the identity layer at checkout with no visible warning
- No test covers the HMAC signing/verification path directly — a rotation failure would only surface when a user completes checkout and the webhook arrives with a mismatched signature on the identity claim

## Proposed Solutions

### Option 1: Introduce `DODO_IDENTITY_SIGNING_SECRET` (Recommended)

**Approach:** Add a second env var for userId signing, completely separate from the webhook secret.

```ts
// convex/lib/identity-signing.ts
const key = process.env.DODO_IDENTITY_SIGNING_SECRET;
if (!key) throw new Error("[identity-signing] DODO_IDENTITY_SIGNING_SECRET not set");
```

Update `.env.example` and Convex dashboard docs.

**Pros:**
- Clean separation of concerns
- Rotating webhook secret doesn't touch identity signing
- Clearer intent in code

**Cons:**
- One additional env var to provision
- Requires coordinated deploy (set new var before deploying code that reads it)

**Effort:** 30 min

**Risk:** Low

---

### Option 2: Document the coupling explicitly (Not Recommended)

**Approach:** Add a prominent warning comment that both usages share the key and must be rotated together.

**Pros:** Zero env var change

**Cons:** Doesn't actually solve the problem — just documents it. Still breaks on rotation.

**Effort:** 5 min

**Risk:** High (operational footgun remains)

## Recommended Action

Option 1. Add `DODO_IDENTITY_SIGNING_SECRET` to `.env.example`, `convex/lib/identity-signing.ts`, and Convex dashboard variable docs.

## Technical Details

- **Affected files:** `convex/lib/identity-signing.ts`, `.env.example`
- **Root cause:** PR #2024 introduced identity signing using the existing webhook secret variable as a convenient key source

## Acceptance Criteria

- [ ] `DODO_IDENTITY_SIGNING_SECRET` used in `identity-signing.ts` (not `DODO_PAYMENTS_WEBHOOK_SECRET`)
- [ ] `.env.example` documents both env vars with separate comments explaining their purpose
- [ ] Rotating one does not affect the other

## Work Log

- 2026-03-30: Identified by security-sentinel agent during final /ce-review pass on PR #2024
