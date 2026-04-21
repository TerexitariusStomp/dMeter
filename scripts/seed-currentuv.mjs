#!/usr/bin/env node
/**
 * seed-currentuv.mjs
 * Free UV Index API (currentuvindex.com) - no key.
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:currentuv:v1';
const CACHE_TTL = 60 * 60; // 1h
const POINTS = [
  { id: 'nyc', lat: 40.7128, lon: -74.0060 },
  { id: 'london', lat: 51.5074, lon: -0.1278 },
  { id: 'dubai', lat: 25.2048, lon: 55.2708 },
  { id: 'singapore', lat: 1.3521, lon: 103.8198 },
  { id: 'sydney', lat: -33.8688, lon: 151.2093 },
];

async function fetchPoint(pt) {
  const url = `https://currentuvindex.com/api/v1/uvi?latitude=${pt.lat}&longitude=${pt.lon}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`CurrentUV ${pt.id} HTTP ${res.status}`);
  const d = await res.json();
  return {
    id: pt.id,
    latitude: d?.latitude ?? pt.lat,
    longitude: d?.longitude ?? pt.lon,
    now: d?.now ?? null,
    forecast: Array.isArray(d?.forecast) ? d.forecast.slice(0, 12) : [],
  };
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:currentuv',
  cacheTtl: CACHE_TTL,
  async fetch() {
    const out = [];
    for (const p of POINTS) {
      try { out.push(await fetchPoint(p)); } catch {}
    }
    const payload = { source: 'currentuvindex.com', points: out, total: out.length, fetchedAt: new Date().toISOString() };
    await verifySeedKey(CANONICAL_KEY, 'fetchedAt');
    return payload;
  },
});
