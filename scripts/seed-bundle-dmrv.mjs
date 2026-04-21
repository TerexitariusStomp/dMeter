#!/usr/bin/env node
/**
 * seed-bundle-dmrv.mjs
 *
 * Bundle orchestrator for the full dMRV (decentralized Monitoring, Reporting,
 * and Verification) data layer.
 *
 * Runs the following seeders in order:
 *   1. Sensor.Community IoT network      (30min)
 *   2. openSenseMap IoT network          (30min)
 *   3. EMSC European seismology          (10min)
 *   4. NOAA ocean buoys                  (1h)
 *   5. Flood monitoring (UK EA + DFO)    (15min)
 *   6. USGS water resources              (15min)
 *   7. GreyNoise cyber intelligence      (1h)
 *   8. Grid status / US energy grid      (5min)
 *
 * Deployed as a Railway cron service on a 15-minute tick.
 * Each seeder has its own freshness gate so it only re-fetches when due.
 */

import { runBundle, HOUR, DAY, MIN } from './_bundle-runner.mjs';

await runBundle('dmrv', [
  {
    label:        'Sensor-Community',
    script:       'seed-sensor-community.mjs',
    seedMetaKey:  'seed-meta:dmrv:sensor-community',
    canonicalKey: 'dmrv:sensor-community:v1',
    intervalMs:   30 * MIN,
    timeoutMs:    120_000,
  },
  {
    label:        'openSenseMap',
    script:       'seed-opensensemap.mjs',
    seedMetaKey:  'seed-meta:dmrv:opensensemap',
    canonicalKey: 'dmrv:opensensemap:v1',
    intervalMs:   30 * MIN,
    timeoutMs:    120_000,
  },
  {
    label:        'EMSC-Earthquakes',
    script:       'seed-emsc-earthquakes.mjs',
    seedMetaKey:  'seed-meta:dmrv:emsc-earthquakes',
    canonicalKey: 'dmrv:emsc-earthquakes:v1',
    intervalMs:   10 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'NOAA-Buoys',
    script:       'seed-noaa-buoys.mjs',
    seedMetaKey:  'seed-meta:dmrv:noaa-buoys',
    canonicalKey: 'dmrv:noaa-buoys:v1',
    intervalMs:   HOUR,
    timeoutMs:    60_000,
  },
  {
    label:        'Flood-Monitoring',
    script:       'seed-flood-monitoring.mjs',
    seedMetaKey:  'seed-meta:dmrv:flood-monitoring',
    canonicalKey: 'dmrv:flood-monitoring:v1',
    intervalMs:   15 * MIN,
    timeoutMs:    60_000,
  },
  {
    label:        'USGS-Water',
    script:       'seed-usgs-water.mjs',
    seedMetaKey:  'seed-meta:dmrv:usgs-water',
    canonicalKey: 'dmrv:usgs-water:v1',
    intervalMs:   15 * MIN,
    timeoutMs:    90_000,
  },
  {
    label:        'GreyNoise',
    script:       'seed-greynoise.mjs',
    seedMetaKey:  'seed-meta:dmrv:greynoise',
    canonicalKey: 'dmrv:greynoise:v1',
    intervalMs:   HOUR,
    timeoutMs:    30_000,
  },
  {
    label:        'Grid-Status',
    script:       'seed-grid-status.mjs',
    seedMetaKey:  'seed-meta:dmrv:grid-status',
    canonicalKey: 'dmrv:grid-status:v1',
    intervalMs:   5 * MIN,
    timeoutMs:    60_000,
  },
  // ── New sources from free-api-catalog ──────────────────────────────────────
  {
    label:        'Open-Meteo',
    script:       'seed-open-meteo.mjs',
    seedMetaKey:  'seed-meta:dmrv:open-meteo',
    canonicalKey: 'dmrv:open-meteo:v1',
    intervalMs:   30 * MIN,
    timeoutMs:    120_000,
  },
  {
    label:        'UK-Carbon',
    script:       'seed-uk-carbon.mjs',
    seedMetaKey:  'seed-meta:dmrv:uk-carbon',
    canonicalKey: 'dmrv:uk-carbon:v1',
    intervalMs:   30 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'Danish-Energi',
    script:       'seed-danish-energi.mjs',
    seedMetaKey:  'seed-meta:dmrv:danish-energi',
    canonicalKey: 'dmrv:danish-energi:v1',
    intervalMs:   30 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'GruenStrom',
    script:       'seed-gruenstrom.mjs',
    seedMetaKey:  'seed-meta:dmrv:gruenstrom',
    canonicalKey: 'dmrv:gruenstrom:v1',
    intervalMs:   HOUR,
    timeoutMs:    30_000,
  },
  {
    label:        'OpenSky',
    script:       'seed-opensky.mjs',
    seedMetaKey:  'seed-meta:dmrv:opensky',
    canonicalKey: 'dmrv:opensky:v1',
    intervalMs:   10 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'NOAA-NGDC',
    script:       'seed-noaa-ngdc.mjs',
    seedMetaKey:  'seed-meta:dmrv:noaa-ngdc',
    canonicalKey: 'dmrv:noaa-ngdc:v1',
    intervalMs:   HOUR,
    timeoutMs:    45_000,
  },
  {
    label:        'UV-Index',
    script:       'seed-uv-index.mjs',
    seedMetaKey:  'seed-meta:dmrv:uv-index',
    canonicalKey: 'dmrv:uv-index:v1',
    intervalMs:   HOUR,
    timeoutMs:    60_000,
  },
  {
    label:        'PM25-LASS',
    script:       'seed-pm25-lass.mjs',
    seedMetaKey:  'seed-meta:dmrv:pm25-lass',
    canonicalKey: 'dmrv:pm25-lass:v1',
    intervalMs:   30 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'OpenFEMA',
    script:       'seed-openfema.mjs',
    seedMetaKey:  'seed-meta:dmrv:openfema',
    canonicalKey: 'dmrv:openfema:v1',
    intervalMs:   HOUR,
    timeoutMs:    45_000,
  },
  {
    label:        'Open-Charge',
    script:       'seed-open-charge.mjs',
    seedMetaKey:  'seed-meta:dmrv:open-charge',
    canonicalKey: 'dmrv:open-charge:v1',
    intervalMs:   2 * HOUR,
    timeoutMs:    60_000,
  },
  {
    label:        'Luchtmeetnet',
    script:       'seed-luchtmeetnet.mjs',
    seedMetaKey:  'seed-meta:dmrv:luchtmeetnet',
    canonicalKey: 'dmrv:luchtmeetnet:v1',
    intervalMs:   30 * MIN,
    timeoutMs:    45_000,
  },
  {
    label:        'GDACS Disasters',
    script:       'seed-gdacs.mjs',
    seedMetaKey:  'seed-meta:dmrv:gdacs',
    canonicalKey: 'dmrv:gdacs:v1',
    intervalMs:   15 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'Energy-Charts EU',
    script:       'seed-energy-charts.mjs',
    seedMetaKey:  'seed-meta:dmrv:energy-charts',
    canonicalKey: 'dmrv:energy-charts:v1',
    intervalMs:   15 * MIN,
    timeoutMs:    60_000,
  },
  {
    label:        'USGS Earthquakes',
    script:       'seed-usgs-quakes.mjs',
    seedMetaKey:  'seed-meta:dmrv:usgs-quakes',
    canonicalKey: 'dmrv:usgs-quakes:v1',
    intervalMs:   10 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'Copernicus Atmosphere',
    script:       'seed-copernicus-atmos.mjs',
    seedMetaKey:  'seed-meta:dmrv:copernicus-atmos',
    canonicalKey: 'dmrv:copernicus-atmos:v1',
    intervalMs:   HOUR,
    timeoutMs:    60_000,
  },

  {
    label:        'AviationWeather',
    script:       'seed-aviationweather.mjs',
    seedMetaKey:  'seed-meta:dmrv:aviationweather',
    canonicalKey: 'dmrv:aviationweather:v1',
    intervalMs:   10 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'RainViewer',
    script:       'seed-rainviewer.mjs',
    seedMetaKey:  'seed-meta:dmrv:rainviewer',
    canonicalKey: 'dmrv:rainviewer:v1',
    intervalMs:   10 * MIN,
    timeoutMs:    30_000,
  },
  {
    label:        'PurpleAir',
    script:       'seed-purpleair.mjs',
    seedMetaKey:  'seed-meta:dmrv:purpleair',
    canonicalKey: 'dmrv:purpleair:v1',
    intervalMs:   30 * MIN,
    timeoutMs:    45_000,
  },
  {
    label:        'CurrentUV',
    script:       'seed-currentuv.mjs',
    seedMetaKey:  'seed-meta:dmrv:currentuv',
    canonicalKey: 'dmrv:currentuv:v1',
    intervalMs:   HOUR,
    timeoutMs:    30_000,
  },
], { maxBundleMs: 27 * 60_000 }); // 27min budget for 27-dataset bundle
