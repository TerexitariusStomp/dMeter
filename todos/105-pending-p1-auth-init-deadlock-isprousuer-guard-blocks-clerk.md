---
status: pending
priority: p1
issue_id: "105"
tags: [code-review, auth, payments]
dependencies: []
---

# Auth Init Deadlock — `initAuthState()` Gated Behind `isProUser()` Blocks New Users

## Problem Statement

`initAuthState()` in `src/App.ts` is wrapped inside an `if (isProUser())` guard (or similar premium check). `isProUser()` returns false for all new users (no `wm-pro-key`/`wm-widget-key` in localStorage). This creates a bootstrapping deadlock: Clerk never loads, the sign-in button never appears, and new users can never sign in to migrate from anonymous to authenticated identity. The entire anonymous-purchase migration flow in this PR (claimSubscription) is unreachable for new users.

## Findings

- `src/App.ts` — `initAuthState()` / `setupAuthWidget()` guarded by premium check
- `isProUser()` reads from localStorage, starts false for every new visitor
- Identified in existing todo #034 (pending P1) and learnings-researcher
- Direct blocker for the anon-to-Clerk migration path added in this PR

## Proposed Solutions

### Option 1: Remove the `isProUser()` guard from auth init

**Approach:** Call `initAuthState()` unconditionally on web (gate only on `!isDesktopRuntime()`). `initAuthState()` is cheap when no session exists — it checks for a token and returns quickly.

**Pros:** Fixes the deadlock entirely. New users see sign-in button. Migration path works.
**Cons:** Clerk SDK loads for all web users (already bundled, negligible cost).
**Effort:** 5 minutes
**Risk:** Low

## Recommended Action

Option 1. Remove the `isProUser()` gate from `initAuthState()`.

## Technical Details

**Affected files:**
- `src/App.ts` — remove `isProUser()` guard around `initAuthState()` / Clerk setup

## Resources

- **PR:** koala73/worldmonitor#2024
- **Prior todo:** `todos/034-pending-p1-auth-init-gated-behind-isProUser-deadlock.md`
- **Identified by:** learnings-researcher

## Acceptance Criteria

- [ ] New user (no localStorage keys) sees sign-in button on page load
- [ ] `initAuthState()` runs unconditionally for web runtime
- [ ] Clerk sign-in modal opens successfully for new unauthenticated users
- [ ] `vitest run` passes

## Work Log

### 2026-03-31 - Identified (round-6 review)
