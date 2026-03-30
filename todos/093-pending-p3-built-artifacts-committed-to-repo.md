---
status: pending
priority: p3
issue_id: "093"
tags: [code-review, quality, gitignore]
dependencies: []
---

# Content-Hashed Build Artifacts Committed in `public/pro/assets/`

## Problem Statement

The PR diff includes content-hashed compiled artifacts (`public/pro/assets/index-CE0ARBnG.css`, `index-DCXuit2z.js`, etc.) committed to source control. These change on every rebuild, producing noisy diffs that make code review harder and inflate repository size over time.

## Findings

- `public/pro/assets/` contains compiled/bundled output files with content-hash suffixes
- TypeScript reviewer finding [16]: "These should not be committed to source control. They should be generated at build time."
- Every rebuild regenerates these with new hashes, creating a new diff entry

## Proposed Solutions

### Option 1: Add `public/pro/assets/` to `.gitignore`

**Approach:** Add `public/pro/assets/` to `.gitignore`. The build step generates these files before deploy.

**Pros:** Cleans up repo history going forward

**Cons:** Requires verifying the build pipeline generates these files before Vercel deploys (check `vercel.json` build command)

**Effort:** 15 min (including verification)

**Risk:** Low — if Vercel build step generates them, removing from git is safe

---

### Option 2: Keep committed (current state)

**Approach:** Accept the noise.

**Pros:** Zero change

**Cons:** Every rebuild = noisy PR diff; repo grows

**Effort:** 0

**Risk:** Low risk but bad practice

## Recommended Action

Option 1. Verify Vercel build command produces `public/pro/assets/` before gitignoring.

## Technical Details

- **Affected files:** `public/pro/assets/*.css`, `public/pro/assets/*.js`
- Check `vercel.json` `buildCommand` and local build scripts

## Acceptance Criteria

- [ ] `public/pro/assets/` added to `.gitignore`
- [ ] Verified that Vercel build step generates these files before serving
- [ ] Existing committed files removed from tracking (`git rm --cached`)

## Work Log

- 2026-03-30: Identified by kieran-typescript-reviewer during final /ce-review pass on PR #2024
