#!/usr/bin/env node
/**
 * seed-realorganic-farms.mjs
 * Reads pre-built Real Organic Project farms payload and seeds Redis.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'realorganic_farms_payload.json');
const CANONICAL_KEY = 'agriculture:realorganic-farms:v1';
const BOOTSTRAP_KEY = 'agriculture:realorganic-farms-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6 hours

async function fetchData() {
  const raw = await readFile(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

function validate(data) {
  return data && typeof data.totalFarms === 'number' && data.totalFarms > 0;
}

function declareRecords(data) {
  return data?.totalFarms ?? 0;
}

runSeed('agriculture', 'realorganic-farms', CANONICAL_KEY, fetchData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'realorganic-scraped-v1',
  schemaVersion: 1,
  maxStaleMin: 360,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
