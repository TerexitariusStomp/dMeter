#!/usr/bin/env node
/**
 * seed-rainviewer.mjs
 * RainViewer public radar map timeline (no key)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:rainviewer:v1';
const CACHE_TTL = 10 * 60; // 10m

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:rainviewer',
  cacheTtl: CACHE_TTL,
  async fetch() {
    const url = 'https://api.rainviewer.com/public/weather-maps.json';
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`RainViewer HTTP ${res.status}`);
    const data = await res.json();
    const radarPast = Array.isArray(data?.radar?.past) ? data.radar.past : [];
    const radarNowcast = Array.isArray(data?.radar?.nowcast) ? data.radar.nowcast : [];
    const payload = {
      source: 'rainviewer.com',
      host: data?.host ?? null,
      generated: data?.generated ?? null,
      radar: {
        past_count: radarPast.length,
        nowcast_count: radarNowcast.length,
        latest_past: radarPast.at(-1) ?? null,
        latest_nowcast: radarNowcast.at(-1) ?? null,
      },
      satellite: data?.satellite ?? null,
      fetchedAt: new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY, 'fetchedAt');
    return payload;
  },
});
