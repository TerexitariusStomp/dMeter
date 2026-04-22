#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const NASA_EPIC_API = 'https://epic.gsfc.nasa.gov/api/natural';
const CANONICAL_KEY = 'imagery:epic-natural:v1';
const CACHE_TTL = 86400; // 24h — daily imagery updates

interface EpicImage {
  identifier: string;
  image: string;
  caption: string;
  centroid_coordinates: {
    lat: number;
    lon: number;
  };
  date: string;
  spacecraft_name: string;
  mission_name: string;
}

interface EpicResponse {
  metadata: {
    date: string;
    identifier: string;
    image: string;
    caption: string;
    centroid_coordinates: {
      lat: number;
      lon: number;
    };
    spacecraft_name: string;
    mission_name: string;
  }[];
}

function mapEpicImage(image: EpicImage): {
  id: string;
  date: string;
  caption: string;
  lat: number;
  lon: number;
  imageUrl: string;
  spacecraft: string;
  mission: string;
} {
  return {
    id: image.identifier,
    date: image.date,
    caption: image.caption,
    lat: image.centroid_coordinates.lat,
    lon: image.centroid_coordinates.lon,
    imageUrl: `https://epic.gsfc.nasa.gov/archive/natural/${image.date.split(' ')[0]}/png/${image.image}.png`,
    spacecraft: image.spacecraft_name,
    mission: image.mission_name,
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
      return [];
    }
    
    const data: EpicResponse = await resp.json();
    
    if (!Array.isArray(data?.metadata)) {
      console.warn('[EPIC] Unexpected response structure');
      return [];
    }
    
    const images = data.metadata
      .filter(img => img.identifier && img.image && img.date)
      .map(mapEpicImage);
    
    console.log(`[EPIC] Fetched ${images.length} natural images`);
    return images;
  } catch (e) {
    console.warn('[EPIC] Fetch error:', e?.message || e);
    return [];
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
  sourceVersion: 'nasa-epic-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 1440, // 24 hours
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});