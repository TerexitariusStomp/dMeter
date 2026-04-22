#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const NASA_FIRMS_API = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const MODIS_FIRE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv?product=MODIS_C6&date=today';
const VIIRS_FIRE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv?product=VIIRS_NOAA20_C6&date=today';
const VIIRS_SUOMI_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv?product=VIIRS_SNP_NRT_C6&date=today';
const CANONICAL_KEY = 'environment:fire-detections:nasa:v1';
const CACHE_TTL = 3600; // 1 hour - fire data is time-sensitive

interface FireDetection {
  latitude: number;
  longitude: number;
  brightness: number;
  bright_t31: number;
  frp: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  instrument: string;
  confidence: string;
  version: string;
  daynight: string;
}

interface FireResponse {
  data: FireDetection[];
}

function mapFireDetection(detection: FireDetection) {
  const timestamp = new Date(`${detection.acq_date}T${detection.acq_time}Z`);
  
  return {
    id: `fire-${detection.latitude}-${detection.longitude}-${timestamp.getTime()}`,
    latitude: detection.latitude,
    longitude: detection.longitude,
    brightness: detection.brightness,
    brightT31: detection.bright_t31,
    frp: detection.frp, // Fire Radiative Power
    timestamp: timestamp.getTime(),
    satellite: detection.satellite,
    instrument: detection.instrument,
    confidence: detection.confidence,
    version: detection.version,
    dayNight: detection.daynight,
    date: detection.acq_date,
    time: detection.acq_time,
  };
}

function parseCSV(csv: string): FireDetection[] {
  const lines = csv.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) continue;
    
    const detection: any = {};
    headers.forEach((header, index) => {
      detection[header] = values[index];
    });
    
    // Convert numeric fields
    const numericFields = ['latitude', 'longitude', 'brightness', 'bright_t31', 'frp'];
    numericFields.forEach(field => {
      if (detection[field]) {
        detection[field] = parseFloat(detection[field]);
      }
    });
    
    data.push(detection);
  }
  
  return data;
}

async function fetchNASAFireData(url: string, source: string) {
  try {
    const resp = await fetch(url, {
      headers: { 
        'Accept': 'text/csv',
        'User-Agent': CHROME_UA,
      },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!resp.ok) {
      console.warn(`[NASA Fire] ${source} HTTP ${resp.status}`);
      return [];
    }
    
    const csv = await resp.text();
    const detections = parseCSV(csv);
    
    const mappedDetections = detections
      .filter(d => d.latitude && d.longitude && d.acq_date && d.acq_time)
      .map(mapFireDetection);
    
    console.log(`[NASA Fire] ${source}: ${mappedDetections.length} detections`);
    return mappedDetections;
  } catch (e) {
    console.warn(`[NASA Fire] ${source} fetch error:`, e?.message || e);
    return [];
  }
}

async function fetchNASAFireDetections() {
  // Fetch data from multiple satellites for comprehensive coverage
  const [modisData, viirsNoaaData, viirsSuomiData] = await Promise.allSettled([
    fetchNASAFireData(MODIS_FIRE_URL, 'MODIS'),
    fetchNASAFireData(VIIRS_FIRE_URL, 'VIIRS NOAA-20'),
    fetchNASAFireData(VIIRS_SUOMI_URL, 'VIIRS Suomi-NPP'),
  ]);
  
  const allDetections = [];
  
  if (modisData.status === 'fulfilled') {
    allDetections.push(...modisData.value);
  }
  
  if (viirsNoaaData.status === 'fulfilled') {
    allDetections.push(...viirsNoaaData.value);
  }
  
  if (viirsSuomiData.status === 'fulfilled') {
    allDetections.push(...viirsSuomiData.value);
  }
  
  // Sort by timestamp (most recent first)
  allDetections.sort((a, b) => b.timestamp - a.timestamp);
  
  // Deduplicate by location and time (within 5 minutes)
  const seen = new Set();
  const dedupedDetections = allDetections.filter(detection => {
    const timeBucket = Math.floor(detection.timestamp / 300000); // 5-minute buckets
    const key = `${detection.latitude.toFixed(2)}-${detection.longitude.toFixed(2)}-${timeBucket}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`[NASA Fire] Total: ${dedupedDetections.length} unique detections`);
  
  return {
    detections: dedupedDetections.slice(0, 2000), // Limit to 2000 most recent
    fetchedAt: Date.now(),
    sources: [
      modisData.status === 'fulfilled' ? 'MODIS' : null,
      viirsNoaaData.status === 'fulfilled' ? 'VIIRS NOAA-20' : null,
      viirsSuomiData.status === 'fulfilled' ? 'VIIRS Suomi-NPP' : null,
    ].filter(Boolean),
  };
}

function validate(data) {
  return Array.isArray(data?.detections) && data.detections.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.detections) ? data.detections.length : 0;
}

runSeed('environment', 'fire-detections-nasa', CANONICAL_KEY, fetchNASAFireDetections, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'nasa-firms-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 30,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});