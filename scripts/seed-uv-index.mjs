#!/usr/bin/env node
/**
 * seed-uv-index.mjs
 *
 * Global UV Index — real-time and forecast from Open-Meteo UV API.
 * https://open-meteo.com/en/docs/air-quality-api — no key required.
 *
 * Fetches current UV index and daily max for 15 high-UV-risk cities
 * across tropical/subtropical zones and high-altitude locations.
 * Relevant for MRV: stratospheric ozone monitoring proxy.
 *
 * Stored at:  dmrv:uv-index:v1
 * Meta key:   seed-meta:dmrv:uv-index
 * TTL:        3600s (1h)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:uv-index:v1';
const CACHE_TTL     = 3600;
const FETCH_TIMEOUT = 20_000;

const LOCATIONS = [
  { name: 'Bogotá',       lat: 4.71,   lon: -74.07  },
  { name: 'Lima',         lat: -12.05, lon: -77.04  },
  { name: 'Nairobi',      lat: -1.29,  lon: 36.82   },
  { name: 'Dubai',        lat: 25.20,  lon: 55.27   },
  { name: 'Mumbai',       lat: 19.08,  lon: 72.88   },
  { name: 'Bangkok',      lat: 13.75,  lon: 100.52  },
  { name: 'Darwin',       lat: -12.46, lon: 130.84  },
  { name: 'Santiago',     lat: -33.45, lon: -70.67  },
  { name: 'Addis Ababa',  lat: 9.03,   lon: 38.74   },
  { name: 'Karachi',      lat: 24.86,  lon: 67.01   },
  { name: 'Cairo',        lat: 30.06,  lon: 31.25   },
  { name: 'Mexico City',  lat: 19.43,  lon: -99.13  },
  { name: 'Singapore',    lat: 1.35,   lon: 103.82  },
  { name: 'Riyadh',       lat: 24.69,  lon: 46.72   },
  { name: 'Lagos',        lat: 6.52,   lon: 3.38    },
];

async function fetchUV(loc) {
  const url = [
    'https://air-quality-api.open-meteo.com/v1/air-quality',
    `?latitude=${loc.lat}&longitude=${loc.lon}`,
    '&current=uv_index,uv_index_clear_sky',
    '&daily=uv_index_max,uv_index_clear_sky_max',
    '&timezone=auto',
    '&forecast_days=2',
  ].join('');
  const res = await fetch(url, {
    headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`UV HTTP ${res.status} ${loc.name}`);
  const d = await res.json();
  return {
    name:             loc.name,
    lat:              loc.lat,
    lon:              loc.lon,
    uv_now:           d.current?.uv_index,
    uv_clear_sky:     d.current?.uv_index_clear_sky,
    uv_max_today:     d.daily?.uv_index_max?.[0],
    uv_max_tomorrow:  d.daily?.uv_index_max?.[1],
    risk: uvRisk(d.current?.uv_index),
  };
}

function uvRisk(uv) {
  if (uv == null) return null;
  if (uv >= 11) return 'extreme';
  if (uv >= 8)  return 'very_high';
  if (uv >= 6)  return 'high';
  if (uv >= 3)  return 'moderate';
  return 'low';
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:uv-index',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const results = await Promise.allSettled(LOCATIONS.map(fetchUV));
    const locations = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (locations.length < 5) throw new Error(`Too many UV fetch failures: ${locations.length} succeeded`);

    const extreme = locations.filter(l => l.risk === 'extreme');
    const veryHigh = locations.filter(l => l.risk === 'very_high');

    await verifySeedKey(CANONICAL_KEY, 'locations');
    return {
      locations,
      summary: {
        extreme_count:  extreme.length,
        very_high_count: veryHigh.length,
        extreme_cities: extreme.map(l => l.name),
        max_uv:         Math.max(...locations.map(l => l.uv_max_today ?? 0)),
      },
      fetchedAt: new Date().toISOString(),
    };
  },
});
