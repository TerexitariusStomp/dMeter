#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const MARITRAFFIC_API = 'https://services.marinetraffic.com/api/v0/public/port_calls';
const SHIPSINWEB_API = 'https://api.shipsinweb.com/v1/positions';
const CANONICAL_KEY = 'maritime:ais-positions:v1';
const CACHE_TTL = 1800; // 30 minutes - AIS data is very time-sensitive

interface AISPosition {
  mmsi: string;
  shipName: string;
  shipType: string;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  heading: number;
  timestamp: string;
  port: string;
  country: string;
  flag: string;
}

interface MarineTrafficResponse {
  data: {
    mmsi: string;
    ship_name: string;
    ship_type: string;
    lat: number;
    lon: number;
    speed: number;
    course: number;
    heading: number;
    timestamp: string;
    port_name: string;
    country_name: string;
    flag_code: string;
  }[];
}

interface ShipsInWebResponse {
  ships: Array<{
    mmsi: number;
    name: string;
    type: string;
    lat: number;
    lon: number;
    speed: number;
    course: number;
    heading: number;
    timestamp: string;
    port: string;
    country: string;
    flag: string;
  }>;
}

function mapAISPosition(position: AISPosition) {
  return {
    id: `ais-${position.mmsi}-${new Date(position.timestamp).getTime()}`,
    mmsi: position.mmsi,
    shipName: position.shipName,
    shipType: position.shipType,
    lat: position.lat,
    lon: position.lon,
    speed: position.speed,
    course: position.course,
    heading: position.heading,
    timestamp: new Date(position.timestamp).getTime(),
    port: position.port,
    country: position.country,
    flag: position.flag,
  };
}

async function fetchMarineTrafficData() {
  try {
    const params = new URLSearchParams({
      api_key: process.env.MARITRAFFIC_API_KEY || '',
      port_id: '1001', // Major port ID (can be expanded)
      limit: '500',
      protocol: 'json',
      msgtype: 'portcalls',
    });
    
    const resp = await fetch(`${MARITRAFFIC_API}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[MarineTraffic] HTTP ${resp.status}`);
      return [];
    }
    
    const data: MarineTrafficResponse = await resp.json();
    const positions = data.data || [];
    
    const mappedPositions = positions
      .filter(p => p.mmsi && p.lat && p.lon && p.timestamp)
      .map(p => mapAISPosition({
        mmsi: p.mmsi,
        shipName: p.ship_name,
        shipType: p.ship_type,
        lat: p.lat,
        lon: p.lon,
        speed: p.speed || 0,
        course: p.course || 0,
        heading: p.heading || 0,
        timestamp: p.timestamp,
        port: p.port_name,
        country: p.country_name,
        flag: p.flag_code,
      }));
    
    console.log(`[MarineTraffic] Fetched ${mappedPositions.length} positions`);
    return mappedPositions;
  } catch (e) {
    console.warn('[MarineTraffic] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchShipsInWebData() {
  try {
    const params = new URLSearchParams({
      api_key: process.env.SHIPSINWEB_API_KEY || '',
      limit: '500',
      include_inactive: 'false',
    });
    
    const resp = await fetch(`${SHIPSINWEB_API}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[ShipsInWeb] HTTP ${resp.status}`);
      return [];
    }
    
    const data: ShipsInWebResponse = await resp.json();
    const positions = data.ships || [];
    
    const mappedPositions = positions
      .filter(p => p.mmsi && p.lat && p.lon && p.timestamp)
      .map(p => mapAISPosition({
        mmsi: p.mmsi.toString(),
        shipName: p.name,
        shipType: p.type,
        lat: p.lat,
        lon: p.lon,
        speed: p.speed || 0,
        course: p.course || 0,
        heading: p.heading || 0,
        timestamp: p.timestamp,
        port: p.port,
        country: p.country,
        flag: p.flag,
      }));
    
    console.log(`[ShipsInWeb] Fetched ${mappedPositions.length} positions`);
    return mappedPositions;
  } catch (e) {
    console.warn('[ShipsInWeb] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchAISData() {
  const [marineTrafficData, shipsInWebData] = await Promise.allSettled([
    fetchMarineTrafficData(),
    fetchShipsInWebData(),
  ]);
  
  const allPositions = [];
  
  if (marineTrafficData.status === 'fulfilled') {
    allPositions.push(...marineTrafficData.value);
  }
  
  if (shipsInWebData.status === 'fulfilled') {
    allPositions.push(...shipsInWebData.value);
  }
  
  // Deduplicate by MMSI and timestamp (keep most recent)
  const seen = new Set();
  const dedupedPositions = allPositions.filter(pos => {
    const key = `${pos.mmsi}-${Math.floor(pos.timestamp / 60000)}`; // Group by minute
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Sort by timestamp (most recent first)
  dedupedPositions.sort((a, b) => b.timestamp - a.timestamp);
  
  console.log(`[AIS] Total: ${dedupedPositions.length} unique positions`);
  
  return {
    positions: dedupedPositions.slice(0, 1000), // Limit to 1000 most recent
    fetchedAt: Date.now(),
    sources: marineTrafficData.status === 'fulfilled' ? ['MarineTraffic'] : [],
    sources2: shipsInWebData.status === 'fulfilled' ? ['ShipsInWeb'] : [],
  };
}

function validate(data) {
  return Array.isArray(data?.positions) && data.positions.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.positions) ? data.positions.length : 0;
}

runSeed('maritime', 'ais-positions', CANONICAL_KEY, fetchAISData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'marinetraffic-shipsinweb-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 15,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});