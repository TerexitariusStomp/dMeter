#!/usr/bin/env node
/**
 * seed-luchtmeetnet.mjs
 *
 * Luchtmeetnet — Netherlands RIVM air quality network.
 * https://api-docs.luchtmeetnet.nl — no key required.
 *
 * Official Dutch government (RIVM) air quality monitoring stations.
 * Provides validated, calibrated measurements: NO2, PM10, PM2.5, O3.
 * Useful as a high-quality reference dataset for dMRV air quality validation.
 *
 * Stored at:  dmrv:luchtmeetnet:v1
 * Meta key:   seed-meta:dmrv:luchtmeetnet
 * TTL:        1800s (30min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:luchtmeetnet:v1';
const CACHE_TTL     = 1800;
const FETCH_TIMEOUT = 20_000;
const BASE         = 'https://api.luchtmeetnet.nl/open_api';

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

const COMPONENTS = ['NO2', 'PM25', 'PM10', 'O3', 'SO2'];

async function fetchStations() {
  const res = await fetch(`${BASE}/stations`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) throw new Error(`Luchtmeetnet stations HTTP ${res.status}`);
  const data = await res.json();
  return data.data ?? data.result ?? data ?? [];
}

async function fetchLatestForComponent(component) {
  // Fetch most recent hourly measurements for all stations
  const now  = new Date();
  const end  = now.toISOString().slice(0, 16);
  const start = new Date(now - 2 * 3600 * 1000).toISOString().slice(0, 16);
  const url = [
    `${BASE}/measurements`,
    `?component=${component}`,
    `&start=${encodeURIComponent(start)}`,
    `&end=${encodeURIComponent(end)}`,
    `&page=1&order_by=timestamp_measured&order_direction=desc`,
  ].join('');
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`Luchtmeetnet ${component} HTTP ${res.status}`);
  const data = await res.json();
  return { component, measurements: data.data ?? data.result ?? [] };
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:luchtmeetnet',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [stationsResult, ...componentResults] = await Promise.allSettled([
      fetchStations(),
      ...COMPONENTS.map(fetchLatestForComponent),
    ]);

    const stations = stationsResult.status === 'fulfilled' ? stationsResult.value : [];
    const measurements = componentResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (!measurements.length) throw new Error('Luchtmeetnet: all component fetches failed');

    // Aggregate latest value per component
    const summary = {};
    for (const { component, measurements: ms } of measurements) {
      const valid = ms.filter(m => m.value != null && m.value >= 0);
      if (valid.length) {
        const avg = valid.reduce((s, m) => s + parseFloat(m.value), 0) / valid.length;
        const max = Math.max(...valid.map(m => parseFloat(m.value)));
        summary[component] = {
          avg:      Math.round(avg * 10) / 10,
          max:      Math.round(max * 10) / 10,
          unit:     ms[0]?.formula ?? ms[0]?.unit ?? 'µg/m³',
          stations: valid.length,
        };
      }
    }

    await verifySeedKey(CANONICAL_KEY, 'summary');
    return {
      station_count: stations.length,
      summary,
      raw_by_component: Object.fromEntries(
        measurements.map(({ component, measurements: ms }) => [
          component,
          ms.slice(0, 20).map(m => ({
            station: m.station_number ?? m.station,
            value:   m.value,
            time:    m.timestamp_measured,
          })),
        ])
      ),
      fetchedAt: new Date().toISOString(),
    };
  },
});
