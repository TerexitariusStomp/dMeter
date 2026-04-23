#!/usr/bin/env node
/**
 * seed-wwoof-hosts.mjs
 * Fetches all WWOOF host listings from api.wwoof.net,
 * transforms into GeoJSON + structured summaries, and seeds Redis.
 */
import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'agriculture:wwoof-hosts:v1';
const BOOTSTRAP_KEY = 'agriculture:wwoof-hosts-bootstrap:v1';
const CACHE_TTL = 12 * 60 * 60; // 12 hours

const WWOOF_API = 'https://api.wwoof.net/api';
const USER_AGENT = CHROME_UA;

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
    ...opts,
  });
  if (!res.ok) throw new Error(`WWOOF HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchAllHosts() {
  // 1. Fetch active domains
  const domainsData = await fetchJson(`${WWOOF_API}/domains`);
  const domains = (domainsData?.domains || []).filter((d) => d.isActive);
  console.log(`  Discovered ${domains.length} active domains`);

  // 2. Fetch coordinates for all domains
  const coordMap = new Map(); // hostId -> { lat, lon, domainId }
  for (const d of domains) {
    try {
      const coords = await fetchJson(`${WWOOF_API}/host-coordinates?domainId=${d.id}`);
      for (const f of coords?.features || []) {
        const props = f.properties || {};
        const geom = f.geometry?.coordinates;
        if (geom && props.hostId) {
          coordMap.set(props.hostId, {
            hostId: props.hostId,
            domainId: props.domainId || d.id,
            lon: geom[0],
            lat: geom[1],
          });
        }
      }
    } catch (e) {
      console.log(`    WARN: coordinates failed for ${d.id}: ${e.message}`);
    }
  }
  console.log(`  Coordinates fetched: ${coordMap.size} hosts`);

  // 3. Fetch host details in batches with concurrency
  const hostIds = Array.from(coordMap.keys());
  const hosts = [];
  const concurrency = 30;

  for (let i = 0; i < hostIds.length; i += concurrency) {
    const batch = hostIds.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const data = await fetchJson(`${WWOOF_API}/hosts/${id}`);
        const host = data?.host;
        if (!host) return null;
        const coord = coordMap.get(id);
        return {
          hostId: id,
          domainId: coord.domainId,
          lat: coord.lat,
          lon: coord.lon,
          name: host.shortDescription || '',
          slug: host.slug || '',
          fullDescription: host.fullDescription || '',
          travelDetails: host.travelDetails || '',
          areaInHectares: host.areaInHectares ?? null,
          isCertifiedOrganic: host.isCertifiedOrganic ?? null,
          capacity: host.capacity ?? null,
          activities: host.activities || [],
          methodologies: host.methodologies || [],
          openingMonths: host.openingMonths || [],
          stays: host.stays || [],
          lodgings: host.lodgings || [],
          diets: host.diets || [],
          languages: host.languages || [],
          childrenOk: host.childrenOk ?? null,
          petsOk: host.petsOk ?? null,
          type: host.type || null,
          isVerified: host.isVerified ?? null,
          reviewCount: host.reviewCount ?? 0,
          updatedAt: host.updatedAt || null,
        };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) hosts.push(r.value);
    }

    if ((i + concurrency) % 300 === 0 || i + concurrency >= hostIds.length) {
      console.log(`    Progress: ${hosts.length}/${hostIds.length} details fetched`);
    }
  }

  console.log(`  Host details fetched: ${hosts.length}`);

  // 4. Build domain/country summaries and GeoJSON
  const domainCounts = {};
  const activityCounts = {};
  const methodologyCounts = {};
  const lodgingCounts = {};
  const dietCounts = {};
  const languageCounts = {};

  for (const h of hosts) {
    domainCounts[h.domainId] = (domainCounts[h.domainId] || 0) + 1;
    for (const a of h.activities) activityCounts[a] = (activityCounts[a] || 0) + 1;
    for (const m of h.methodologies) methodologyCounts[m] = (methodologyCounts[m] || 0) + 1;
    for (const l of h.lodgings) lodgingCounts[l] = (lodgingCounts[l] || 0) + 1;
    for (const d of h.diets) dietCounts[d] = (dietCounts[d] || 0) + 1;
    for (const lang of h.languages) languageCounts[lang] = (languageCounts[lang] || 0) + 1;
  }

  const features = hosts.map((h) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [h.lon, h.lat],
    },
    properties: {
      hostId: h.hostId,
      domainId: h.domainId,
      name: h.name,
      slug: h.slug,
      areaInHectares: h.areaInHectares,
      isCertifiedOrganic: h.isCertifiedOrganic,
      capacity: h.capacity,
      activities: h.activities,
      methodologies: h.methodologies,
      openingMonths: h.openingMonths,
      stays: h.stays,
      lodgings: h.lodgings,
      diets: h.diets,
      languages: h.languages,
      childrenOk: h.childrenOk,
      petsOk: h.petsOk,
      type: h.type,
      isVerified: h.isVerified,
      reviewCount: h.reviewCount,
      updatedAt: h.updatedAt,
    },
  }));

  return {
    source: 'WWOOF — World Wide Opportunities on Organic Farms',
    sourceUrl: 'https://wwoof.net',
    apiUrl: WWOOF_API,
    fetchedAt: new Date().toISOString(),
    totals: {
      hosts: hosts.length,
      domains: Object.keys(domainCounts).length,
      withCoordinates: features.length,
    },
    domainCounts: sortEntriesDesc(domainCounts),
    activityCounts: sortEntriesDesc(activityCounts),
    methodologyCounts: sortEntriesDesc(methodologyCounts),
    lodgingCounts: sortEntriesDesc(lodgingCounts),
    dietCounts: sortEntriesDesc(dietCounts),
    languageCounts: sortEntriesDesc(languageCounts),
    geojson: {
      type: 'FeatureCollection',
      features,
    },
    hosts,
  };
}

function sortEntriesDesc(mapObj) {
  return Object.fromEntries(
    Object.entries(mapObj).sort((a, b) => (b[1] || 0) - (a[1] || 0) || a[0].localeCompare(b[0]))
  );
}

function validate(data) {
  return Array.isArray(data?.hosts) && data.hosts.length > 0;
}

export function declareRecords(data) {
  return Array.isArray(data?.hosts) ? data.hosts.length : 0;
}

runSeed('agriculture', 'wwoof-hosts', CANONICAL_KEY, fetchAllHosts, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'wwoof-api-v1',
  schemaVersion: 1,
  maxStaleMin: 720,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
