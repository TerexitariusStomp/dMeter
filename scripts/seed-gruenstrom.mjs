#!/usr/bin/env node
/**
 * seed-gruenstrom.mjs
 *
 * GrünstromIndex — German renewable energy surplus forecast.
 * https://gruenstromindex.de — no key required.
 *
 * Shows when green power surplus makes electricity cheapest in Germany,
 * providing a real-time "traffic light" index for low-carbon electricity use.
 *
 * Also fetches Bundesnetzagentur SMARD API for German generation mix.
 * https://www.smard.de/en/downloadcenter/download-market-data — no key.
 *
 * Stored at:  dmrv:gruenstrom:v1
 * Meta key:   seed-meta:dmrv:gruenstrom
 * TTL:        3600s (1h) — hourly data
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:gruenstrom:v1';
const CACHE_TTL     = 3600;
const FETCH_TIMEOUT = 15_000;

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:gruenstrom',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    // GrünstromIndex current value + 24h forecast
    const gsiRes = await fetch(
      'https://api.corrently.io/v2.0/gsi/prediction?zip=10115',
      { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) }
    );
    if (!gsiRes.ok) throw new Error(`GrünstromIndex HTTP ${gsiRes.status}`);
    const gsi = await gsiRes.json();

    // SMARD — latest German renewable generation (filter 1226 = total renewables)
    // Epoch timestamps for last 4 hours
    const now   = Date.now();
    const from  = now - 4 * 3600 * 1000;
    const smardUrl = [
      'https://www.smard.de/app/chart_data/1226/DE/1226_DE_quarterhour_',
      `${Math.floor(from / 1000) * 1000}.json`,
    ].join('');

    let smardData = null;
    try {
      const smardRes = await fetch(smardUrl, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (smardRes.ok) smardData = await smardRes.json();
    } catch (_) { /* non-fatal */ }

    const forecast = Array.isArray(gsi) ? gsi : (gsi.forecast ?? gsi.prediction ?? []);
    const current  = forecast[0] ?? {};

    await verifySeedKey(CANONICAL_KEY, 'forecast');
    return {
      current: {
        time:           current.timeStamp ?? current.timestamp ?? current.dt,
        gsi:            current.gsi ?? current.value,
        co2_g_kwh:      current.co2_g_standard ?? current.co2,
        renewables_pct: current.eevalue ?? current.renewables,
        index_label:    current.gsi >= 70 ? 'green' : current.gsi >= 40 ? 'yellow' : 'red',
      },
      forecast_24h: forecast.slice(0, 24).map(f => ({
        time:  f.timeStamp ?? f.timestamp ?? f.dt,
        gsi:   f.gsi ?? f.value,
        co2:   f.co2_g_standard ?? f.co2,
      })),
      smard_renewables_mwh: smardData?.series?.slice(-1)?.[0]?.[1] ?? null,
      fetchedAt: new Date().toISOString(),
    };
  },
});
