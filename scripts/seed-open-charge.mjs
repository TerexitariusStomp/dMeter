#!/usr/bin/env node
/**
 * seed-open-charge.mjs
 *
 * EV charging infrastructure data — combined from two free no-auth sources:
 *
 * 1. AFDC (Alternative Fuels Station Locator) — US DOE/NREL
 *    https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/
 *    DEMO_KEY allows 30 req/hr free (no registration needed for DEMO_KEY)
 *
 * 2. EU Alternative Fuels Observatory (EAFO) open data
 *    https://alternative-fuels-observatory.ec.europa.eu/general-information/open-data
 *    Open CSV/JSON, no key required.
 *
 * Stored at:  dmrv:open-charge:v1
 * Meta key:   seed-meta:dmrv:open-charge
 * TTL:        7200s (2h)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:open-charge:v1';
const CACHE_TTL     = 7200;
const FETCH_TIMEOUT = 25_000;

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

// AFDC DEMO_KEY — 30 requests/hr, no registration needed
const AFDC_BASE = 'https://developer.nrel.gov/api/alt-fuel-stations/v1.json';

// EAFO open aggregated EV stats by country (no auth)
const EAFO_URL = 'https://www.eafo.eu/api/open/vehicle-stats/latest?vehicle_category=M1&fuel_type=BEV';

async function fetchAFDC() {
  const params = new URLSearchParams({
    api_key: 'DEMO_KEY',
    fuel_type: 'ELEC',
    limit: '200',
  });
  const url = `${AFDC_BASE}?${params.toString()}`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`AFDC HTTP ${res.status}`);
  const data = await res.json();
  const stations = data.fuel_stations ?? data.alt_fuel_stations ?? [];
  return {
    total_results: data.total_results ?? stations.length,
    stations: stations.map(s => ({
      id:        s.id,
      name:      s.station_name,
      city:      s.city,
      state:     s.state,
      lat:       s.latitude,
      lon:       s.longitude,
      ev_level2: s.ev_level2_evse_num ?? 0,
      ev_dc_fast: s.ev_dc_fast_num ?? 0,
      network:   s.ev_network,
      access:    s.access_code,
    })),
  };
}

// Fallback: scrape EV Infrastructure stats from public EU open data portal
async function fetchEUStats() {
  // EU open data: EV charging points per country
  const url = 'https://ec.europa.eu/transport/infrastructure/tentec/tentec-documentation/site/en/maps/data/ev_charging_stations.json';
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:open-charge',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [afdc, euStats] = await Promise.allSettled([fetchAFDC(), fetchEUStats()]);

    const afdcData = afdc.status === 'fulfilled' ? afdc.value : null;
    const stations = afdcData?.stations ?? [];
    const afdcTotal = afdcData?.total_results ?? stations.length;
    const eu       = euStats.status === 'fulfilled' ? euStats.value : null;

    if (afdcTotal <= 0) throw new Error('AFDC returned zero stations');

    const byState = {};
    let totalL2 = 0, totalDC = 0;
    for (const s of stations) {
      byState[s.state] = (byState[s.state] ?? 0) + 1;
      totalL2 += s.ev_level2;
      totalDC += s.ev_dc_fast;
    }

    const byNetwork = {};
    for (const s of stations) {
      if (s.network) byNetwork[s.network] = (byNetwork[s.network] ?? 0) + 1;
    }

    await verifySeedKey(CANONICAL_KEY, 'stations');
    return {
      us_stations_sampled: stations.length,
      us_stations_total:   afdcTotal,
      us_total_l2:    totalL2,
      us_total_dcfc:  totalDC,
      us_by_state:    Object.entries(byState).sort((a,b)=>b[1]-a[1]).slice(0,15),
      us_by_network:  Object.entries(byNetwork).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>({network:k,count:v})),
      sample:         stations.slice(0, 50),
      eu_data:        eu,
      fetchedAt:      new Date().toISOString(),
    };
  },
});
