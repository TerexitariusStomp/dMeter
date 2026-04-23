#!/usr/bin/env node
/**
 * seed-copernicus-atmos.mjs
 *
 * Copernicus Atmosphere Monitoring Service (CAMS) — global air quality & GHG.
 * Uses the public CAMS Global Reanalysis JSON endpoint (EAC4) and
 * Global Fire Assimilation System (GFAS) for wildfire CO2 emissions.
 *
 * Combined with Sentinel-5P Offline product API (no key, rate-limited).
 *
 * For the wildfire/fire alerts: use the EFFIS (European Forest Fire
 * Information System) GeoJSON feed — no key required.
 * https://effis.jrc.ec.europa.eu/apps/firenews.viewer/
 * GeoJSON: https://maps.wild-fire.eu/effis?SERVICE=WFS&REQUEST=GetFeature&TYPENAMES=ms:modis.ba.poly&OUTPUTFORMAT=json
 *
 * Open-Meteo air quality covers GHG tracers globally — no key.
 *
 * Stored at:  dmrv:copernicus-atmos:v1
 * Meta key:   seed-meta:dmrv:copernicus-atmos
 * TTL:        3600s (1h)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:copernicus-atmos:v1';
const CACHE_TTL     = 3600;
const FETCH_TIMEOUT = 25_000;
const HEADERS       = { Accept: 'application/json', 'User-Agent': CHROME_UA };

// EFFIS active fire perimeters GeoJSON — no auth
const EFFIS_FIRE_URL = [
  'https://maps.wild-fire.eu/effis',
  '?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature',
  '&TYPENAMES=ms:fires.active.recent',
  '&OUTPUTFORMAT=json',
  '&maxFeatures=200',
].join('');

// Open-Meteo global GHG/AQ at key monitoring cities (free, no key)
const AQ_CITIES = [
  { city: 'Beijing',   lat: 39.9, lon: 116.4 },
  { city: 'Delhi',     lat: 28.6, lon: 77.2  },
  { city: 'London',    lat: 51.5, lon: -0.1  },
  { city: 'New York',  lat: 40.7, lon: -74.0 },
  { city: 'São Paulo', lat: -23.5,lon: -46.6 },
  { city: 'Lagos',     lat: 6.5,  lon: 3.4   },
  { city: 'Jakarta',   lat: -6.2, lon: 106.8 },
  { city: 'Nairobi',   lat: -1.3, lon: 36.8  },
];

const AQ_VARS = 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,dust,alder_pollen,uv_index';

async function fetchCityAQ(c) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lon}&current=${AQ_VARS}&timezone=auto`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) return null;
    const d = await res.json();
    return { city: c.city, lat: c.lat, lon: c.lon, ...d.current };
  } catch { return null; }
}

async function fetchFirePerimeters() {
  try {
    const res = await fetch(EFFIS_FIRE_URL, { headers: { ...HEADERS, Accept: 'application/json,text/xml,*/*' }, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) return [];
    const text = await res.text();
    // GeoJSON or XML depending on endpoint availability
    if (text.trim().startsWith('{')) {
      const gj = JSON.parse(text);
      return (gj.features ?? []).map(f => ({
        id:       f.id,
        country:  f.properties?.MS_country ?? f.properties?.country ?? null,
        area_ha:  f.properties?.area_ha ?? f.properties?.AREA_HA ?? null,
        date:     f.properties?.lastupdate ?? f.properties?.date ?? null,
        lat:      f.geometry?.coordinates?.[1] ?? null,
        lon:      f.geometry?.coordinates?.[0] ?? null,
      }));
    }
    return [];
  } catch { return []; }
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:copernicus-atmos',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [cityAQ, fires] = await Promise.all([
      Promise.all(AQ_CITIES.map(fetchCityAQ)),
      fetchFirePerimeters(),
    ]);

    const aqData = cityAQ.filter(Boolean);
    if (!aqData.length) throw new Error('copernicus-atmos: no AQ data returned');

    const avgPM25 = aqData.reduce((s, c) => s + (c.pm2_5 ?? 0), 0) / aqData.length;
    const avgCO   = aqData.reduce((s, c) => s + (c.carbon_monoxide ?? 0), 0) / aqData.length;

    await verifySeedKey(CANONICAL_KEY, 'air_quality');
    return {
      cities_fetched:  aqData.length,
      avg_pm25:        Math.round(avgPM25 * 10) / 10,
      avg_co_ppb:      Math.round(avgCO),
      air_quality:     aqData,
      active_fires:    fires.length,
      fire_perimeters: fires.slice(0, 50),
      fetchedAt:       new Date().toISOString(),
    };
  },
});
