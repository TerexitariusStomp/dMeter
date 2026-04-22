#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const NOAA_SPACE_WEATHER_API = 'https://services.swpc.noaa.gov/json/solar_warnings.json';
const SPACE_WEATHER_API = 'https://api.nasa.gov/DONKI/WSAEnlilSimulation';
const SOLAR_MONITOR_API = 'https://www.solarmonitor.org/api.php';
const CANONICAL_KEY = 'space:weather-forecasts:v1';
const CACHE_TTL = 3600; // 1 hour - space weather changes frequently

interface SolarWarning {
  issueTime: string;
  startTime: string;
  endTime: string;
  type: string;
  severity: string;
  product: string;
  issueId: string;
  description: string;
}

interface SpaceWeatherResponse {
  warnings: SolarWarning[];
}

interface WSAEnlilData {
  activityID: string;
  startTime: string;
  startTimeUT: string;
  startTimeISO: string;
  endTime: string;
  endTimeUT: string;
  endTimeISO: string;
  leadTime: number;
  leadTimeUT: string;
  type: string;
  typeDescription: string;
  speed: number;
  density: number;
  temperature: number;
  bz: number;
  by: number;
  bx: number;
  lat: number;
  lon: number;
  sourceLocation: string;
}

interface SolarMonitorData {
  timestamp: string;
  totalFlux: number;
  xrayFlux: number;
  protonFlux: number;
  electronFlux: number;
  geoeffective: boolean;
}

function mapSolarWarning(warning: SolarWarning) {
  return {
    id: `solar-${warning.issueId}-${new Date(warning.issueTime).getTime()}`,
    issueTime: new Date(warning.issueTime).getTime(),
    startTime: new Date(warning.startTime).getTime(),
    endTime: new Date(warning.endTime).getTime(),
    type: warning.type,
    severity: warning.severity,
    product: warning.product,
    description: warning.description,
    isActive: Date.now() > new Date(warning.startTime).getTime() && 
              Date.now() < new Date(warning.endTime).getTime(),
  };
}

async function fetchNOAASpaceWeather() {
  try {
    const resp = await fetch(NOAA_SPACE_WEATHER_API, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[NOAA Space] HTTP ${resp.status}`);
      return [];
    }
    
    const data: SpaceWeatherResponse = await resp.json();
    const warnings = data.warnings || [];
    
    const mappedWarnings = warnings.map(mapSolarWarning);
    
    console.log(`[NOAA Space] Fetched ${mappedWarnings.length} warnings`);
    return mappedWarnings;
  } catch (e) {
    console.warn('[NOAA Space] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchNASAWeatherData() {
  try {
    const resp = await fetch(`${SPACE_WEATHER_API}?startDate=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&endDate=${new Date().toISOString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[NASA Weather] HTTP ${resp.status}`);
      return [];
    }
    
    const data = await resp.json();
    const simulations = data || [];
    
    const mappedSimulations = simulations.map((sim: WSAEnlilData) => ({
      id: `wsa-${sim.activityID}`,
      activityID: sim.activityID,
      startTime: new Date(sim.startTimeISO).getTime(),
      endTime: new Date(sim.endTimeISO).getTime(),
      leadTime: sim.leadTime,
      type: sim.type,
      typeDescription: sim.typeDescription,
      speed: sim.speed,
      density: sim.density,
      temperature: sim.temperature,
      bz: sim.bz,
      by: sim.by,
      bx: sim.bx,
      lat: sim.lat,
      lon: sim.lon,
      sourceLocation: sim.sourceLocation,
    }));
    
    console.log(`[NASA Weather] Fetched ${mappedSimulations.length} simulations`);
    return mappedSimulations;
  } catch (e) {
    console.warn('[NASA Weather] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchSolarMonitorData() {
  try {
    const resp = await fetch(SOLAR_MONITOR_API, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[Solar Monitor] HTTP ${resp.status}`);
      return [];
    }
    
    const data: SolarMonitorData[] = await resp.json();
    const recentData = data.slice(0, 50); // Limit to 50 most recent
    
    console.log(`[Solar Monitor] Fetched ${recentData.length} measurements`);
    return recentData;
  } catch (e) {
    console.warn('[Solar Monitor] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchSpaceWeatherData() {
  const [noaaData, nasaData, solarMonitorData] = await Promise.allSettled([
    fetchNOAASpaceWeather(),
    fetchNASAWeatherData(),
    fetchSolarMonitorData(),
  ]);
  
  const spaceWeather = {
    warnings: noaaData.status === 'fulfilled' ? noaaData.value : [],
    simulations: nasaData.status === 'fulfilled' ? nasaData.value : [],
    measurements: solarMonitorData.status === 'fulfilled' ? solarMonitorData.value : [],
    fetchedAt: Date.now(),
    sources: [
      noaaData.status === 'fulfilled' ? 'NOAA' : null,
      nasaData.status === 'fulfilled' ? 'NASA' : null,
      solarMonitorData.status === 'fulfilled' ? 'SolarMonitor' : null,
    ].filter(Boolean),
  };
  
  console.log(`[Space Weather] Total: ${spaceWeather.warnings.length} warnings, ${spaceWeather.simulations.length} simulations, ${spaceWeather.measurements.length} measurements`);
  
  return spaceWeather;
}

function validate(data) {
  return (Array.isArray(data?.warnings) && data.warnings.length >= 1) ||
         (Array.isArray(data?.simulations) && data.simulations.length >= 1) ||
         (Array.isArray(data?.measurements) && data.measurements.length >= 1);
}

export function declareRecords(data) {
  return (data?.warnings?.length || 0) + 
         (data?.simulations?.length || 0) + 
         (data?.measurements?.length || 0);
}

runSeed('space', 'weather-forecasts', CANONICAL_KEY, fetchSpaceWeatherData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'noaa-nasa-solarmonitor-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 30,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});