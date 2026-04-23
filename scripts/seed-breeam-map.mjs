#!/usr/bin/env node
/**
 * seed-breeam-map.mjs
 * Ingest BREEAM certified building assessment data for map visualization.
 *
 * Primary source: BREEAM API (api.breeam.com/datav1/assessments)
 *   - Requires BREEAM_API_KEY environment variable.
 *   - Contact breeam@bregroup.com to request a key.
 *
 * Fallback: synthetic regional presence dataset derived from publicly stated
 * BREEAM operational regions (50+ countries, millions of registered buildings).
 *
 * Output: GeoJSON FeatureCollection stored in Redis at:
 *   - buildings:breeam-map:v1           (canonical)
 *   - buildings:breeam-map-bootstrap:v1 (bootstrap snapshot)
 */

import { loadEnvFile, CHROME_UA, runSeed, curlFetch } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'buildings:breeam-map:v1';
const BOOTSTRAP_KEY = 'buildings:breeam-map-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6h

const API_BASE = 'https://api.breeam.com';
const API_KEY = process.env.BREEAM_API_KEY;

/**
 * Minimal known BREEAM regional presence dataset.
 * Used when API key is unavailable. Coordinates are approximate centroids
 * of major BREEAM markets based on public site information.
 */
const BREEAM_REGIONS = [
  { name: 'United Kingdom', country: 'GB', lat: 54.0, lng: -2.0, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'United States', country: 'US', lat: 39.8, lng: -98.6, scheme: 'BREEAM USA', type: 'country_hub' },
  { name: 'Netherlands', country: 'NL', lat: 52.1, lng: 5.3, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Norway', country: 'NO', lat: 60.5, lng: 8.5, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Sweden', country: 'SE', lat: 60.1, lng: 18.6, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Germany', country: 'DE', lat: 51.2, lng: 10.4, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Spain', country: 'ES', lat: 40.4, lng: -3.7, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'China', country: 'CN', lat: 35.8, lng: 104.1, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Romania', country: 'RO', lat: 45.9, lng: 24.9, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Australia', country: 'AU', lat: -25.3, lng: 133.8, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'New Zealand', country: 'NZ', lat: -40.9, lng: 174.9, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Poland', country: 'PL', lat: 51.9, lng: 19.1, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Ireland', country: 'IE', lat: 53.4, lng: -8.2, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'France', country: 'FR', lat: 46.2, lng: 2.2, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Italy', country: 'IT', lat: 41.9, lng: 12.6, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Canada', country: 'CA', lat: 56.1, lng: -106.3, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Brazil', country: 'BR', lat: -14.2, lng: -51.9, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Mexico', country: 'MX', lat: 23.6, lng: -102.5, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'South Africa', country: 'ZA', lat: -30.6, lng: 22.9, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'United Arab Emirates', country: 'AE', lat: 23.4, lng: 53.8, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Singapore', country: 'SG', lat: 1.4, lng: 103.8, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Hong Kong', country: 'HK', lat: 22.3, lng: 114.2, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'India', country: 'IN', lat: 20.6, lng: 78.9, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'Japan', country: 'JP', lat: 36.2, lng: 138.3, scheme: 'BREEAM', type: 'country_hub' },
  { name: 'South Korea', country: 'KR', lat: 35.9, lng: 127.8, scheme: 'BREEAM', type: 'country_hub' },
];

async function fetchFromApi() {
  if (!API_KEY) {
    throw new Error('BREEAM_API_KEY not configured');
  }

  const url = `${API_BASE}/datav1/assessments?page=1&pageSize=100`;
  const html = curlFetch(url, null, {
    'User-Agent': CHROME_UA,
    Accept: 'application/json',
    'X-API-Key': API_KEY,
  });

  // curlFetch returns raw string; try to parse JSON
  let data;
  try {
    data = JSON.parse(html);
  } catch {
    // If HTML error page, treat as failure
    throw new Error('BREEAM API returned non-JSON');
  }

  const assessments = Array.isArray(data) ? data : data?.results ?? data?.data ?? data?.assessments ?? [];
  if (assessments.length === 0) {
    throw new Error('BREEAM API returned empty assessments array');
  }

  const features = assessments
    .filter((a) => a != null)
    .map((a) => ({
      type: 'Feature',
      properties: {
        id: a.id ?? a.assessmentId ?? null,
        name: a.name ?? a.projectName ?? a.assetName ?? 'Unknown',
        scheme: a.scheme ?? a.schemeType ?? 'BREEAM',
        rating: a.rating ?? a.score ?? null,
        country: a.country ?? a.countryCode ?? null,
        city: a.city ?? a.town ?? null,
        status: a.status ?? a.certificationStatus ?? null,
        source: 'breeam-api',
      },
      geometry: {
        type: 'Point',
        coordinates: [
          parseFloat(a.longitude ?? a.lng ?? a.lon ?? 0),
          parseFloat(a.latitude ?? a.lat ?? 0),
        ],
      },
    }))
    .filter((f) => f.geometry.coordinates[0] !== 0 && f.geometry.coordinates[1] !== 0);

  return {
    type: 'FeatureCollection',
    features,
    _meta: {
      source: 'breeam-api',
      fetchedAt: new Date().toISOString(),
      recordCount: features.length,
      apiKeyUsed: true,
    },
  };
}

function buildFallbackPayload() {
  const features = BREEAM_REGIONS.map((r) => ({
    type: 'Feature',
    properties: {
      name: r.name,
      country: r.country,
      scheme: r.scheme,
      type: r.type,
      source: 'breeam-public-regions',
    },
    geometry: {
      type: 'Point',
      coordinates: [r.lng, r.lat],
    },
  }));

  return {
    type: 'FeatureCollection',
    features,
    _meta: {
      source: 'breeam-public-regions',
      fetchedAt: new Date().toISOString(),
      recordCount: features.length,
      _fallback: true,
      message:
        'BREEAM API key not configured. This payload shows approximate regional presence ' +
        'centroids based on publicly available information. ' +
        'Set BREEAM_API_KEY to ingest real certified assessment data.',
    },
  };
}

async function fetchBreeamMapData() {
  let apiData = null;
  let apiError = null;

  if (API_KEY) {
    try {
      apiData = await fetchFromApi();
      if (apiData.features.length > 0) {
        return apiData;
      }
    } catch (err) {
      apiError = err.message;
      console.warn('  BREEAM API fetch failed:', apiError);
    }
  }

  // Fallback to synthetic regional dataset
  const payload = buildFallbackPayload();
  if (apiError) {
    payload._meta.apiError = apiError;
  }
  return payload;
}

function validate(data) {
  return (
    data &&
    data.type === 'FeatureCollection' &&
    Array.isArray(data.features)
  );
}

function declareRecords(data) {
  return data?.features?.length ?? 0;
}

await runSeed('buildings', 'breeam-map', CANONICAL_KEY, fetchBreeamMapData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'v1',
  schemaVersion: 1,
  maxStaleMin: 360,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
  zeroIsValid: true,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err?.cause?.message || err?.cause?.code || err?.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
