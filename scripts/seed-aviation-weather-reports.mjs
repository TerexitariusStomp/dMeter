#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const AVIATION_API = 'https://aviationweather.api.briefing.mil';
const METAR_API = 'https://aviationweather.api.briefing.mil/data/dataserver_current/threads/1/dataserver.xml?dataSource=metars&requestType=retrieve';
const TAF_API = 'https://aviationweather.api.briefing.mil/data/dataserver_current/threads/1/dataserver.xml?dataSource=tafs&requestType=retrieve';
const CANONICAL_KEY = 'aviation:weather-reports:v1';
const CACHE_TTL = 600; // 10 minutes - aviation weather is time-critical

interface AviationWeather {
  stationId: string;
  location: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation: number;
  metar: string;
  taf: string;
  timestamp: string;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  visibility: number;
  conditions: string;
}

interface METARResponse {
  data: {
    METAR: Array<{
      raw_text: string;
      station_id: string;
      observation_time: string;
      latitude: number;
      longitude: number;
      elevation_m: number;
      temp_c: number;
      wind_dir_degrees: number;
      wind_speed_kt: number;
      visibility_statute_mi: number;
      flight_category: string;
    }>;
  };
}

interface TAFResponse {
  data: {
    TAF: Array<{
      raw_text: string;
      station_id: string;
      issue_time: string;
    }>;
  };
}

const MAJOR_AIRPORTS = [
  'KJFK', 'KLAX', 'KORD', 'KDFW', 'KATL', 'KSEA', 'KMIA', 'KPHX',
  'EGCC', 'EGLL', 'LFPG', 'EDDF', 'LEMD', 'LIRF', 'EHAM', 'LFPG',
  'RJTT', 'RJBB', 'RJOO', 'RJSS', 'VHHH', 'VMMC', 'VTBD', 'WSSS',
  'YSSY', 'YMML', 'AKL', 'NZAA', 'SBGR', 'SBSP', 'SBBR', 'SBGL',
  'OMDB', 'OHRM', 'OBBI', 'OIAA', 'WADD', 'WIII', 'VABB', 'VOBL',
  'UTTT', 'UTSA', 'UMMS', 'UAAA', 'UACC', 'UIII', 'UMKK', 'UTTT',
];

function parseMETAR(rawText: string): Partial<AviationWeather> {
  const metar = rawText.toUpperCase();
  
  // Extract basic information
  const stationId = metar.substring(0, 4);
  const timestamp = metar.substring(7, 15);
  
  // Extract temperature
  const tempMatch = metar.match(/(\d{2})\/(\d{2})/);
  const temperature = tempMatch ? parseInt(tempMatch[1]) : null;
  
  // Extract wind
  const windMatch = metar.match(/(\d{3})KT/);
  const windDirection = windMatch ? parseInt(windMatch[1]) : null;
  const windSpeed = windMatch ? parseInt(windMatch[1].substring(0, 3)) : null;
  
  // Extract visibility
  const visMatch = metar.match(/(\d{1,2})SM/);
  const visibility = visMatch ? parseInt(visMatch[1]) : 10; // Default 10 SM
  
  // Extract conditions
  let conditions = 'Clear';
  if (metar.includes('VFR')) conditions = 'VFR';
  else if (metar.includes('IFR')) conditions = 'IFR';
  else if (metar.includes('LIFR')) conditions = 'LIFR';
  else if (metar.includes('MVFR')) conditions = 'MVFR';
  else if (metar.includes('CLOUDS') || metar.includes('OVC') || metar.includes('BKN')) conditions = 'Cloudy';
  else if (metar.includes('RAIN') || metar.includes('SHRA') || metar.includes('TS')) conditions = 'Rain';
  else if (metar.includes('SNOW') || metar.includes('SN')) conditions = 'Snow';
  
  return {
    stationId,
    timestamp,
    temperature,
    windSpeed,
    windDirection,
    visibility,
    conditions,
  };
}

function parseTAF(rawText: string): string {
  return rawText;
}

async function fetchMETARData() {
  try {
    const params = new URLSearchParams({
      requestType: 'retrieve',
      format: 'xml',
      hoursBeforeNow: '1',
      mostRecent: 'true',
    });
    
    const resp = await fetch(`${METAR_API}&${params}`, {
      headers: { Accept: 'application/xml', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[METAR] HTTP ${resp.status}`);
      return [];
    }
    
    const xml = await resp.text();
    // Parse XML response (simplified for demonstration)
    const metarData: METARResponse = { data: { METAR: [] } };
    
    // In practice, you'd use an XML parser
    console.log(`[METAR] Fetched METAR data`);
    return metarData.data.METAR || [];
  } catch (e) {
    console.warn('[METAR] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchTAFData() {
  try {
    const params = new URLSearchParams({
      requestType: 'retrieve',
      format: 'xml',
      hoursBeforeNow: '6',
      mostRecent: 'true',
    });
    
    const resp = await fetch(`${TAF_API}&${params}`, {
      headers: { Accept: 'application/xml', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[TAF] HTTP ${resp.status}`);
      return [];
    }
    
    const xml = await resp.text();
    const tafData: TAFResponse = { data: { TAF: [] } };
    
    console.log(`[TAF] Fetched TAF data`);
    return tafData.data.TAF || [];
  } catch (e) {
    console.warn('[TAF] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchAviationWeather() {
  const [metarData, tafData] = await Promise.allSettled([
    fetchMETARData(),
    fetchTAFData(),
  ]);
  
  const aviationReports = [];
  
  if (metarData.status === 'fulfilled') {
    const metars = metarData.value || [];
    aviationReports.push(...metars.map(metar => ({
      ...parseMETAR(metar.raw_text || ''),
      stationId: metar.station_id,
      location: metar.station_id,
      country: 'US', // Simplified
      latitude: metar.latitude,
      longitude: metar.longitude,
      elevation: metar.elevation_m,
      metar: metar.raw_text,
      taf: '',
      timestamp: metar.observation_time,
      temperature: metar.temp_c,
      windSpeed: metar.wind_speed_kt,
      windDirection: metar.wind_dir_degrees,
      visibility: metar.visibility_statute_mi,
      conditions: metar.flight_category,
    })));
  }
  
  if (tafData.status === 'fulfilled') {
    const tafs = tafData.value || [];
    aviationReports.push(...tafs.map(taf => ({
      stationId: taf.station_id,
      location: taf.station_id,
      country: 'US',
      latitude: 0,
      longitude: 0,
      elevation: 0,
      metar: '',
      taf: taf.raw_text,
      timestamp: taf.issue_time,
      temperature: 0,
      windSpeed: 0,
      windDirection: 0,
      visibility: 10,
      conditions: 'TAF',
    })));
  }
  
  console.log(`[Aviation] Total: ${aviationReports.length} weather reports`);
  
  return {
    reports: aviationReports.slice(0, 100), // Limit to 100 most recent
    fetchedAt: Date.now(),
    sources: metarData.status === 'fulfilled' ? ['METAR'] : [],
    sources2: tafData.status === 'fulfilled' ? ['TAF'] : [],
  };
}

function validate(data) {
  return Array.isArray(data?.reports) && data.reports.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.reports) ? data.reports.length : 0;
}

runSeed('aviation', 'weather-reports', CANONICAL_KEY, fetchAviationWeather, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'aviationweather-mil-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 5,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});