#!/usr/bin/env node
/**
 * seed-usgs-water.mjs
 *
 * Fetches real-time USGS stream/water quality gauge data.
 * https://waterservices.usgs.gov/rest/IV-Service.html
 *
 * REST API — no key required. Provides ~10,000 US stream gauges with:
 * - Streamflow (discharge, ft³/s)
 * - Gage height (ft)
 * - Water temperature (°C)
 * - Specific conductance (μS/cm) — proxy for contamination
 * - Turbidity (FNU) — suspended sediment
 *
 * This provides ground-truth hydrological data for MRV of floods, droughts,
 * and water quality events.
 *
 * Stored at:  dmrv:usgs-water:v1
 * Meta key:   seed-meta:dmrv:usgs-water
 * TTL:        900s (15min) — gauges report in near-real-time (15min intervals)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:usgs-water:v1';
const CACHE_TTL     = 900;
const FETCH_TIMEOUT = 30_000;

// Parameter codes
// 00060 = discharge (ft³/s), 00065 = gage height (ft),
// 00010 = water temp (°C),   00095 = specific conductance,
// 63680 = turbidity
const PARAM_CODES = ['00060', '00065', '00010', '00095', '63680'];

// Fetch sites with recent data, limit to 2000 sites for manageable payload
const USGS_IV_URL = [
  'https://waterservices.usgs.gov/nwis/iv/',
  '?format=json',
  '&stateCd=',  // fetch per state-group below
  '&parameterCd=' + PARAM_CODES.join(','),
  '&siteStatus=active',
  '&siteType=ST',  // streams only
].join('');

// Individual state codes — USGS only accepts one stateCd at a time
const STATES = [
  'ca', 'tx', 'fl', 'ny', 'wa', 'or', 'co', 'az', 'mt', 'id',
  'ut', 'nv', 'nm', 'wy', 'mn', 'wi', 'mi', 'oh', 'pa', 'va',
  'ga', 'nc', 'tn', 'al', 'ms', 'la', 'ar', 'mo', 'il', 'in',
];

function parseTimeSeries(tsArray) {
  const sites = new Map();

  for (const ts of tsArray) {
    const siteInfo = ts.sourceInfo;
    const siteCode = siteInfo?.siteCode?.[0]?.value;
    if (!siteCode) continue;

    const geo = siteInfo?.geoLocation?.geogLocation;
    const lat = parseFloat(geo?.latitude);
    const lon = parseFloat(geo?.longitude);
    if (!isFinite(lat) || !isFinite(lon)) continue;

    if (!sites.has(siteCode)) {
      sites.set(siteCode, {
        id:         `usgs-${siteCode}`,
        site_code:  siteCode,
        name:       siteInfo.siteName || null,
        lat,
        lon,
        params: {},
      });
    }

    const site = sites.get(siteCode);
    const varCode = ts.variable?.variableCode?.[0]?.value;
    const varName = ts.variable?.variableName || '';
    const values  = ts.values?.[0]?.value;
    if (!values?.length) continue;

    // Get most recent non-null reading
    const recent = [...values].reverse().find(v => v.value != null && v.value !== '-999999');
    if (!recent) continue;

    const num = parseFloat(recent.value);
    if (!isFinite(num)) continue;

    const paramKey = {
      '00060': 'discharge_cfs',
      '00065': 'gage_height_ft',
      '00010': 'water_temp_c',
      '00095': 'conductance_us_cm',
      '63680': 'turbidity_fnu',
    }[varCode] || varCode;

    site.params[paramKey] = Math.round(num * 100) / 100;
    if (!site.last_updated || recent.dateTime > site.last_updated) {
      site.last_updated = recent.dateTime;
    }
  }

  return [...sites.values()].filter(s => Object.keys(s.params).length > 0);
}

async function fetchState(state) {
  const url = USGS_IV_URL.replace('&stateCd=', `&stateCd=${state}`);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return parseTimeSeries(data?.value?.timeSeries || []);
  } catch {
    return [];
  }
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:usgs-water',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    // Parallel fetch all states (one at a time per USGS API requirement)
    const groups = await Promise.all(STATES.map(s => fetchState(s)));
    const allSites = groups.flat();

    // Deduplicate by site_code
    const seen = new Set();
    const sites = allSites.filter(s => {
      if (seen.has(s.site_code)) return false;
      seen.add(s.site_code);
      return true;
    });

    if (sites.length < 50) {
      throw new Error(`Too few USGS water sites: ${sites.length}`);
    }

    const summary = {
      total:          sites.length,
      withDischarge:  sites.filter(s => s.params.discharge_cfs != null).length,
      withTemp:       sites.filter(s => s.params.water_temp_c != null).length,
      withTurbidity:  sites.filter(s => s.params.turbidity_fnu != null).length,
    };

    await verifySeedKey(CANONICAL_KEY, 'sites');
    return { sites, summary, fetchedAt: new Date().toISOString() };
  },
});
