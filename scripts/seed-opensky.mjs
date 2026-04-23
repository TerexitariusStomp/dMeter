#!/usr/bin/env node
/**
 * seed-opensky.mjs
 *
 * OpenSky Network — real-time aircraft state vectors worldwide.
 * https://opensky-network.org/apidoc/rest.html — no key for anonymous access.
 *
 * Anonymous access: 400 API credits/day, 10s between calls, bounding box queries.
 * Fetches state vectors for a representative set of global bounding boxes
 * covering major air corridors relevant to dMRV (cargo, logistics, military).
 *
 * Stored at:  dmrv:opensky:v1
 * Meta key:   seed-meta:dmrv:opensky
 * TTL:        600s (10min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:opensky:v1';
const CACHE_TTL     = 600;
const FETCH_TIMEOUT = 20_000;

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

// Major airspace bounding boxes [lamin, lomin, lamax, lomax]
const REGIONS = [
  { name: 'North Atlantic',    box: [45,  -60, 65,  -10] },
  { name: 'Europe',            box: [35,   -10, 60,   40] },
  { name: 'Middle East',       box: [15,   35,  40,   65] },
  { name: 'South Asia',        box: [5,    60,  35,   95] },
  { name: 'East Asia',         box: [20,   100, 50,  145] },
  { name: 'North America',     box: [25,  -130, 55,  -60] },
];

// State vector fields: [icao24, callsign, origin_country, time_position,
//   last_contact, longitude, latitude, baro_altitude, on_ground, velocity,
//   true_track, vertical_rate, sensors, geo_altitude, squawk, spi, position_source]
function parseState(s) {
  return {
    icao24:       s[0],
    callsign:     (s[1] ?? '').trim() || null,
    country:      s[2],
    lat:          s[6],
    lon:          s[5],
    altitude_m:   s[7],
    on_ground:    s[8],
    velocity_ms:  s[9],
    heading:      s[10],
    vert_rate_ms: s[11],
  };
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:opensky',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    // Fetch one region (rotate by hour to stay within anonymous credit limits)
    const regionIdx = Math.floor(Date.now() / 3_600_000) % REGIONS.length;
    const region    = REGIONS[regionIdx];
    const [lamin, lomin, lamax, lomax] = region.box;

    const url = [
      'https://opensky-network.org/api/states/all',
      `?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`,
    ].join('');

    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
    const data = await res.json();

    const states = (data.states ?? []).map(parseState);
    const airborne = states.filter(s => !s.on_ground);

    // Country counts
    const countryCounts = {};
    for (const s of airborne) {
      if (s.country) countryCounts[s.country] = (countryCounts[s.country] ?? 0) + 1;
    }
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    await verifySeedKey(CANONICAL_KEY, 'states');
    return {
      region:        region.name,
      total:         states.length,
      airborne:      airborne.length,
      on_ground:     states.length - airborne.length,
      top_countries: topCountries,
      sample:        airborne.slice(0, 50),
      snapshot_time: data.time,
      fetchedAt:     new Date().toISOString(),
    };
  },
});
