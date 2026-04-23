#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'environment:bcorp-map-data:v1';
const BOOTSTRAP_KEY = 'environment:bcorp-map-data-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6h

const TYPESENSE_URL = 'https://94eo8lmsqa0nd3j5p.a1.typesense.net/multi_search';
const TYPESENSE_API_KEY = 'eoWf8NTNsTFdaxcxNSuyaKAjLeV4T3F0';
const COLLECTION = 'companies-production-en-us';
const QUERY_BY = 'name,description,websiteKeywords,countries,industry,sector,hqCountry,hqProvince,hqCity,hqPostalCode,provinces,cities,size,demographicsList';
const PER_PAGE = 250;

function normalizeCountry(value) {
  return String(value || '').trim();
}

function compactCompany(doc) {
  const hqCountry = doc?.hqCountry || null;
  const hqProvince = doc?.hqProvince || null;
  const hqCity = doc?.hqCity || null;

  return {
    id: doc?.id || null,
    slug: doc?.slug || null,
    name: doc?.name || null,
    description: doc?.description || null,
    profileUrl: doc?.slug ? `https://www.bcorporation.net/en-us/find-a-b-corp/company/${doc.slug}/` : null,
    companyLogo: doc?.companyLogo || null,
    industry: doc?.industry || null,
    sector: doc?.sector || null,
    size: doc?.size || null,
    latestVerifiedScore: Number.isFinite(doc?.latestVerifiedScore) ? doc.latestVerifiedScore : null,
    isCertified: typeof doc?.isCertified === 'boolean' ? doc.isCertified : null,
    initialCertificationDateTimestamp: Number.isFinite(doc?.initialCertificationDateTimestamp)
      ? doc.initialCertificationDateTimestamp
      : null,
    hqCountry,
    hqProvince,
    hqCity,
    hqPostalCode: doc?.hqPostalCode || null,
    countries: Array.isArray(doc?.countries) ? doc.countries : [],
    provinces: Array.isArray(doc?.provinces) ? doc.provinces : [],
    cities: Array.isArray(doc?.cities) ? doc.cities : [],
    demographicsList: Array.isArray(doc?.demographicsList) ? doc.demographicsList : [],
    locationLabel: [hqCity, hqProvince, hqCountry].filter(Boolean).join(', ') || null,
  };
}

function sortEntriesDesc(mapObj) {
  return Object.fromEntries(
    Object.entries(mapObj).sort((a, b) => (b[1] || 0) - (a[1] || 0) || a[0].localeCompare(b[0]))
  );
}

async function fetchCompaniesPage(page) {
  const body = {
    searches: [
      {
        collection: COLLECTION,
        q: '*',
        query_by: QUERY_BY,
        exhaustive_search: true,
        page,
        per_page: PER_PAGE,
      },
    ],
  };

  const res = await fetch(`${TYPESENSE_URL}?x-typesense-api-key=${encodeURIComponent(TYPESENSE_API_KEY)}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': CHROME_UA,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Typesense HTTP ${res.status} on page ${page}`);

  const json = await res.json();
  const result = Array.isArray(json?.results) ? json.results[0] : null;
  if (!result) throw new Error(`Typesense invalid result shape on page ${page}`);
  if (result?.error) throw new Error(`Typesense error on page ${page}: ${result.error}`);
  if (result?.code && result?.code >= 400) throw new Error(`Typesense code ${result.code} on page ${page}: ${result.error || 'unknown'}`);

  const found = Number(result?.found || 0);
  const hits = Array.isArray(result?.hits) ? result.hits : [];
  const docs = hits.map((h) => h?.document).filter(Boolean);

  return { found, docs };
}

async function fetchBcorpMapData() {
  const first = await fetchCompaniesPage(1);
  const found = first.found;
  const pageCount = Math.max(1, Math.ceil(found / PER_PAGE));

  const docs = [...first.docs];

  const concurrency = 4;
  let page = 2;
  async function worker() {
    while (page <= pageCount) {
      const current = page;
      page += 1;
      const next = await fetchCompaniesPage(current);
      docs.push(...next.docs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(0, pageCount - 1)) }, () => worker()));

  const companies = docs.map(compactCompany);

  const countryCounts = {};
  const industryCounts = {};
  for (const c of companies) {
    const country = normalizeCountry(c.hqCountry) || 'Unknown';
    countryCounts[country] = (countryCounts[country] || 0) + 1;

    const industry = String(c.industry || 'Unknown').trim() || 'Unknown';
    industryCounts[industry] = (industryCounts[industry] || 0) + 1;
  }

  return {
    source: 'B Corporation directory (Typesense public search index)',
    sourceUrl: 'https://www.bcorporation.net/en-us/find-a-b-corp/',
    fetchedAt: new Date().toISOString(),
    totals: {
      companies: companies.length,
      found,
      pagesFetched: pageCount,
      perPage: PER_PAGE,
      countries: Object.keys(countryCounts).length,
      industries: Object.keys(industryCounts).length,
    },
    countryCounts: sortEntriesDesc(countryCounts),
    industryCounts: sortEntriesDesc(industryCounts),
    companies,
    notes: {
      coordinatesAvailable: false,
      reason: 'Public B Corp Typesense index does not expose latitude/longitude fields in returned documents.',
      mapUsageHint: 'Use hqCity/hqProvince/hqCountry/locationLabel for downstream geocoding if point coordinates are required.',
    },
  };
}

function validate(data) {
  return Array.isArray(data?.companies) && data.companies.length > 0;
}

export function declareRecords(data) {
  return Array.isArray(data?.companies) ? data.companies.length : 0;
}

runSeed('environment', 'bcorp-map-data', CANONICAL_KEY, fetchBcorpMapData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'bcorp-typesense-v1',
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 360,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
