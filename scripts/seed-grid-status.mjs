#!/usr/bin/env node
/**
 * seed-grid-status.mjs
 *
 * Fetches real-time US energy grid status and demand data from GridStatus.io.
 * https://www.gridstatus.io/datasets
 *
 * API: https://api.gridstatus.io/v1  (free API key required — GRIDSTATUS_API_KEY)
 * Covers 7 ISOs: CAISO, ERCOT, ISONE, MISO, NYISO, PJM, SPP
 *
 * Each ISO provides:
 * - Real-time demand (MW)
 * - Net generation by fuel type (solar, wind, gas, nuclear, hydro, etc.)
 * - Marginal fuel type
 * - Current LMP (Locational Marginal Price) at key hubs
 *
 * Without API key, falls back to EIA Gridwatch open data (no key needed).
 * https://www.eia.gov/electricity/930/
 *
 * Stored at:  dmrv:grid-status:v1
 * Meta key:   seed-meta:dmrv:grid-status
 * TTL:        300s (5min) — grid data is near-real-time
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey, sleep } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY  = 'dmrv:grid-status:v1';
const CACHE_TTL      = 300; // 5min
const FETCH_TIMEOUT  = 20_000;
const GS_API_KEY     = process.env.GRIDSTATUS_API_KEY || '';

const GS_BASE        = 'https://api.gridstatus.io/v1';
const EIA_930_URL    = 'https://api.eia.gov/v2/electricity/operating-generator-capacity/data/';

// EIA Gridwatch — open, no key, hourly US grid data
// https://www.eia.gov/electricity/930/
const EIA_GRIDWATCH_ISOS = {
  CAISO: 'CAL',
  ERCOT: 'TEX',
  ISONE: 'NE',
  MISO:  'MIDW',
  NYISO: 'NY',
  PJM:   'MIDATL',
  SPP:   'CENT',
};

// EIA Hourly Electric Grid Monitor — realtime demand by BA
const EIA_DEMAND_URL = (ba) =>
  `https://www.eia.gov/electricity/930/data.json?series=D&start=-720&ba=${ba}`;

async function fetchEiaDemand() {
  const results = [];
  const baCodes = Object.values(EIA_GRIDWATCH_ISOS);

  for (const ba of baCodes) {
    try {
      const res = await fetch(EIA_DEMAND_URL(ba), {
        headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const series = data?.[0]?.data;
      if (!Array.isArray(series) || series.length === 0) continue;

      // Most recent entry: [timestamp, demand_mwh]
      const latest = series[series.length - 1];
      const iso = Object.keys(EIA_GRIDWATCH_ISOS).find(k => EIA_GRIDWATCH_ISOS[k] === ba) || ba;

      results.push({
        iso,
        ba_code:    ba,
        demand_mwh: latest[1] != null ? Math.round(latest[1]) : null,
        timestamp:  latest[0] || null,
      });
      await sleep(100); // throttle EIA requests
    } catch {
      // continue
    }
  }
  return results;
}

async function fetchGridStatusIso(iso) {
  const url = `${GS_BASE}/latest/${iso.toLowerCase()}/load`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': CHROME_UA,
      'x-api-key': GS_API_KEY,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`GridStatus ${iso} HTTP ${res.status}`);
  return res.json();
}

async function fetchGridStatusAll() {
  const isos = Object.keys(EIA_GRIDWATCH_ISOS);
  const results = [];
  for (const iso of isos) {
    try {
      const data = await fetchGridStatusIso(iso);
      results.push({
        iso,
        demand_mw:     data?.load_mw ?? null,
        net_gen_mw:    data?.net_generation_mw ?? null,
        marginal_fuel: data?.marginal_fuel ?? null,
        timestamp:     data?.interval_start_utc ?? null,
        renewables_pct: data?.renewables_pct ?? null,
      });
    } catch {
      // skip failed iso
    }
    await sleep(200);
  }
  return results;
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:grid-status',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    let isos;

    if (GS_API_KEY) {
      isos = await fetchGridStatusAll();
    } else {
      // EIA open fallback
      const eia = await fetchEiaDemand();
      isos = eia.map(e => ({
        iso:        e.iso,
        ba_code:    e.ba_code,
        demand_mwh: e.demand_mwh,
        timestamp:  e.timestamp,
        source:     'eia-gridwatch',
      }));
    }

    if (isos.length === 0) {
      throw new Error('No grid status data from any source');
    }

    const summary = {
      isos_reported:  isos.length,
      has_api_key:    !!GS_API_KEY,
      source:         GS_API_KEY ? 'gridstatus.io' : 'eia-gridwatch',
      total_demand_mw: isos.reduce((s, i) => s + (i.demand_mw || i.demand_mwh || 0), 0),
    };

    await verifySeedKey(CANONICAL_KEY, 'isos');
    return { isos, summary, fetchedAt: new Date().toISOString() };
  },
});
