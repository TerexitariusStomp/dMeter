#!/usr/bin/env node
/**
 * seed-energystar-buildings.mjs
 * Reads pre-built ENERGY STAR certified buildings payload (CSV + Census geocoded)
 * and seeds Redis with GeoJSON + structured summaries.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'energystar_buildings_payload.json');
const CANONICAL_KEY = 'buildings:energystar-certified:v1';
const BOOTSTRAP_KEY = 'buildings:energystar-certified-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6 hours

async function fetchData() {
  const raw = await readFile(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

function validate(data) {
  return data && typeof data.totalBuildings === 'number' && data.totalBuildings > 0;
}

function declareRecords(data) {
  return data?.totalBuildings ?? 0;
}

runSeed('buildings', 'energystar-certified', CANONICAL_KEY, fetchData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'energystar-census-geocoded-v1',
  schemaVersion: 1,
  maxStaleMin: 360,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
