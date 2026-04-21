#!/usr/bin/env node
/**
 * seed-uk-carbon.mjs
 *
 * UK National Grid Carbon Intensity — official API from National Grid ESO.
 * https://carbon-intensity.github.io/api-definitions — no key required.
 *
 * Provides real-time and forecast carbon intensity (gCO2/kWh) for Great Britain's
 * electricity grid, broken down by generation source (wind, solar, gas, nuclear, etc.)
 *
 * Stored at:  dmrv:uk-carbon:v1
 * Meta key:   seed-meta:dmrv:uk-carbon
 * TTL:        1800s (30min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:uk-carbon:v1';
const CACHE_TTL     = 1800;
const FETCH_TIMEOUT = 15_000;
const BASE         = 'https://api.carbonintensity.org.uk';

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:uk-carbon',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [currentRes, mixRes, regionalRes] = await Promise.all([
      fetch(`${BASE}/intensity`,           { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) }),
      fetch(`${BASE}/generation`,          { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) }),
      fetch(`${BASE}/regional`,            { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) }),
    ]);

    if (!currentRes.ok) throw new Error(`Carbon Intensity HTTP ${currentRes.status}`);
    if (!mixRes.ok)     throw new Error(`Generation mix HTTP ${mixRes.status}`);

    const current  = await currentRes.json();
    const mix      = await mixRes.json();
    const regional = regionalRes.ok ? await regionalRes.json() : null;

    const intensity = current?.data?.[0]?.intensity ?? {};
    const genMix    = mix?.data?.[0]?.generalmix ?? mix?.data?.[0]?.generationmix ?? [];

    // Summarise regional variation
    const regions = regional?.data?.[0]?.regions?.map(r => ({
      id:           r.regionid,
      name:         r.shortname,
      intensity:    r.intensity?.forecast,
      index:        r.intensity?.index,
    })) ?? [];

    // Renewable fraction
    const renewableFuels = ['wind', 'solar', 'hydro', 'biomass', 'nuclear'];
    const renewablePct = genMix
      .filter(g => renewableFuels.includes(g.fuel))
      .reduce((s, g) => s + (g.perc ?? 0), 0);

    await verifySeedKey(CANONICAL_KEY, 'intensity');
    return {
      intensity: {
        forecast: intensity.forecast,
        actual:   intensity.actual,
        index:    intensity.index,
      },
      generation_mix: genMix,
      renewable_pct:  Math.round(renewablePct * 10) / 10,
      regions,
      fetchedAt: new Date().toISOString(),
    };
  },
});
