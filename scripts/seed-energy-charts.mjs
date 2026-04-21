#!/usr/bin/env node
/**
 * seed-energy-charts.mjs
 *
 * Energy-Charts API — EU / Germany multi-country live power generation mix.
 * https://api.energy-charts.info/
 * No API key required. Data from ENTSO-E + national TSOs.
 * Covers: DE, FR, GB, ES, IT, AT, CH, NL, BE, PL, DK, SE, NO, FI.
 *
 * Ideal for dMRV: real-time renewable vs fossil fuel mix for carbon calculations.
 *
 * Stored at:  dmrv:energy-charts:v1
 * Meta key:   seed-meta:dmrv:energy-charts
 * TTL:        900s (15min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:energy-charts:v1';
const CACHE_TTL     = 900;
const FETCH_TIMEOUT = 20_000;
const BASE          = 'https://api.energy-charts.info';

const COUNTRIES = ['de', 'fr', 'gb', 'es', 'it', 'at', 'ch', 'nl', 'be', 'dk', 'se', 'no', 'fi', 'pl'];

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

const RENEWABLES = new Set([
  'Hydro Run-of-River', 'Run of River', 'Hydro Water Reservoir',
  'Wind Offshore', 'Wind Onshore', 'Photovoltaics', 'Solar',
  'Biomass', 'Geothermal', 'Hydro Pumped Storage',
  'Waste', 'Biogas', 'Other Renewables',
]);

async function fetchCountry(country) {
  const url = `${BASE}/total_power?country=${country}`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) return null;
    const data = await res.json();

    // Find the most recent time index
    const times = data.unix_seconds ?? [];
    if (!times.length) return null;
    const lastIdx = times.length - 1;
    const timestamp = new Date(times[lastIdx] * 1000).toISOString();

    let total = 0, renewable = 0, fossil = 0, nuclear = 0;
    const mix = {};
    for (const pt of data.production_types ?? []) {
      const name = pt.name;
      const val = pt.data?.[lastIdx];
      if (val == null || isNaN(val)) continue;
      mix[name] = val;
      total += val;
      if (RENEWABLES.has(name)) renewable += val;
      else if (name.includes('Nuclear')) nuclear += val;
      else if (!name.startsWith('Total')) fossil += val;
    }

    return {
      country,
      timestamp,
      total_mw:     Math.round(total),
      renewable_mw: Math.round(renewable),
      fossil_mw:    Math.round(fossil),
      nuclear_mw:   Math.round(nuclear),
      renewable_pct: total > 0 ? Math.round((renewable / total) * 100) : null,
      mix,
    };
  } catch {
    return null;
  }
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:energy-charts',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const results = await Promise.all(COUNTRIES.map(c => fetchCountry(c)));
    const countries = results.filter(Boolean);
    if (!countries.length) throw new Error('energy-charts: no data for any country');

    const avgRenewable = countries.reduce((s, c) => s + (c.renewable_pct ?? 0), 0) / countries.length;

    await verifySeedKey(CANONICAL_KEY, 'countries');
    return {
      countries_fetched: countries.length,
      avg_renewable_pct: Math.round(avgRenewable),
      countries,
      fetchedAt: new Date().toISOString(),
    };
  },
});
