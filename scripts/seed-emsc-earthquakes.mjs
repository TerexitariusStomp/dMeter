#!/usr/bin/env node
/**
 * seed-emsc-earthquakes.mjs
 *
 * Fetches seismic events from the EMSC (European-Mediterranean Seismological Centre).
 * https://www.seismicportal.eu/realtime.html
 *
 * REST FDSN API (FDSNWS event service): no key required.
 * Endpoint: https://www.seismicportal.eu/fdsnws/event/1/query
 *
 * Complements USGS (US-centric) with European, Mediterranean, Central-Asian events.
 * EMSC covers events that USGS often misses in Eastern Europe, MENA, Central Asia.
 *
 * Stored at:  dmrv:emsc-earthquakes:v1
 * Meta key:   seed-meta:dmrv:emsc-earthquakes
 * TTL:        600s (10min) — seismic events are time-critical
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY  = 'dmrv:emsc-earthquakes:v1';
const CACHE_TTL      = 600; // 10min
const FETCH_TIMEOUT  = 20_000;

// EMSC FDSNWS endpoint — returns GeoJSON FeatureCollection
// min magnitude 2.5, last 7 days, max 1000 events
const EMSC_URL = [
  'https://www.seismicportal.eu/fdsnws/event/1/query',
  '?format=json',
  '&limit=500',
  '&minmag=2.5',
  `&starttime=${getIso7DaysAgo()}`,
  '&orderby=time',
].join('');

function getIso7DaysAgo() {
  const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().split('.')[0];
}

function mapMagnitudeType(mt) {
  const t = (mt || '').toLowerCase();
  if (t === 'mw' || t === 'mww') return 'mw';
  if (t === 'ml') return 'ml';
  if (t === 'mb') return 'mb';
  return mt || null;
}

function parseFeatures(geojson) {
  const features = geojson?.features || [];
  return features.map(f => {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates;
    return {
      id:          f.id || p.unid || null,
      time:        p.time || null,
      lat:         coords?.[1] ?? null,
      lon:         coords?.[0] ?? null,
      depth_km:    coords?.[2] != null ? Math.round(coords[2]) : null,
      magnitude:   p.mag != null ? Math.round(p.mag * 10) / 10 : null,
      mag_type:    mapMagnitudeType(p.magtype),
      place:       p.flynn_region || p.auth || null,
      source:      p.auth || 'EMSC',
      last_update: p.lastupdate || null,
    };
  }).filter(e => e.lat != null && e.lon != null && e.magnitude != null);
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:emsc-earthquakes',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const res = await fetch(EMSC_URL, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) throw new Error(`EMSC HTTP ${res.status}`);
    const geojson = await res.json();
    const earthquakes = parseFeatures(geojson);

    if (earthquakes.length === 0) {
      throw new Error('EMSC returned 0 events');
    }

    const summary = {
      total:    earthquakes.length,
      mag4plus: earthquakes.filter(e => e.magnitude >= 4.0).length,
      mag5plus: earthquakes.filter(e => e.magnitude >= 5.0).length,
    };

    await verifySeedKey(CANONICAL_KEY, 'earthquakes');
    return { earthquakes, summary, fetchedAt: new Date().toISOString() };
  },
});
