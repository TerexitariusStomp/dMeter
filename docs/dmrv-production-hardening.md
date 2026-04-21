# dMRV production hardening policy

This policy defines readiness gating for the dMRV layer and classifies feeds into REQUIRED vs OPTIONAL.

## Readiness endpoint

- Endpoint: `GET /api/dmrv/ready`
- Behavior:
  - Returns `200` when required coverage ratio >= threshold (default `0.8`)
  - Returns `503` when required coverage ratio is below threshold
  - Optional feeds do not fail readiness; they are reported as degraded
- Threshold override:
  - `GET /api/dmrv/ready?threshold=0.9`

## Required feeds (gate readiness)

These are core, mostly keyless/robust sources and should stay healthy for production readiness:

1. sensor-community
2. opensensemap
3. emsc-earthquakes
4. noaa-buoys
5. flood-monitoring
6. usgs-water
7. grid-status
8. open-meteo
9. gdacs
10. usgs-quakes

## Optional feeds (report degradation only)

These are useful but can be key-limited, region-limited, or more volatile:

1. greynoise
2. uk-carbon
3. danish-energi
4. gruenstrom
5. opensky
6. noaa-ngdc
7. uv-index
8. pm25-lass
9. openfema
10. open-charge
11. luchtmeetnet
12. energy-charts
13. copernicus-atmos

## Containerized smoke tests run

Smoke tests were executed against running containers (`dmrv-seeder`, `dmrv-api`, `dmrv-redis`) with per-script timeout guards.

Results artifact:
- `docs/dmrv-smoke-report.json`

Summary from latest run:
- Required: 10/10 script runs returned success exit codes
- Optional sample: 4/4 script runs returned success exit codes
- Noted data-level degradation in some optional/provider paths (e.g. GridStatus/Open Charge fallback paths), which is expected and does not block readiness by policy.

## Operational guidance

- Keep REQUIRED feeds free/keyless where possible.
- Treat API-key-dependent feeds as OPTIONAL unless they are contractually guaranteed in your deployment.
- If promoting an OPTIONAL feed to REQUIRED, first verify:
  - Stable upstream SLA over at least 7 days
  - Quota headroom
  - Clear fallback behavior
  - Seeder metadata freshness (`seed-meta:dmrv:*`) consistency
