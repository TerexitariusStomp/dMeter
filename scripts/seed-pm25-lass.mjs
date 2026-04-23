#!/usr/bin/env node
/**
 * seed-pm25-lass.mjs
 *
 * LASS-net PM2.5 Open Data Portal — Taiwan IoT citizen sensor network.
 * https://pm25.lass-net.org/#apis — no key required.
 *
 * Provides real-time PM2.5 readings from thousands of low-cost sensors
 * deployed across Taiwan and parts of Asia. Ideal for dMRV citizen science
 * air quality ground-truth data.
 *
 * Stored at:  dmrv:pm25-lass:v1
 * Meta key:   seed-meta:dmrv:pm25-lass
 * TTL:        1800s (30min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:pm25-lass:v1';
const CACHE_TTL     = 1800;
const FETCH_TIMEOUT = 20_000;

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:pm25-lass',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    // Use project/airbox endpoint — returns active AirBox devices
    const res = await fetch(
      'https://pm25.lass-net.org/API-1.0.0/project/airbox/latest/',
      { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) }
    );
    if (!res.ok) throw new Error(`LASS-net HTTP ${res.status}`);
    const data = await res.json();

    const feeds = data.feeds ?? [];

    // Parse readings
    const readings = feeds
      .map(f => {
        const pm = parseFloat(f['s_d0'] ?? f['PM2_5'] ?? f.pm25 ?? null);
        const lat = parseFloat(f.gps_lat ?? f.lat ?? null);
        const lon = parseFloat(f.gps_lon ?? f.lon ?? null);
        return {
          device:    f.name ?? f.device_id,
          area:      f.area ?? null,
          lat:       isNaN(lat) ? null : lat,
          lon:       isNaN(lon) ? null : lon,
          pm2_5:     isNaN(pm)  ? null : pm,
          timestamp: f.date && f.time ? `${f.date}T${f.time}Z` : null,
        };
      })
      .filter(r => r.pm2_5 !== null && r.pm2_5 >= 0 && r.pm2_5 <= 1000);

    if (!readings.length) throw new Error('LASS-net returned no valid PM2.5 readings');

    // AQI category counts
    const categories = { good: 0, moderate: 0, sensitive: 0, unhealthy: 0, very_unhealthy: 0, hazardous: 0 };
    for (const r of readings) {
      const pm = r.pm2_5;
      if (pm <= 12)      categories.good++;
      else if (pm <= 35.4) categories.moderate++;
      else if (pm <= 55.4) categories.sensitive++;
      else if (pm <= 150.4) categories.unhealthy++;
      else if (pm <= 250.4) categories.very_unhealthy++;
      else                  categories.hazardous++;
    }

    const avg = readings.reduce((s, r) => s + r.pm2_5, 0) / readings.length;

    await verifySeedKey(CANONICAL_KEY, 'readings');
    return {
      total_sensors: readings.length,
      avg_pm2_5:     Math.round(avg * 10) / 10,
      categories,
      hotspots: readings
        .filter(r => r.pm2_5 > 55)
        .sort((a, b) => b.pm2_5 - a.pm2_5)
        .slice(0, 20),
      sample: readings.slice(0, 100),
      fetchedAt: new Date().toISOString(),
    };
  },
});
