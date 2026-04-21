#!/usr/bin/env node
/**
 * seed-noaa-buoys.mjs
 *
 * Fetches real-time ocean/atmosphere observational data from NOAA buoys.
 * https://www.ndbc.noaa.gov/data/realtime2/
 *
 * Data: NDBC (National Data Buoy Center) latest observations.
 * Each .txt file covers one buoy station. We fetch the station index then
 * sample the highest-priority stations (global spread).
 *
 * NDBC station list: https://www.ndbc.noaa.gov/activestations.xml
 * Latest observations: https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt
 *
 * Stored at:  dmrv:noaa-buoys:v1
 * Meta key:   seed-meta:dmrv:noaa-buoys
 * TTL:        3600s (1h) — buoys report hourly
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey, sleep } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY    = 'dmrv:noaa-buoys:v1';
const CACHE_TTL        = 3600;
const FETCH_TIMEOUT    = 20_000;

// NDBC bulk latest observations (all active stations, fixed-width text)
const LATEST_OBS_URL   = 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt';
// NDBC active stations metadata (XML)
const STATIONS_XML_URL = 'https://www.ndbc.noaa.gov/activestations.xml';

const MAX_STATIONS = 500; // cap to avoid oversized payload

/** Parse NDBC latest_obs.txt fixed-width format */
function parseLatestObs(text) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const stations = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 15) continue;

    const [
      id, lat, lon, yyyy, mm, dd, hh, min,
      wdir, wspd, gst, wvht, dpd, apd, mwd,
      pres, atmp, wtmp, dewp, vis, ptdy, tide,
    ] = parts;

    const toNum = v => (v === 'MM' || v == null) ? null : parseFloat(v);

    const station = {
      id,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      timestamp: `${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`,
      wind_dir_deg:    toNum(wdir),
      wind_speed_ms:   toNum(wspd),
      wind_gust_ms:    toNum(gst),
      wave_height_m:   toNum(wvht),
      wave_period_s:   toNum(dpd),
      wave_dir_deg:    toNum(mwd),
      pressure_hpa:    toNum(pres),
      air_temp_c:      toNum(atmp),
      water_temp_c:    toNum(wtmp),
      dewpoint_c:      toNum(dewp),
      visibility_km:   toNum(vis),
    };

    if (!isFinite(station.lat) || !isFinite(station.lon)) continue;
    stations.push(station);
    if (stations.length >= MAX_STATIONS) break;
  }
  return stations;
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:noaa-buoys',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const res = await fetch(LATEST_OBS_URL, {
      headers: { Accept: 'text/plain', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) throw new Error(`NOAA Buoys HTTP ${res.status}`);
    const text = await res.text();
    const stations = parseLatestObs(text);

    if (stations.length < 10) {
      throw new Error(`Too few NOAA buoy stations: ${stations.length}`);
    }

    const summary = {
      total:          stations.length,
      withWaveHeight: stations.filter(s => s.wave_height_m != null).length,
      withWaterTemp:  stations.filter(s => s.water_temp_c != null).length,
      withPressure:   stations.filter(s => s.pressure_hpa != null).length,
    };

    await verifySeedKey(CANONICAL_KEY, 'stations');
    return { stations, summary, fetchedAt: new Date().toISOString() };
  },
});
