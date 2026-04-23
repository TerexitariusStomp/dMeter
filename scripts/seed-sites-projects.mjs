#!/usr/bin/env node
/**
 * seed-sites-projects.mjs
 * Loads SITES certified projects data (scraped + geocoded from sustainablesites.org)
 * and seeds Redis with a GeoJSON FeatureCollection + structured summaries.
 */
import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'environment:sites-projects:v1';
const BOOTSTRAP_KEY = 'environment:sites-projects-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6 hours

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '..', 'data', 'sites-projects-payload.json');

async function fetchData() {
  // Prefer local JSON payload; fallback to localhost FastAPI if available
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (fsErr) {
    // Fallback: call local FastAPI service
    const res = await fetch('http://localhost:8000/dmrv/sites-projects', {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`SITES API HTTP ${res.status}`);
    return await res.json();
  }
}

function validate(data) {
  return Array.isArray(data?.projects) && data.projects.length > 0;
}

function declareRecords(data) {
  return Array.isArray(data?.projects) ? data.projects.length : 0;
}

runSeed('environment', 'sites-projects', CANONICAL_KEY, fetchData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'sustainablesites-scrape-v1',
  schemaVersion: 1,
  maxStaleMin: 360,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
