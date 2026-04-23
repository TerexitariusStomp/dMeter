#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'tourism:green-destinations:v1';
const BOOTSTRAP_KEY = 'tourism:green-destinations-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6h — destinations change infrequently

const MARKERS_API = 'https://www.greendestinations.org/wp-json/wpgmza/v1/markers';

function toNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && val.trim() !== '') return Number(val);
  return null;
}

function compactDestination(marker) {
  return {
    id: marker.id || null,
    mapId: marker.map_id || null,
    title: marker.title?.trim() || null,
    address: marker.address?.trim() || null,
    description: marker.description?.trim() || null,
    imageUrl: marker.pic?.trim() || null,
    linkUrl: marker.link?.trim() || null,
    lat: toNumber(marker.lat),
    lng: toNumber(marker.lng),
    category: marker.category?.trim() || null,
    categories: Array.isArray(marker.categories)
      ? marker.categories.map(c => String(c).trim()).filter(Boolean)
      : [],
    approved: marker.approved === '1',
    sticky: marker.sticky === '1',
    markerType: marker.type || null,
  };
}

async function fetchGreenDestinations() {
  const res = await fetch(MARKERS_API, {
    headers: {
      Accept: 'application/json',
      'User-Agent': CHROME_UA,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Green Destinations HTTP ${res.status}`);
  const json = await res.json();

  if (!Array.isArray(json)) throw new Error('Unexpected response format — expected array');
  return json.map(compactDestination);
}

function validate(data) {
  return Array.isArray(data) && data.length > 0;
}

function declareRecords(data) {
  return Array.isArray(data) ? data.length : 0;
}

runSeed('tourism', 'green-destinations', CANONICAL_KEY, fetchGreenDestinations, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'wp-api-v1',
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 360, // 6h
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
