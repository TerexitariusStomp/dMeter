#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const USGS_EARTHQUAKE_API = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const USGS_DAY_API = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const EMSC_API = 'https://www.seismicportal.eu/fdsnws/event/1/query';
const CANONICAL_KEY = 'seismology:earthquakes:v1';
const CACHE_TTL = 900; // 15 minutes - earthquake data is time-sensitive

interface EarthquakeFeature {
  type: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    tz: string;
    url: string;
    detail: string;
    felt: number;
    cdi: number;
    mmi: number;
    alert: string;
    status: string;
    tsunami: string;
    sig: number;
    net: string;
    code: string;
    ids: string;
    sources: string;
    types: string;
    nst: number;
    dmin: number;
    rms: number;
    gap: number;
    magType: string;
    type: string;
    title: string;
  };
  geometry: {
    type: string;
    coordinates: number[];
  };
}

interface USGSResponse {
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: EarthquakeFeature[];
}

interface EMSCResponse {
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: EarthquakeFeature[];
}

function mapEarthquake(feature: EarthquakeFeature) {
  const coords = feature.geometry.coordinates;
  const properties = feature.properties;
  
  return {
    id: `usgs-${properties.code}-${properties.time}`,
    magnitude: properties.mag,
    place: properties.place,
    timestamp: properties.time,
    updated: properties.updated,
    depth: coords[2] || 0,
    latitude: coords[1],
    longitude: coords[0],
    felt: properties.felt || 0,
    cdi: properties.cdi || 0,
    mmi: properties.mmi || 0,
    alert: properties.alert,
    status: properties.status,
    tsunami: properties.tsunami,
    significance: properties.sig,
    network: properties.net,
    magType: properties.magType,
    title: properties.title,
    url: properties.url,
  };
}

function filterRecentEarthquakes(features: EarthquakeFeature[], hours: number = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return features.filter(f => f.properties.time > cutoff);
}

async function fetchUSGSEarthquakes() {
  try {
    const resp = await fetch(USGS_DAY_API, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[USGS] HTTP ${resp.status}`);
      return [];
    }
    
    const data: USGSResponse = await resp.json();
    const features = data.features || [];
    
    const recent = filterRecentEarthquakes(features);
    const mappedEarthquakes = recent.map(mapEarthquake);
    
    console.log(`[USGS] Fetched ${mappedEarthquakes.length} earthquakes`);
    return mappedEarthquakes;
  } catch (e) {
    console.warn('[USGS] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchEMSCEarthquakes() {
  try {
    const params = new URLSearchParams({
      format: 'geojson',
      starttime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endtime: new Date().toISOString(),
      minmagnitude: '3.0',
      maxmagnitude: '10',
      limit: '500',
    });
    
    const resp = await fetch(`${EMSC_API}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[EMSC] HTTP ${resp.status}`);
      return [];
    }
    
    const data: EMSCResponse = await resp.json();
    const features = data.features || [];
    
    const mappedEarthquakes = features.map(mapEarthquake);
    
    console.log(`[EMSC] Fetched ${mappedEarthquakes.length} earthquakes`);
    return mappedEarthquakes;
  } catch (e) {
    console.warn('[EMSC] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchEarthquakeData() {
  const [usgsData, emscData] = await Promise.allSettled([
    fetchUSGSEarthquakes(),
    fetchEMSCEarthquakes(),
  ]);
  
  const allEarthquakes = [];
  
  if (usgsData.status === 'fulfilled') {
    allEarthquakes.push(...usgsData.value);
  }
  
  if (emscData.status === 'fulfilled') {
    allEarthquakes.push(...emscData.value);
  }
  
  // Sort by magnitude (strongest first)
  allEarthquakes.sort((a, b) => b.magnitude - a.magnitude);
  
  // Deduplicate by location and time (within 1 hour)
  const seen = new Set();
  const dedupedEarthquakes = allEarthquakes.filter(eq => {
    const timeBucket = Math.floor(eq.timestamp / 3600000); // 1-hour buckets
    const key = `${eq.latitude.toFixed(2)}-${eq.longitude.toFixed(2)}-${timeBucket}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`[Earthquakes] Total: ${dedupedEarthquakes.length} unique earthquakes`);
  
  return {
    earthquakes: dedupedEarthquakes.slice(0, 500), // Limit to 500 most significant
    fetchedAt: Date.now(),
    sources: usgsData.status === 'fulfilled' ? ['USGS'] : [],
    sources2: emscData.status === 'fulfilled' ? ['EMSC'] : [],
  };
}

function validate(data) {
  return Array.isArray(data?.earthquakes) && data.earthquakes.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.earthquakes) ? data.earthquakes.length : 0;
}

runSeed('seismology', 'earthquakes', CANONICAL_KEY, fetchEarthquakeData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'usgs-emsc-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 10,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});