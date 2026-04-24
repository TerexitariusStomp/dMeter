#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'environment:change-climate-brands:v1';
const BOOTSTRAP_KEY = 'environment:change-climate-brands-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6h — brand registry changes infrequently

const RSC_URL = 'https://explore.changeclimate.org/?_rsc=1f3k9';

async function fetchChangeClimateBrands() {
  const res = await fetch(RSC_URL, {
    headers: {
      Accept: 'text/x-component',
      'RSC': '1',
      'User-Agent': CHROME_UA,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Change Climate HTTP ${res.status}`);
  const text = await res.text();

  // Extract the brand array from the RSC payload.
  // The array starts with [{"id":"..." and ends with the matching closing bracket.
  const startMarker = '[{"id":"';
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error('Brand array start marker not found in RSC payload');

  let pos = start;
  let depth = 0;
  let inString = false;
  let escape = false;

  while (pos < text.length) {
    const ch = text[pos];
    if (escape) {
      escape = false;
    } else if (ch === '\\') {
      escape = true;
    } else if (ch === '"' && !escape) {
      inString = !inString;
    } else if (!inString) {
      if (ch === '[' || ch === '{') depth += 1;
      else if (ch === ']' || ch === '}') {
        depth -= 1;
        if (depth === 0 && ch === ']') break;
      }
    }
    pos += 1;
  }

  const arrayStr = text.slice(start, pos + 1);
  const brands = JSON.parse(arrayStr);

  if (!Array.isArray(brands)) throw new Error('Unexpected response format — expected array');

  // Compute aggregations
  const industries = {};
  let totalEmissionsMarket = 0;
  let totalEmissionsLocation = 0;
  let totalFunding = 0;
  let featuredCount = 0;
  let bcorpCount = 0;
  let onePercentCount = 0;

  for (const b of brands) {
    const ind = b.industry || 'Unknown';
    industries[ind] = (industries[ind] || 0) + 1;
    totalEmissionsMarket += b.assuredFootprintTotalMarket || 0;
    totalEmissionsLocation += b.assuredFootprintTotalLocation || 0;
    totalFunding += b.totalFunding || 0;
    if (b.isFeatured) featuredCount += 1;
    if (b.isBCorpCertified) bcorpCount += 1;
    if (b.isOnePercentForThePlanetMember) onePercentCount += 1;
  }

  return {
    meta: {
      source: 'Change Climate / The Climate Label',
      sourceUrl: 'https://explore.changeclimate.org/',
      fetchedAt: new Date().toISOString(),
      totalBrands: brands.length,
      description: 'Climate Label certified brands with emissions data and reduction plans',
    },
    summary: {
      totalBrands: brands.length,
      featuredBrands: featuredCount,
      bcorpCertified: bcorpCount,
      onePercentMember: onePercentCount,
      totalEmissionsMarket,
      totalEmissionsLocation,
      totalFunding,
      industries,
    },
    brands,
  };
}

function validate(data) {
  return data && Array.isArray(data.brands) && data.brands.length > 0;
}

function declareRecords(data) {
  return data && Array.isArray(data.brands) ? data.brands.length : 0;
}

runSeed('environment', 'change-climate-brands', CANONICAL_KEY, fetchChangeClimateBrands, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'rsc-v1',
  schemaVersion: 1,
  maxStaleMin: 360,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
