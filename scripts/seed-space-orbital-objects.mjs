#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const SPACE_TRACK_API = 'https://www.space-track.org/basicspacedata/query/class/tle_latest/NORAD_CAT_ID/';
const CELESTIAL_TRACKER_URL = 'https://celestrak.org/NORAD/elements/gp.php';
const CANONICAL_KEY = 'space:orbital-objects:v1';
const CACHE_TTL = 3600; // 1 hour - orbital data changes frequently

interface OrbitalObject {
  noradId: string;
  name: string;
  type: string;
  inclination: number;
  raan: number;
  eccentricity: number;
  argPerigee: number;
  meanAnomaly: number;
  meanMotion: number;
  epoch: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
}

interface TLEData {
  name: string;
  line1: string;
  line2: string;
  noradId: string;
  epoch: string;
}

interface SpaceTrackResponse {
  results: Array<{
   NORAD_CAT_ID: string;
   OBJECT_NAME: string;
   OBJECT_TYPE: string;
   INCLINATION: number;
   RA_OF_ASCENT: number;
   ECCENTRICITY: number;
   ARG_OF_PERICENTER: number;
   MEAN_ANOMALY: number;
   MEAN_MOTION: number;
   EPOCH: string;
  }>;
}

const SATELLITE_GROUPS = {
  STARLINK: ['44713', '44715', '44716', '44717', '44718', '44719', '44720', '44721'],
  ONEWEB: ['44300', '44301', '44302', '44303', '44304', '44305', '44306', '44307'],
  GPS: ['21961', '21962', '21963', '21964', '21965', '21966', '21967', '21968'],
  GLONASS: ['24794', '24795', '24796', '24797', '24798', '24799', '24800', '24801'],
  GALILEO: ['41118', '41119', '41120', '41121', '41122', '41123', '41124', '41125'],
  ISS: ['25544'],
};

function parseTLE(line1: string, line2: string): Partial<OrbitalObject> {
  // Simplified TLE parsing - extract basic orbital elements
  const inclination = parseFloat(line1.substring(8, 16));
  const raan = parseFloat(line1.substring(17, 25));
  const eccentricity = parseFloat('0.' + line1.substring(26, 33));
  const argPerigee = parseFloat(line1.substring(34, 42));
  const meanAnomaly = parseFloat(line1.substring(43, 51));
  const meanMotion = parseFloat(line1.substring(52, 63));
  
  return {
    inclination,
    raan,
    eccentricity,
    argPerigee,
    meanAnomaly,
    meanMotion,
  };
}

function calculatePosition(elements: Partial<OrbitalObject>): {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
} {
  // Simplified position calculation for demonstration
  // In practice, you'd use SGP4/SDP4 algorithms
  const now = Date.now();
  const epoch = new Date(elements.epoch || now);
  const timeDiff = (now - epoch.getTime()) / 1000; // seconds since epoch
  
  // Simplified circular orbit approximation
  const period = 2 * Math.PI / (elements.meanMotion || 0.001);
  const meanAnomaly = (elements.meanAnomaly || 0) + (2 * Math.PI * timeDiff / period);
  
  // Approximate position (simplified)
  const r = (elements.eccentricity || 0) + 6371; // Earth radius + altitude approximation
  const lat = (elements.inclination || 0) * Math.sin(meanAnomaly);
  const lon = (elements.raan || 0) + meanAnomaly;
  
  return {
    latitude: lat * 180 / Math.PI,
    longitude: lon * 180 / Math.PI,
    altitude: r - 6371, // altitude above Earth surface
    velocity: elements.meanMotion || 0,
  };
}

async function fetchSpaceTrackData() {
  try {
    // This would require authentication in practice
    // For demonstration, we'll use a simplified approach
    const allObjects: OrbitalObject[] = [];
    
    // Fetch TLE data for different satellite groups
    for (const [groupName, noradIds] of Object.entries(SATELLITE_GROUPS)) {
      for (const noradId of noradIds.slice(0, 5)) { // Limit to 5 per group for demo
        try {
          const url = `${CELESTIAL_TRACKER_URL}?GROUP=${groupName}&FORMAT=tle`;
          const resp = await fetch(url, {
            headers: { Accept: 'text/plain', 'User-Agent': CHROME_UA },
            signal: AbortSignal.timeout(15000),
          });
          
          if (resp.ok) {
            const tleData = await resp.text();
            const lines = tleData.trim().split('\n');
            
            if (lines.length >= 2) {
              const tle: TLEData = {
                name: `${groupName}-${noradId}`,
                line1: lines[0],
                line2: lines[1],
                noradId,
                epoch: new Date().toISOString(),
              };
              
              const elements = parseTLE(tle.line1, tle.line2);
              const position = calculatePosition(elements);
              
              allObjects.push({
                noradId: tle.noradId,
                name: tle.name,
                type: groupName,
                ...elements,
                epoch: tle.epoch,
                ...position,
              });
            }
          }
        } catch (e) {
          console.warn(`[SpaceTrack] ${groupName} fetch error:`, e?.message || e);
        }
      }
    }
    
    console.log(`[SpaceTrack] Fetched ${allObjects.length} orbital objects`);
    return allObjects;
  } catch (e) {
    console.warn('[SpaceTrack] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchOrbitalData() {
  const orbitalObjects = await fetchSpaceTrackData();
  
  console.log(`[Orbital] Total: ${orbitalObjects.length} objects`);
  
  return {
    objects: orbitalObjects,
    fetchedAt: Date.now(),
    groups: Object.keys(SATELLITE_GROUPS),
  };
}

function validate(data) {
  return Array.isArray(data?.objects) && data.objects.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.objects) ? data.objects.length : 0;
}

runSeed('space', 'orbital-objects', CANONICAL_KEY, fetchOrbitalData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'celestrak-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 30,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});