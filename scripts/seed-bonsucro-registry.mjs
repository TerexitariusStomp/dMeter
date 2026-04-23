#!/usr/bin/env node
/**
 * seed-bonsucro-registry.mjs
 * Fetches Bonsucro certified business registry from Standards Map API,
 * transforms into GeoJSON + structured summaries, and seeds Redis.
 */
import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'environment:bonsucro-registry:v1';
const BOOTSTRAP_KEY = 'environment:bonsucro-registry-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6 hours

const API_URL = 'https://cbr-api.standardsmap.org/dataset/getDS/Bonsucro';

function toGeoJSONFeature(company) {
  const lat = company['Location Lat&Long (Latitude)'] ?? company.latitude ?? null;
  const lon = company['Location Lat&Long (Longitude)'] ?? company.longitude ?? null;
  if (lat == null || lon == null) return null;
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return null;

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [nLon, nLat],
    },
    properties: {
      name: company['Business entity name'] || null,
      relatedAccount: company['Related Account'] || null,
      membershipNumber: company['Membership number'] || null,
      certificationStatus: company['Certification Status'] || null,
      dateFirstCertified: company['Date first certified'] || null,
      certificateValidFrom: company['Current certificate valid from'] || null,
      certificateValidUntil: company['Current certificate valid until'] || null,
      certificateNumber: company['Certificate Number'] || null,
      certifyingBody: company['Certification Body name'] || null,
      website: company['Website'] || null,
      country: company['Address Country'] || null,
      city: company['Address City'] || null,
      address: company['Address line 1'] || null,
      region: company['Address Region'] || null,
      activities: compactActivities(company),
      products: compactProducts(company),
      standards: compactStandards(company),
    },
  };
}

function compactActivities(c) {
  const acts = [];
  const map = {
    Farming: 'Farming',
    Milling: 'Milling',
    Refining: 'Refining',
    Distilling: 'Distilling',
    'Packing / repacking': 'Packing',
    'Processing (other)': 'Processing',
  };
  for (const [k, v] of Object.entries(map)) {
    if (c[k] === 'Yes') acts.push(v);
  }
  if (c['If other activity please indicate:']) {
    acts.push(c['If other activity please indicate:']);
  }
  return acts;
}

function compactProducts(c) {
  const prods = [];
  const map = {
    Sugarcane: 'Sugarcane',
    'Raw Sugar': 'Raw Sugar',
    'Refined Sugar': 'Refined Sugar',
    Molasses: 'Molasses',
    Bagasse: 'Bagasse',
    Ethanol: 'Ethanol',
    'Electric energy': 'Electric energy',
  };
  for (const [k, v] of Object.entries(map)) {
    if (c[k] === 'Yes') prods.push(v);
  }
  if (c['If other product please indicate:']) {
    prods.push(c['If other product please indicate:']);
  }
  return prods;
}

function compactStandards(c) {
  const stds = [];
  if (c['Bonsucro'] === 'Yes') stds.push('Bonsucro');
  if (c['Bonsucro EU RED'] === 'Yes') stds.push('Bonsucro EU RED');
  if (c['CHoC Standard'] === 'Yes') stds.push('CHoC Standard');
  if (c['Production Standard'] === 'Yes') stds.push('Production Standard');
  return stds;
}

function sortEntriesDesc(mapObj) {
  return Object.fromEntries(
    Object.entries(mapObj).sort((a, b) => (b[1] || 0) - (a[1] || 0) || a[0].localeCompare(b[0]))
  );
}

async function fetchBonsucroData() {
  const res = await fetch(API_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': CHROME_UA,
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`StandardsMap HTTP ${res.status}`);

  const json = await res.json();
  const companies = Array.isArray(json?.companies) ? json.companies : [];

  const features = [];
  const countryCounts = {};
  const statusCounts = {};
  const certBodyCounts = {};
  const activityCounts = {};
  const productCounts = {};
  const standardCounts = {};
  let withCoords = 0;
  let withoutCoords = 0;

  for (const c of companies) {
    const f = toGeoJSONFeature(c);
    if (f) {
      features.push(f);
      withCoords += 1;
    } else {
      withoutCoords += 1;
    }

    const country = String(c['Address Country'] || 'Unknown').trim() || 'Unknown';
    countryCounts[country] = (countryCounts[country] || 0) + 1;

    const status = String(c['Certification Status'] || 'Unknown').trim() || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const body = String(c['Certification Body name'] || 'Unknown').trim() || 'Unknown';
    certBodyCounts[body] = (certBodyCounts[body] || 0) + 1;

    for (const act of compactActivities(c)) {
      activityCounts[act] = (activityCounts[act] || 0) + 1;
    }
    for (const prod of compactProducts(c)) {
      productCounts[prod] = (productCounts[prod] || 0) + 1;
    }
    for (const std of compactStandards(c)) {
      standardCounts[std] = (standardCounts[std] || 0) + 1;
    }
  }

  const geojson = {
    type: 'FeatureCollection',
    features,
  };

  return {
    source: 'Standards Map — Bonsucro Certified Business Registry',
    sourceUrl: 'https://www.standardsmap.org/en/registry?cbrid=Bonsucro',
    apiUrl: API_URL,
    fetchedAt: new Date().toISOString(),
    totals: {
      companies: companies.length,
      withCoordinates: withCoords,
      withoutCoordinates: withoutCoords,
      countries: Object.keys(countryCounts).length,
      certifyingBodies: Object.keys(certBodyCounts).length,
    },
    countryCounts: sortEntriesDesc(countryCounts),
    statusCounts: sortEntriesDesc(statusCounts),
    certifyingBodyCounts: sortEntriesDesc(certBodyCounts),
    activityCounts: sortEntriesDesc(activityCounts),
    productCounts: sortEntriesDesc(productCounts),
    standardCounts: sortEntriesDesc(standardCounts),
    geojson,
    companies: companies.map((c) => ({
      name: c['Business entity name'] || null,
      relatedAccount: c['Related Account'] || null,
      membershipNumber: c['Membership number'] || null,
      certificationStatus: c['Certification Status'] || null,
      dateFirstCertified: c['Date first certified'] || null,
      certificateValidFrom: c['Current certificate valid from'] || null,
      certificateValidUntil: c['Current certificate valid until'] || null,
      suspensionStartDate: c['Suspension start date'] || null,
      suspensionExpiryDate: c['Suspension expiry date'] || null,
      certificationWithdrawnDate: c['Certification withdrawn date'] || null,
      certificateNumber: c['Certificate Number'] || null,
      certifyingBody: c['Certification Body name'] || null,
      certifyingBodyMembershipNumber: c['Certification Body membership number'] || null,
      website: c['Website'] || null,
      addressLine1: c['Address line 1'] || null,
      city: c['Address City'] || null,
      region: c['Address Region'] || null,
      country: c['Address Country'] || null,
      latitude: c['Location Lat&Long (Latitude)'] ?? c.latitude ?? null,
      longitude: c['Location Lat&Long (Longitude)'] ?? c.longitude ?? null,
      activities: compactActivities(c),
      products: compactProducts(c),
      standards: compactStandards(c),
    })),
  };
}

function validate(data) {
  return Array.isArray(data?.companies) && data.companies.length > 0;
}

export function declareRecords(data) {
  return Array.isArray(data?.companies) ? data.companies.length : 0;
}

runSeed('environment', 'bonsucro-registry', CANONICAL_KEY, fetchBonsucroData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'standardsmap-bonsucro-v1',
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 360,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
