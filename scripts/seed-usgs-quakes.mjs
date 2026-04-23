#!/usr/bin/env node
/**
 * seed-usgs-quakes.mjs
 *
 * USGS Earthquake Hazards Program — real-time global seismic activity.
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/
 * No API key. GeoJSON feeds updated every minute.
 *
 * Feeds used:
 *   - significant_week: M≥4.5 globally, last 7 days (manageable size)
 *   - M2.5+:            past 24h globally (high frequency)
 *
 * Stored at:  dmrv:usgs-quakes:v1
 * Meta key:   seed-meta:dmrv:usgs-quakes
 * TTL:        600s (10min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:usgs-quakes:v1';
const CACHE_TTL     = 600;
const FETCH_TIMEOUT = 20_000;

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

const FEEDS = {
  significant_week:  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
  m25_day:           'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  m45_week:          'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson',
};

async function fetchFeed(name, url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) return { name, events: [] };
    const gj = await res.json();
    return {
      name,
      count: gj.metadata?.count ?? gj.features?.length ?? 0,
      events: (gj.features ?? []).map(f => ({
        id:        f.id,
        mag:       f.properties?.mag,
        place:     f.properties?.place,
        time:      new Date(f.properties?.time).toISOString(),
        depth_km:  f.geometry?.coordinates?.[2] ?? null,
        lat:       f.geometry?.coordinates?.[1] ?? null,
        lon:       f.geometry?.coordinates?.[0] ?? null,
        alert:     f.properties?.alert ?? null,   // green/yellow/orange/red (PAGER)
        tsunami:   f.properties?.tsunami === 1,
        felt:      f.properties?.felt ?? 0,
        url:       f.properties?.url,
      })),
    };
  } catch {
    return { name, events: [] };
  }
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:usgs-quakes',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [sig, recent, large] = await Promise.all([
      fetchFeed('significant_week', FEEDS.significant_week),
      fetchFeed('m25_day',          FEEDS.m25_day),
      fetchFeed('m45_week',         FEEDS.m45_week),
    ]);

    const latest24h = recent.events.slice(0, 50);
    const maxMag    = latest24h.reduce((m, e) => Math.max(m, e.mag ?? 0), 0);
    const tsunamiRisk = latest24h.filter(e => e.tsunami).length;

    await verifySeedKey(CANONICAL_KEY, 'recent');
    return {
      significant_week_count: sig.count,
      m25_day_count:          recent.count,
      m45_week_count:         large.count,
      max_mag_24h:            maxMag,
      tsunami_alerts_24h:     tsunamiRisk,
      significant:            sig.events,
      recent_m25:             latest24h,
      large_week:             large.events.slice(0, 50),
      fetchedAt:              new Date().toISOString(),
    };
  },
});
