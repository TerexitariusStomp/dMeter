#!/usr/bin/env node
/**
 * seed-purpleair.mjs
 * PurpleAir sensor sample (API key optional; when absent records key_missing state)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:purpleair:v1';
const CACHE_TTL = 30 * 60; // 30m

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:purpleair',
  cacheTtl: CACHE_TTL,
  async fetch() {
    const apiKey = String(process.env.PURPLEAIR_API_KEY || '').trim();
    if (!apiKey) {
      const payload = { source: 'purpleair.com', status: 'key_missing', sensors: [], fetchedAt: new Date().toISOString() };
      await verifySeedKey(CANONICAL_KEY, 'fetchedAt');
      return payload;
    }

    const url = 'https://api.purpleair.com/v1/sensors?fields=name,latitude,longitude,pm2.5_atm,humidity,temperature,last_seen';
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'X-API-Key': apiKey, 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`PurpleAir HTTP ${res.status}`);
    const data = await res.json();
    const sensors = Array.isArray(data?.data) ? data.data.slice(0, 1000) : [];
    const payload = { source: 'purpleair.com', status: 'ok', fields: data?.fields ?? [], total: sensors.length, sensors, fetchedAt: new Date().toISOString() };
    await verifySeedKey(CANONICAL_KEY, 'fetchedAt');
    return payload;
  },
});
