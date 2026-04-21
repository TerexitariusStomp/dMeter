# free-api-catalog -> dMRV integration coverage

Catalog source reviewed:
- https://github.com/TerexitariusStomp/free-api-catalog
- commit: 86e0f79

This run integrated/confirmed all high-value dMRV-relevant APIs from that catalog that are practical for continuous seeding (real-time/near-real-time, environmental, climate, disaster, aviation, air quality).

## Newly integrated in this pass

1. AviationWeather (no auth)
- free-api-catalog entry: Aviation Weather / AviationWeather
- dMeter seeder: `scripts/seed-aviationweather.mjs`
- cache key: `dmrv:aviationweather:v1`
- endpoint: `GET /api/dmrv/aviationweather`

2. RainViewer (no auth)
- free-api-catalog entry: RainViewer
- dMeter seeder: `scripts/seed-rainviewer.mjs`
- cache key: `dmrv:rainviewer:v1`
- endpoint: `GET /api/dmrv/rainviewer`

3. PurpleAir (api key optional)
- free-api-catalog entry: Purple Air
- dMeter seeder: `scripts/seed-purpleair.mjs`
- cache key: `dmrv:purpleair:v1`
- endpoint: `GET /api/dmrv/purpleair`
- env: `PURPLEAIR_API_KEY`

4. Free UV Index API (CurrentUV)
- free-api-catalog entry: Free UV Index API
- dMeter seeder: `scripts/seed-currentuv.mjs`
- cache key: `dmrv:currentuv:v1`
- endpoint: `GET /api/dmrv/currentuv`

## Already integrated before this pass (confirmed)

- OpenAQ (air quality) -> `seed-health-air-quality.mjs` + `OPENAQ_API_KEY`
- AQICN/WAQI (air quality) -> `seed-health-air-quality.mjs` (`WAQI_API_KEY` or `AQICN_API_KEY`)
- OpenSky -> `seed-opensky.mjs`
- AviationStack -> existing aviation stack (`AVIATIONSTACK_API`)
- Open-Meteo -> `seed-open-meteo.mjs`
- NOAA buoy/ocean feeds -> `seed-noaa-buoys.mjs`
- USGS quakes/water -> `seed-usgs-quakes.mjs`, `seed-usgs-water.mjs`
- GDACS disasters -> `seed-gdacs.mjs`
- Flood monitoring -> `seed-flood-monitoring.mjs`
- Grid/energy public datasets -> `seed-grid-status.mjs`, `seed-energy-charts.mjs`, etc.

## dMRV control-plane updates applied

- Bundle expanded to 27 datasets:
  - `scripts/seed-bundle-dmrv.mjs`
- Bootstrap/cache/health parity updated:
  - `api/bootstrap.js`
  - `server/_shared/cache-keys.ts`
  - `api/seed-health.js`
- Ready gate updated with new optional datasets:
  - `api/dmrv/ready.js`

## Practical exclusion rule used

Some catalog entries were not promoted into dMRV ingestion because they are not practical for this pipeline:
- not environmental/dMRV domain
- purely commercial tiers with no practical free runtime path
- static/non-streaming datasets with low monitoring value
- duplicate providers where one already subsumes another feed

The integrated set is optimized for real-time dMRV usefulness, operational reliability, and free/no-auth-first coverage.