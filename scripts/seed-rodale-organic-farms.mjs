#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'agriculture:rodale-organic-farms:v1';
const BOOTSTRAP_KEY = 'agriculture:rodale-organic-farms-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6h — farms change infrequently

const URL = 'https://services6.arcgis.com/m4tZqgNyzTdjY9jG/arcgis/rest/services/All_Organic/FeatureServer/0/query';

function compactFarm(feature) {
  const attrs = feature.attributes;
  return {
    id: attrs.ObjectId,
    name: attrs.Operation1?.trim() || null,
    address: attrs.Address?.trim() || null,
    city: attrs.Physical_2?.trim() || null,
    state: attrs.Physical_3?.trim() || null,
    country: attrs.Physical_4?.trim() || null,
    zip: attrs.Physical_5?.trim() || null,
    lat: attrs.Lat,
    lng: attrs.Long,
    phone: attrs.Phone?.trim() || null,
    email: attrs.Email?.trim() || null,
    website: attrs.Website_UR?.trim() || null,
    certifier: attrs.Certifier_?.trim() || null,
    certification_status: attrs.Operatio_1?.trim() || null,
    date_certified: attrs.Effective_ !== null ? new Date(attrs.Effective_).toISOString() : attrs.Effectiv_1 || null,
    certification_types: attrs.Certification_Types?.trim() || null,
    scopes: {
      crops: attrs.CROPS_Scop?.trim() || null,
      handling: attrs.HANDLING_S?.trim() || null,
      livestock: attrs.LIVESTOCK_?.trim() || null,
      wild_crops: attrs.WILD_CROPS?.trim() || null
    }
  };
}

async function fetchRodaleFarms() {
  let offset = 0;
  const batchSize = 2000;
  let allFeatures = [];
  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      returnGeometry: 'false',
      f: 'json',
      resultRecordCount: batchSize,
      resultOffset: offset
    });
    const res = await fetch(URL + '?' + params.toString(), {
      headers: { 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(30_000)
    });

    if (!res.ok) throw new Error(`Rodale Farms HTTP ${res.status}`);
    const json = await res.json();
    const features = json.features || [];
    if (features.length === 0) break;
    allFeatures = allFeatures.concat(features);
    if (features.length < batchSize) break;
    offset += batchSize;
  }
  return allFeatures.map(compactFarm);
}

function validate(data) {
  return Array.isArray(data) && data.length > 0;
}

function declareRecords(data) {
  return Array.isArray(data) ? data.length : 0;
}

runSeed('agriculture', 'rodale-organic-farms', CANONICAL_KEY, fetchRodaleFarms, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'arcgis-v1',
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 360, // 6h
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});