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

5. GBIF API (no auth)
- free-api-catalog entry: GBIF API
- dMeter seeder: `scripts/seed-gbif-biodiversity.mjs`
- cache key: `dmrv:gbif-biodiversity:v1`
- endpoint: `GET /api/dmrv/gbif-biodiversity`

6. OBIS API (no auth)
- free-api-catalog entry: OBIS API
- dMeter seeder: `scripts/seed-obis-marine.mjs`
- cache key: `dmrv:obis-marine:v1`
- endpoint: `GET /api/dmrv/obis-marine`

7. Open Topo Data (no auth)
- free-api-catalog entry: Open Topo Data
- dMeter seeder: `scripts/seed-opentopodata.mjs`
- cache key: `dmrv:opentopodata:v1`
- endpoint: `GET /api/dmrv/opentopodata`

8. 7Timer (no auth)
- free-api-catalog entry: 7Timer
- dMeter seeder: `scripts/seed-7timer-forecast.mjs`
- cache key: `dmrv:7timer-forecast:v1`
- endpoint: `GET /api/dmrv/7timer-forecast`

9. Meteorologisk institutt API (api.met.no, no key)
- free-api-catalog entry: Meteorologisk Institutt
- dMeter seeder: `scripts/seed-metno-forecast.mjs`
- cache key: `dmrv:metno-forecast:v1`
- endpoint: `GET /api/dmrv/metno-forecast`

10. Aare.guru API (no auth)
- free-api-catalog entry: Aare.guru API
- dMeter seeder: `scripts/seed-aare-river.mjs`
- cache key: `dmrv:aare-river:v1`
- endpoint: `GET /api/dmrv/aare-river`

11. adresse.data.gouv.fr (no auth)
- free-api-catalog entry: adresse.data.gouv.fr
- dMeter seeder: `scripts/seed-adresse-geocode.mjs`
- cache key: `dmrv:adresse-geocode:v1`
- endpoint: `GET /api/dmrv/adresse-geocode`

12. API Status Check (no auth)
- free-api-catalog entry: API Status Check
- dMeter seeder: `scripts/seed-api-status-check.mjs`
- cache key: `dmrv:api-status-check:v1`
- endpoint: `GET /api/dmrv/api-status-check`

13. NASA Open APIs (DEMO key supported)
- free-api-catalog entry: NASA Open APIs
- dMeter seeder: `scripts/seed-nasa-open.mjs`
- cache key: `dmrv:nasa-open:v1`
- endpoint: `GET /api/dmrv/nasa-open`

14. NOAA NWS API (no auth)
- free-api-catalog entry: NOAA NWS API / National Weather Service
- dMeter seeder: `scripts/seed-noaa-nws-alerts.mjs`
- cache key: `dmrv:noaa-nws-alerts:v1`
- endpoint: `GET /api/dmrv/noaa-nws-alerts`

15. NASA POWER API (no auth)
- free-api-catalog entry: NASA POWER API
- dMeter seeder: `scripts/seed-nasa-power.mjs`
- cache key: `dmrv:nasa-power:v1`
- endpoint: `GET /api/dmrv/nasa-power`

16. Open Notify ISS (no auth)
- free-api-catalog entry: Open Notify / ISS Current Location
- dMeter seeder: `scripts/seed-open-notify-iss.mjs`
- cache key: `dmrv:open-notify-iss:v1`
- endpoint: `GET /api/dmrv/open-notify-iss`

17. Open-Elevation API (no auth)
- free-api-catalog entry: Open-Elevation API
- dMeter seeder: `scripts/seed-open-elevation.mjs`
- cache key: `dmrv:open-elevation:v1`
- endpoint: `GET /api/dmrv/open-elevation`

18. NOAA NWS API Forecast (no auth)
- free-api-catalog entry: NOAA NWS API / National Weather Service
- dMeter seeder: `scripts/seed-noaa-nws-forecast.mjs`
- cache key: `dmrv:noaa-nws-forecast:v1`
- endpoint: `GET /api/dmrv/noaa-nws-forecast`

19. Global Flood API (no auth)
- free-api-catalog entry: Global Flood API
- dMeter seeder: `scripts/seed-global-flood-api.mjs`
- cache key: `dmrv:global-flood-api:v1`
- endpoint: `GET /api/dmrv/global-flood-api`

20. Open-Meteo Air Quality API (no auth)
- free-api-catalog entry: Air Quality API (Open-Meteo)
- dMeter seeder: `scripts/seed-open-meteo-air-quality.mjs`
- cache key: `dmrv:open-meteo-air-quality:v1`
- endpoint: `GET /api/dmrv/open-meteo-air-quality`

21. Open-Meteo Marine API (no auth)
- free-api-catalog entry: Marine API (Open-Meteo)
- dMeter seeder: `scripts/seed-open-meteo-marine.mjs`
- cache key: `dmrv:open-meteo-marine:v1`
- endpoint: `GET /api/dmrv/open-meteo-marine`

22. WoRMS API (no auth)
- free-api-catalog entry: WoRMS
- dMeter seeder: `scripts/seed-worms-marine-species.mjs`
- cache key: `dmrv:worms-marine-species:v1`
- endpoint: `GET /api/dmrv/worms-marine-species`

23. TLE API (no auth)
- free-api-catalog entry: TLE / Satellite TLE Data
- dMeter seeder: `scripts/seed-tle-satellites.mjs`
- cache key: `dmrv:tle-satellites:v1`
- endpoint: `GET /api/dmrv/tle-satellites`

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

- Bundle expanded to 37 datasets:
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

## Additional integration wave

Additional free-api-catalog entries integrated in this wave:
- OpenStreetMap Overpass -> `scripts/seed-overpass-osm.mjs` -> `dmrv:overpass-osm:v1`
- Nominatim -> `scripts/seed-nominatim-geocode.mjs` -> `dmrv:nominatim-geocode:v1`
- wttr.in -> `scripts/seed-wttr-weather.mjs` -> `dmrv:wttr-weather:v1`

The integrated set is optimized for real-time dMRV usefulness, operational reliability, and free/no-auth-first coverage.