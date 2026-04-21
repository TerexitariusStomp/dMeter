#!/usr/bin/env node
/**
 * seed-opensensemap.mjs
 *
 * Fetches IoT citizen-science environmental observations from openSenseMap.
 * https://opensensemap.org  — operated by the Institute for Geoinformatics, Uni Münster.
 *
 * API: https://api.opensensemap.org/boxes  (no key required, Apache 2.0)
 * Exposure endpoint returns the last measured values per box.
 *
 * Stored at:  dmrv:opensensemap:v1
 * Meta key:   seed-meta:dmrv:opensensemap
 * TTL:        1800s (30min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY  = 'dmrv:opensensemap:v1';
const CACHE_TTL      = 1800;
const API_BASE       = 'https://api.opensensemap.org';
// minimal=true returns compact records; bbox covers the globe
// This avoids the full=true payload which is 2.6MB+ and times out
const BOXES_URL      = `${API_BASE}/boxes?minimal=true&exposure=outdoor&format=json&bbox=-180,-90,180,90`;
const FETCH_TIMEOUT  = 60_000;
const MAX_BOXES      = 500;  // minimal payloads are small enough

/** Canonical sensor phenomenon aliases */
const PHENOM_MAP = {
  'PM2.5':           'pm25_ugm3',
  'pm2.5':           'pm25_ugm3',
  'Feinstaub':       'pm25_ugm3',
  'PM10':            'pm10_ugm3',
  'Temperatur':      'temp_c',
  'Temperature':     'temp_c',
  'Luftfeuchtigkeit':'humidity_pct',
  'rel. Luftfeuchte':'humidity_pct',
  'Humidity':        'humidity_pct',
  'Luftdruck':       'pressure_hpa',
  'Luftdruck (rel.)':'pressure_hpa',
  'Pressure':        'pressure_hpa',
  'CO2':             'co2_ppm',
  'UV-Intensität':   'uv_index',
  'Lautstärke':      'noise_dba',
};

function extractParams(sensors) {
  const params = {};
  for (const s of (sensors || [])) {
    const key = PHENOM_MAP[s.title] || PHENOM_MAP[s.phenomenon];
    if (!key) continue;
    const lastMeasurement = s.lastMeasurement;
    if (!lastMeasurement?.value) continue;
    const num = parseFloat(lastMeasurement.value);
    if (isFinite(num)) params[key] = Math.round(num * 100) / 100;
  }
  return params;
}

function parseBoxes(raw) {
  if (!Array.isArray(raw)) return [];
  const boxes = [];
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(); // active in last 7d

  for (const box of raw) {
    const coords = box?.currentLocation?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lon = parseFloat(coords[0]);
    const lat = parseFloat(coords[1]);
    if (!isFinite(lat) || !isFinite(lon)) continue;

    // minimal=true: no sensors array, just check lastMeasurementAt
    if (!box.lastMeasurementAt || box.lastMeasurementAt < cutoff) continue;

    boxes.push({
      id:          `osm-${box._id || box.id}`,
      name:        box.name || null,
      lat,
      lon,
      exposure:    box.exposure || 'outdoor',
      last_seen:   box.lastMeasurementAt,
    });

    if (boxes.length >= MAX_BOXES) break;
  }
  return boxes;
}

async function fetchBoxes() {
  const res = await fetch(BOXES_URL, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`openSenseMap HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:opensensemap',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const raw  = await fetchBoxes();
    const boxes = parseBoxes(raw);
    if (boxes.length < 50) {
      throw new Error(`Too few openSenseMap boxes: ${boxes.length}`);
    }

    const summary = {
      total:          boxes.length,
      active_7d:      boxes.length,
      sample_regions: [...new Set(boxes.slice(0,20).map(b => `${Math.round(b.lat)},${Math.round(b.lon)}`))].length,
    };

    await verifySeedKey(CANONICAL_KEY, 'boxes');
    return { boxes, summary, fetchedAt: new Date().toISOString() };
  },
});
