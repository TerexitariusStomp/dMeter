#!/usr/bin/env node
/**
 * seed-noaa-ngdc.mjs
 *
 * NOAA National Centers for Environmental Information (NCEI/NGDC).
 * Natural hazards data: significant earthquakes, tsunamis, volcanic eruptions.
 * https://www.ngdc.noaa.gov/hazel/hazard-service — no key required.
 *
 * Complements USGS real-time feed with NOAA's historical + significant event database.
 * Useful for MRV: cross-validation of seismic events and hazard baselines.
 *
 * Stored at:  dmrv:noaa-ngdc:v1
 * Meta key:   seed-meta:dmrv:noaa-ngdc
 * TTL:        3600s (1h)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:noaa-ngdc:v1';
const CACHE_TTL     = 3600;
const FETCH_TIMEOUT = 20_000;
const BASE         = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1';

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

const thisYear  = new Date().getFullYear();
const lastYear  = thisYear - 1;

async function fetchHazard(endpoint, params = '') {
  const url = `${BASE}/${endpoint}?${params}&format=json&maxResults=100`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`NOAA NGDC ${endpoint} HTTP ${res.status}`);
  const json = await res.json();
  return json.items ?? json.data ?? [];
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:noaa-ngdc',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [earthquakes, tsunamis, volcanoes] = await Promise.allSettled([
      fetchHazard('earthquakes', `minYear=${lastYear}&maxYear=${thisYear}&minMagnitude=5.0`),
      fetchHazard('tsunamis/events', `minYear=${lastYear}&maxYear=${thisYear}`),
      fetchHazard('volcanoes/events', `minYear=${lastYear}&maxYear=${thisYear}`),
    ]);

    const eq  = earthquakes.status  === 'fulfilled' ? earthquakes.value  : [];
    const ts  = tsunamis.status     === 'fulfilled' ? tsunamis.value     : [];
    const vol = volcanoes.status    === 'fulfilled' ? volcanoes.value    : [];

    if (!eq.length && !ts.length && !vol.length) {
      throw new Error('NOAA NGDC returned no data for any hazard type');
    }

    await verifySeedKey(CANONICAL_KEY, 'earthquakes');
    return {
      earthquakes: eq.slice(0, 50).map(e => ({
        year:      e.year,
        month:     e.month,
        day:       e.day,
        lat:       e.latitude,
        lon:       e.longitude,
        magnitude: e.eqMagnitude ?? e.magnitude,
        depth_km:  e.focal_depth ?? e.focalDepth,
        country:   e.country,
        deaths:    e.deaths,
      })),
      tsunamis: ts.slice(0, 20).map(t => ({
        year:    t.year,
        month:   t.month,
        day:     t.day,
        lat:     t.latitude,
        lon:     t.longitude,
        cause:   t.causeCode,
        country: t.country,
        deaths:  t.deaths,
        maxWave: t.maxWaterHeight,
      })),
      volcanoes: vol.slice(0, 20).map(v => ({
        year:    v.year,
        month:   v.month,
        name:    v.name ?? v.volName,
        country: v.country,
        type:    v.typeOfActivity,
        deaths:  v.deaths,
      })),
      counts: { earthquakes: eq.length, tsunamis: ts.length, volcanoes: vol.length },
      fetchedAt: new Date().toISOString(),
    };
  },
});
