#!/usr/bin/env node
/**
 * seed-sensor-community.mjs
 *
 * Fetches global IoT air-quality and environmental sensor data from
 * Sensor.Community (formerly Luftdaten / sensor.community).
 * https://sensor.community/en/
 *
 * API: https://data.sensor.community/static/v2/data.json  (no key required)
 * Returns ~15,000+ geolocated sensor readings globally.
 *
 * Stored at:  dmrv:sensor-community:v1
 * Meta key:   seed-meta:dmrv:sensor-community
 * TTL:        1800s (30min) — data refreshes ~5 min upstream
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY  = 'dmrv:sensor-community:v1';
const CACHE_TTL      = 1800; // 30min
const API_URL        = 'https://data.sensor.community/static/v2/data.json';
const MAX_SENSORS    = 20000;
const FETCH_TIMEOUT  = 60_000; // large payload ~20MB

/** Map Sensor.Community phenomenons to canonical param names */
const PARAM_MAP = {
  P1:          'pm10_ugm3',
  P2:          'pm25_ugm3',
  temperature: 'temp_c',
  humidity:    'humidity_pct',
  pressure:    'pressure_hpa',
  noise_LAeq:  'noise_dba',
};

function normalizeSensorType(sensorTypeName) {
  const name = (sensorTypeName || '').toLowerCase();
  if (name.includes('sds') || name.includes('pms') || name.includes('nova')) return 'particulate';
  if (name.includes('dht') || name.includes('bme') || name.includes('bmp')) return 'climate';
  if (name.includes('scd') || name.includes('mhz') || name.includes('ccs')) return 'gas';
  if (name.includes('noise') || name.includes('spl')) return 'noise';
  return 'other';
}

function parseSensors(rawArray) {
  if (!Array.isArray(rawArray)) return [];
  const stations = [];

  for (const item of rawArray) {
    const loc = item?.location;
    if (!loc) continue;
    const lat = parseFloat(loc.latitude);
    const lon = parseFloat(loc.longitude);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) continue; // skip null-island

    const sensor = item?.sensor;
    const sensorType = sensor?.sensor_type?.name || 'unknown';
    const params = {};

    for (const val of (item?.sensordatavalues || [])) {
      const key = PARAM_MAP[val.value_type];
      if (key) {
        const num = parseFloat(val.value);
        if (isFinite(num)) params[key] = Math.round(num * 10) / 10;
      }
    }

    // Skip stations with no mapped readings
    if (Object.keys(params).length === 0) continue;

    stations.push({
      id:           `sc-${item.id}`,
      lat,
      lon,
      country:      loc.country || null,
      altitude_m:   parseFloat(loc.altitude) || null,
      sensor_type:  normalizeSensorType(sensorType),
      sensor_name:  sensorType,
      timestamp:    item.timestamp || null,
      params,
    });

    if (stations.length >= MAX_SENSORS) break;
  }
  return stations;
}

async function fetchSensorCommunity() {
  const res = await fetch(API_URL, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`Sensor.Community HTTP ${res.status}`);
  const raw = await res.json();
  return parseSensors(raw);
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:sensor-community',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const stations = await fetchSensorCommunity();
    if (stations.length < 100) {
      throw new Error(`Too few Sensor.Community stations: ${stations.length}`);
    }

    const summary = {
      total:       stations.length,
      byType:      Object.fromEntries(
        ['particulate', 'climate', 'gas', 'noise', 'other'].map(t => [
          t, stations.filter(s => s.sensor_type === t).length,
        ]),
      ),
      withPm25:    stations.filter(s => s.params.pm25_ugm3 != null).length,
      countries:   [...new Set(stations.map(s => s.country).filter(Boolean))].length,
    };

    await verifySeedKey(CANONICAL_KEY, 'stations');
    return { stations, summary, fetchedAt: new Date().toISOString() };
  },
});
