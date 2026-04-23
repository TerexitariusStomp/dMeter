#!/usr/bin/env node
/**
 * seed-danish-energi.mjs
 *
 * Danish Energi Data Service — open energy data from Energinet.
 * https://www.energidataservice.dk — no key required.
 *
 * Fetches:
 *   - Real-time Danish electricity grid balance (production vs consumption)
 *   - Generation mix by source (wind, solar, biomass, CHP, etc.)
 *   - CO2 emissions per kWh for DK1 (West Denmark) and DK2 (East Denmark)
 *
 * Stored at:  dmrv:danish-energi:v1
 * Meta key:   seed-meta:dmrv:danish-energi
 * TTL:        1800s (30min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:danish-energi:v1';
const CACHE_TTL     = 1800;
const FETCH_TIMEOUT = 20_000;
const BASE         = 'https://api.energidataservice.dk/dataset';

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

async function fetchDataset(dataset, limit = 2) {
  const url = `${BASE}/${dataset}?limit=${limit}&sort=Minutes5UTC%20DESC`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`Energi ${dataset} HTTP ${res.status}`);
  const json = await res.json();
  return json.records ?? json.result?.records ?? [];
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:danish-energi',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [production, co2] = await Promise.all([
      fetchDataset('ElectricityProdex5MinRealtime', 6),
      fetchDataset('CO2Emis', 4),
    ]);

    if (!production.length) throw new Error('Energi API returned no production records');

    // Summarise latest snapshot using actual API field names
    const latest = production[0] ?? {};
    const totalProduction = [
      'ProductionLt100MW', 'ProductionGe100MW',
    ].reduce((s, k) => s + (parseFloat(latest[k] ?? 0) || 0), 0);

    const windTotal  = (parseFloat(latest.OffshoreWindPower ?? 0) + parseFloat(latest.OnshoreWindPower ?? 0)) || 0;
    const solar      = parseFloat(latest.SolarPower ?? 0) || 0;
    const renewPct   = totalProduction > 0
      ? Math.round(((windTotal + solar) / totalProduction) * 1000) / 10
      : null;

    const co2Latest  = co2[0] ?? {};

    await verifySeedKey(CANONICAL_KEY, 'production');
    return {
      latest_interval:    latest.Minutes5UTC ?? latest.HourUTC,
      total_production_mw: Math.round(totalProduction),
      wind_mw:            Math.round(windTotal),
      solar_mw:           Math.round(solar),
      renewable_pct:      renewPct,
      co2_dk1_g_kwh:      parseFloat(co2Latest.CO2Emis ?? co2Latest.CO2EmisKg ?? null),
      co2_area:           co2Latest.PriceArea ?? null,
      raw_production:     production.slice(0, 3),
      raw_co2:            co2.slice(0, 2),
      fetchedAt:          new Date().toISOString(),
    };
  },
});
