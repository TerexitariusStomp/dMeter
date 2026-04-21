#!/usr/bin/env node
/**
 * seed-aviationweather.mjs
 * Free AviationWeather.gov METAR feed (no key)
 * Useful for dMRV aviation-atmospheric ground-truth around major hubs.
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:aviationweather:v1';
const CACHE_TTL = 10 * 60; // 10m
const AIRPORTS = ['KJFK','KLAX','KORD','KATL','KDFW','EGLL','LFPG','EDDF','RJTT','OMDB','WSSS'];

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:aviationweather',
  cacheTtl: CACHE_TTL,
  async fetch() {
    const url = `https://aviationweather.gov/api/data/metar?ids=${AIRPORTS.join(',')}&format=json`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`AviationWeather HTTP ${res.status}`);
    const rows = await res.json();
    const stations = Array.isArray(rows) ? rows.map((r) => ({
      icao: r.icaoId ?? null,
      observed_at: r.reportTime ?? null,
      temp_c: r.temp ?? null,
      dewpoint_c: r.dewp ?? null,
      wind_dir_deg: r.wdir ?? null,
      wind_speed_kt: r.wspd ?? null,
      visibility_mi: r.visib ?? null,
      pressure_hpa: r.altim ?? null,
      flight_category: r.flight_category ?? null,
      lat: r.lat ?? null,
      lon: r.lon ?? null,
    })) : [];

    const payload = { source: 'aviationweather.gov', total: stations.length, stations, fetchedAt: new Date().toISOString() };
    await verifySeedKey(CANONICAL_KEY, 'fetchedAt');
    return payload;
  },
});
