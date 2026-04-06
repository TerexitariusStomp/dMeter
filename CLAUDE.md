# WorldMonitor — Claude Instructions

## New Panel / Card Checklist (ENFORCED AT COMPILE TIME)

When adding any new card to `CountryDeepDivePanel` or any standalone panel:

1. **`sectionCard(title, helpText, panelId)`** — all 3 params are required by TypeScript. `helpText` explains data sources, methodology, and update frequency. `panelId` must be unique (`cdp-*` prefix for deep-dive sections).
2. **CMD+K entry** — add to `src/config/commands.ts` COMMANDS array. Use `id: 'panel:cdp-<panelId>'` for deep-dive sections, `id: 'panel:<id>'` for standalone panels.
3. **Test** — run `npm run typecheck` before pushing. Missing `helpText` or `panelId` is a type error.

## RPC / Seeder Checklist

When adding a new seeded RPC:

- `cache-keys.ts` — add cache key constant
- `api/health.js` — add to STANDALONE_KEYS (existence check) AND SEED_META (freshness check)
- `api/bootstrap.js` — only if a `getHydratedData()` consumer exists in `src/`
- `server/worldmonitor/.../handler.ts` — register handler
- `server/gateway.ts` — add cache tier
- Run `make generate` after proto changes

## Railway Seeders

- TTL ≥ 3× cron interval
- Retry in 20 min on failure
- `extendExistingTtl` on both failure paths
- Clear retry timer on success
- Health `maxStaleMin` = 2× interval
