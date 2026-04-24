#!/usr/bin/env node
/**
 * seed-usda-organic-operations.mjs
 *
 * Fetches USDA Organic INTEGRITY certified operations GeoJSON from the
 * local FastAPI extractor service and caches it in Redis.
 *
 * Source: https://organic.ams.usda.gov/Integrity/ (bulk Excel export)
 * FastAPI service: http://localhost:8765/geojson
 * Stored at:  dmrv:usda-organic-operations:v1
 * Meta key:   seed-meta:dmrv:usda-organic-operations
 * TTL:        86400s (24h) — USDA publishes monthly snapshots
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:usda-organic-operations:v1';
const CACHE_TTL = 86400; // 24h
const API_URL = 'http://localhost:8765/geojson?limit=10000';
const FETCH_TIMEOUT = 300_000; // 5min — geocoding on first call can be slow

async function fetchGeoJson() {
  const res = await fetch(API_URL, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`USDA Organic API HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:usda-organic-operations',
  cacheTtl: CACHE_TTL,
  async fetch() {
    const data = await fetchGeoJson();
    const features = data?.features || [];
    if (features.length < 10) {
      throw new Error(`Too few USDA organic operations: ${features.length}`);
    }

    const summary = {
      total: features.length,
      byStatus: Object.fromEntries(
        ['Certified', 'Surrendered', 'Suspended', 'Revoked'].map(s => [
          s, features.filter(f => f.properties?.status === s).length,
        ]),
      ),
      byScope: {
        crops: features.filter(f => f.properties?.scopes?.crops === 'Certified').length,
        livestock: features.filter(f => f.properties?.scopes?.livestock === 'Certified').length,
        wildCrops: features.filter(f => f.properties?.scopes?.wild_crops === 'Certified').length,
        handling: features.filter(f => f.properties?.scopes?.handling === 'Certified').length,
      },
      countries: [...new Set(features.map(f => f.properties?.country).filter(Boolean))].length,
    };

    await verifySeedKey(CANONICAL_KEY, 'features');
    return { features, summary, metadata: data.metadata, fetchedAt: new Date().toISOString() };
  },
});
