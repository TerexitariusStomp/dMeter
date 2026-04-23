#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const NASA_EPIC_API = 'https://epic.gsfc.nasa.gov/api/natural';
const CANONICAL_KEY = 'imagery:epic-natural:v1';
const CACHE_TTL = 86400; // 24h — daily imagery updates

function mapEpicImage(image) {
  const datePart = image.date ? image.date.split(' ')[0] : '';
  const [year, month, day] = datePart.split('-');
  const archiveDate = year && month && day ? `${year}/${month}/${day}` : datePart;

  return {
    id: image.identifier,
    date: image.date,
    caption: image.caption,
    lat: image.centroid_coordinates?.lat ?? 0,
    lon: image.centroid_coordinates?.lon ?? 0,
    imageUrl: `https://epic.gsfc.nasa.gov/archive/natural/${archiveDate}/png/${image.image}.png`,
    spacecraft: 'DSCOVR',
    mission: 'EPIC',
  };
}

async function fetchEpicImagery() {
  try {
    const resp = await fetch(NASA_EPIC_API, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      console.warn(`[EPIC] NASA EPIC API HTTP ${resp.status}`);
      return { images: [] };
    }

    const data = await resp.json();

    if (!Array.isArray(data)) {
      console.warn('[EPIC] Unexpected response structure');
      return { images: [] };
    }

    const images = data
      .filter(img => img.identifier && img.image && img.date)
      .map(mapEpicImage);

    console.log(`[EPIC] Fetched ${images.length} natural images`);
    return { images };
  } catch (e) {
    console.warn('[EPIC] Fetch error:', e?.message || e);
    return { images: [] };
  }
}

function validate(data) {
  return Array.isArray(data?.images) && data.images.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.images) ? data.images.length : 0;
}

runSeed('imagery', 'epic-natural', CANONICAL_KEY, fetchEpicImagery, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'nasa-epic-v2',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 1440, // 24 hours
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});
