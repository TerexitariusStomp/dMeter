---
status: pending
priority: p2
issue_id: "109"
tags: [code-review, security, payments]
dependencies: []
---

# Open Redirect via Unvalidated `returnUrl` in `createCheckout`

## Problem Statement

`convex/payments/checkout.ts` passes `args.returnUrl` directly to Dodo without domain validation. After a successful checkout, Dodo redirects the user to this URL. An authenticated attacker can call `createCheckout` with `returnUrl: "https://attacker.com/phishing"`, causing post-payment phishing via what looks like a legitimate worldmonitor.app checkout flow. The frontend always passes `window.location.origin` (safe), but nothing on the server enforces this constraint.

## Findings

- `convex/payments/checkout.ts:64` — `return_url: args.returnUrl ?? ...` with no domain check
- `args.returnUrl` is a client-controlled string
- Identified by: security-sentinel (round-6 review)

## Proposed Solutions

### Option 1: Allowlist-validate `returnUrl` before passing to Dodo

```ts
const ALLOWED_RETURN_ORIGINS = [
  'https://worldmonitor.app',
  'https://app.worldmonitor.app',
  process.env.SITE_URL,
].filter(Boolean);

if (args.returnUrl) {
  const isAllowed = ALLOWED_RETURN_ORIGINS.some(o => args.returnUrl!.startsWith(o!));
  if (!isAllowed) throw new ConvexError("Invalid returnUrl");
}
```

**Effort:** Small
**Risk:** Low

### Option 2: Remove `returnUrl` arg — always use `process.env.SITE_URL`

Remove the client-controlled arg entirely. Always use a server-side configured URL.

**Effort:** Small
**Risk:** Low — requires updating the frontend call site

## Recommended Action

Option 1. Keep the flexibility but add server-side origin validation.

## Technical Details

**Affected files:**
- `convex/payments/checkout.ts:64` — add allowlist validation before `return_url` assignment

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** security-sentinel

## Acceptance Criteria

- [ ] `createCheckout` rejects `returnUrl` values not starting with an allowed origin
- [ ] Frontend's `window.location.origin` passes validation
- [ ] Test: call `createCheckout` with `returnUrl: "https://evil.com"` → throws

## Work Log

### 2026-03-31 - Identified (round-6 review)
