---
status: complete
priority: p2
issue_id: "112"
tags: [code-review, architecture, payments, auth]
dependencies: []
---

# Two Premium-Check Systems Diverge — `isCallerPremium` vs Dodo `checkEntitlement`

## Problem Statement

The codebase now has two independent server-side premium checks that can return different answers for the same user:

1. `server/_shared/premium-check.ts` (`isCallerPremium`) — checks API key + `role: pro` in Clerk JWT
2. `server/_shared/entitlement-check.ts` (`checkEntitlement`) — checks Dodo subscription tier from Redis/Convex

A user with a Dodo pro subscription but no `role: pro` in their Clerk JWT passes `checkEntitlement` (tier 1) on gated market endpoints but fails `isCallerPremium` on `chat-analyst`. The `hasPremiumAccess()` in `src/services/panel-gating.ts` unifies both client-side, but the server layer remains split.

## Findings

- `server/_shared/premium-check.ts` — `isCallerPremium` checks Clerk role
- `server/_shared/entitlement-check.ts` — `checkEntitlement` checks Dodo tier
- `src/services/panel-gating.ts` — `hasPremiumAccess()` checks both (client-side only)
- `chat-analyst.ts` uses `isCallerPremium`, market endpoints use `checkEntitlement`
- Identified by: architecture-strategist (round-6 review)

## Proposed Solutions

### Option 1: Extend `isCallerPremium` to check Dodo entitlement as fallback

When `isCallerPremium` finds no API key and no `role: pro` in JWT, additionally check the Dodo entitlement tier via the same Redis/Convex path. A user with Dodo tier ≥ 1 is premium.

**Effort:** Medium
**Risk:** Low — additive check, can't reduce existing premium access

### Option 2: Create a unified `isUserPremium(request)` that replaces both

A single function that checks: (1) API key, (2) Clerk role, (3) Dodo tier. All server handlers use this one function.

**Effort:** Medium
**Risk:** Medium — requires updating all callers

## Recommended Action

Option 1 as a first step. Extend `isCallerPremium` to include Dodo tier as the third signal.

## Technical Details

**Affected files:**
- `server/_shared/premium-check.ts` — add Dodo entitlement check as fallback
- All handlers using `isCallerPremium` benefit automatically

## Resources

- **PR:** koala73/worldmonitor#2024
- **Identified by:** architecture-strategist, agent-native-reviewer

## Acceptance Criteria

- [ ] A user with valid Dodo subscription passes `isCallerPremium` even without `role: pro`
- [ ] `chat-analyst` endpoints accessible to Dodo subscribers
- [ ] Existing API key and Clerk role paths unaffected

## Work Log

### 2026-03-31 - Identified (round-6 review)
