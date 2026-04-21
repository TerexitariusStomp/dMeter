#!/usr/bin/env node
/**
 * seed-openfema.mjs
 *
 * OpenFEMA — US Federal Emergency Management Agency open data.
 * https://www.fema.gov/about/openfema — no key required.
 *
 * Fetches:
 *   - Recent disaster declarations (last 90 days)
 *   - Public assistance grant summaries
 *   - NFIP flood insurance claims by state (last year)
 *
 * Relevant for dMRV: ground-truth for climate-driven disaster frequency,
 * insurance risk, and infrastructure resilience.
 *
 * Stored at:  dmrv:openfema:v1
 * Meta key:   seed-meta:dmrv:openfema
 * TTL:        3600s (1h)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:openfema:v1';
const CACHE_TTL     = 3600;
const FETCH_TIMEOUT = 20_000;
const BASE         = 'https://www.fema.gov/api/open/v2';

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

function iso90DaysAgo() {
  return new Date(Date.now() - 90 * 86400 * 1000).toISOString().split('T')[0];
}

function isoOneYearAgo() {
  return new Date(Date.now() - 365 * 86400 * 1000).toISOString().split('T')[0];
}

async function femaFetch(path) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`OpenFEMA ${path} HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:openfema',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const cutoff = iso90DaysAgo();

    const [declarationsRes, nfipRes] = await Promise.allSettled([
      femaFetch(`DisasterDeclarationsSummaries?$filter=declarationDate%20ge%20'${cutoff}'&$orderby=declarationDate%20desc&$top=100`),
      femaFetch(`FimaNfipClaims?$filter=yearOfLoss%20ge%20'${isoOneYearAgo()}'&$select=state,countyCode,amountPaidOnBuildingClaim,amountPaidOnContentsClaim,numberOfFlooredFloors,dateOfLoss&$top=500`),
    ]);

    const declarations = declarationsRes.status === 'fulfilled'
      ? (declarationsRes.value?.DisasterDeclarationsSummaries ?? [])
      : [];
    const nfip = nfipRes.status === 'fulfilled'
      ? (nfipRes.value?.FimaNfipClaims ?? [])
      : [];

    if (!declarations.length && !nfip.length) {
      throw new Error('OpenFEMA returned no data');
    }

    // Summarise disaster types
    const typeCounts = {};
    for (const d of declarations) {
      const t = d.incidentType ?? 'Unknown';
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }

    // State counts
    const stateCounts = {};
    for (const d of declarations) {
      const s = d.state ?? 'XX';
      stateCounts[s] = (stateCounts[s] ?? 0) + 1;
    }

    // NFIP totals
    const totalNfipPaid = nfip.reduce(
      (s, c) => s + (parseFloat(c.amountPaidOnBuildingClaim ?? 0) || 0) + (parseFloat(c.amountPaidOnContentsClaim ?? 0) || 0),
      0
    );

    await verifySeedKey(CANONICAL_KEY, 'declarations');
    return {
      declarations: declarations.slice(0, 50).map(d => ({
        id:           d.disasterNumber,
        state:        d.state,
        type:         d.incidentType,
        title:        d.declarationTitle,
        date:         d.declarationDate,
        begin:        d.incidentBeginDate,
        end:          d.incidentEndDate,
      })),
      summary: {
        total_declarations: declarations.length,
        by_type:  typeCounts,
        by_state: Object.entries(stateCounts).sort((a,b)=>b[1]-a[1]).slice(0, 10),
        nfip_claims:     nfip.length,
        nfip_total_paid: Math.round(totalNfipPaid),
      },
      fetchedAt: new Date().toISOString(),
    };
  },
});
