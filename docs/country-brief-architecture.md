# Country Brief: Exposure and Cost Shock Architecture

Issue: #2969

## Problem

Sector Exposure and Cost Shock widgets in Country Brief read divergent data sources.
Sector Exposure scored 0-100 from a static JSON map of route proximity.
Cost Shock computed deficit from live Comtrade crude flows + JODI demand + PortWatch disruption ratios.
Different sources produced contradictory signals visible side-by-side.

## Decision: Unify on Comtrade Flows (Option 1)

For HS 27 (energy) and the 4 shock-model chokepoints (Hormuz, Suez, Malacca, Bab el-Mandeb):

**Exposure score** = `gulfCrudeShare x CHOKEPOINT_EXPOSURE[cpId] x flowRatio x 100`, capped at 100.

This is the same formula Cost Shock uses internally to compute `gulfCrudeShare` before feeding it into the deficit model. Both widgets now derive from the same Comtrade + PortWatch data, guaranteeing directional consistency.

### Data sources (shared)

| Source | Redis key | Used by |
|--------|-----------|---------|
| Comtrade crude flows | `comtrade:flows:${code}:2709` | Exposure + Cost Shock |
| PortWatch flow ratios | `energy:chokepoint-flows:v1` | Exposure + Cost Shock |
| JODI Oil demand | `energy:jodi-oil:v1:${code}` | Cost Shock only |
| IEA strategic stocks | `energy:iea-oil-stocks:v1:${code}` | Cost Shock only |

### Fallback chain

1. Comtrade data available: use actual Gulf crude share
2. No Comtrade data: proxy at 40% (same `PROXIED_GULF_SHARE` constant as Cost Shock)
3. PortWatch unavailable: assume `flowRatio = 1.0` (same degraded path as Cost Shock)

### Non-shock-model chokepoints

Bosporus, Panama, Taiwan Strait, etc. have no energy shock model.
These retain static route-overlap scoring from `country-port-clusters.json`.
The response carries `shockSupported: false` so the UI can indicate the limitation.

### Non-energy sectors

HS codes other than 27 use static route-overlap scoring.
Multi-sector cost shock (Phase 5) uses bilateral HS4 data via a separate endpoint.
Unifying non-energy sectors on flow data is deferred to v2.

## Cache alignment

Exposure cache TTL reduced from 24h to 10min (600s), closer to Cost Shock's 300s.
Cache key bumped to v2 so stale static scores expire on deploy.

## Files

- `server/worldmonitor/supply-chain/v1/get-country-chokepoint-index.ts` — flow-based scoring
- `server/worldmonitor/intelligence/v1/compute-energy-shock.ts` — shared `getGulfCrudeShare`
- `server/worldmonitor/intelligence/v1/_shock-compute.ts` — shared `CHOKEPOINT_EXPOSURE` constants
- `server/_shared/cache-keys.ts` — v2 exposure cache key
