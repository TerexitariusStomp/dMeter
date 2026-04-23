#!/usr/bin/env node

import { loadEnvFile, runSeed, CHROME_UA, sleep } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'wildfire:fires:v1';
const FIRMS_SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];

// --- Conflict / strategic hotspots (existing) ---
const CONFLICT_REGIONS = {
  'Ukraine': '22,44,40,53',
  'Russia': '20,50,180,82',
  'Iran': '44,25,63,40',
  'Israel/Gaza': '34,29,36,34',
  'Syria': '35,32,42,37',
  'Taiwan': '119,21,123,26',
  'North Korea': '124,37,131,43',
  'Saudi Arabia': '34,16,56,32',
  'Turkey': '26,36,45,42',
};

// --- dMRV global wildfire / biomass burning regions ---
// Covering all major fire-prone biomes for full MRV coverage.
// Bounding boxes: w,s,e,n
const DMRV_REGIONS = {
  // South America (Amazon / Cerrado)
  'Amazon-Brazil':         '-73,-15,-45,5',
  'Cerrado-Brazil':        '-60,-25,-45,-10',
  'Bolivia-Chaco':         '-70,-25,-55,-15',
  // Africa (tropical savanna / fire season)
  'West-Africa':           '-18,0,15,20',
  'Central-Africa':        '10,-10,35,10',
  'Southern-Africa':       '15,-35,40,-10',
  'East-Africa':           '28,-12,42,5',
  // Southeast Asia (peat fires / land clearing)
  'Indonesia-Kalimantan':  '108,-5,120,5',
  'Indonesia-Sumatra':     '95,-6,109,6',
  'Southeast-Asia':        '95,5,140,25',
  // Australia
  'Australia-East':        '140,-40,155,-20',
  'Australia-West':        '112,-35,140,-20',
  // North America
  'Western-Canada':        '-140,48,-100,65',
  'Western-USA':           '-125,32,-100,49',
  'Alaska':                '-170,55,-135,72',
  // Southern Europe / Mediterranean
  'Mediterranean-Europe':  '-10,34,40,48',
  // Central Asia / Siberia
  'Siberia-West':          '60,50,100,70',
  'Siberia-East':          '100,50,160,70',
  // India / South Asia
  'India-Northwest':       '68,20,80,32',
};

// Combined: strategic + global biome coverage
const MONITORED_REGIONS = { ...CONFLICT_REGIONS, ...DMRV_REGIONS };

function mapConfidence(c) {
  switch ((c || '').toLowerCase()) {
    case 'h': return 'FIRE_CONFIDENCE_HIGH';
    case 'n': return 'FIRE_CONFIDENCE_NOMINAL';
    case 'l': return 'FIRE_CONFIDENCE_LOW';
    default: return 'FIRE_CONFIDENCE_UNSPECIFIED';
  }
}

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim());
    if (vals.length < headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx]; });
    results.push(row);
  }
  return results;
}

function parseDetectedAt(acqDate, acqTime) {
  const padded = (acqTime || '').padStart(4, '0');
  const hours = padded.slice(0, 2);
  const minutes = padded.slice(2);
  return new Date(`${acqDate}T${hours}:${minutes}:00Z`).getTime();
}

async function fetchRegionSource(apiKey, regionName, bbox, source) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bbox}/1`;
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'text/csv', 'User-Agent': CHROME_UA },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`FIRMS ${res.status} for ${regionName}/${source}`);
      return parseCSV(await res.text());
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await sleep(6_000); // match inter-call pacing so retry stays within FIRMS 10 req/min budget
    }
  }
  throw lastErr;
}

async function fetchAllRegions(apiKey) {
  const entries = Object.entries(MONITORED_REGIONS);
  const seen = new Set();
  const fireDetections = [];
  let fulfilled = 0;
  let failed = 0;

  for (const source of FIRMS_SOURCES) {
    for (const [regionName, bbox] of entries) {
      try {
        const rows = await fetchRegionSource(apiKey, regionName, bbox, source);
        fulfilled++;
        for (const row of rows) {
          const id = `${row.latitude ?? ''}-${row.longitude ?? ''}-${row.acq_date ?? ''}-${row.acq_time ?? ''}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const detectedAt = parseDetectedAt(row.acq_date || '', row.acq_time || '');
          const brightness = parseFloat(row.bright_ti4 ?? '0') || 0;
          const frp = parseFloat(row.frp ?? '0') || 0;
          fireDetections.push({
            id,
            location: {
              latitude: parseFloat(row.latitude ?? '0') || 0,
              longitude: parseFloat(row.longitude ?? '0') || 0,
            },
            brightness,
            frp,
            confidence: mapConfidence(row.confidence || ''),
            satellite: row.satellite || '',
            detectedAt,
            region: regionName,
            dayNight: row.daynight || '',
            possibleExplosion: frp > 80 && brightness > 380,
          });
        }
      } catch (err) {
        failed++;
        console.error(`  [FIRMS] ${source}/${regionName}: ${err.message || err}`);
      }
      await sleep(6_000); // FIRMS free tier: 10 req/min — 6s between calls stays safely under limit
    }
    console.log(`  ${source}: ${fireDetections.length} total (${fulfilled} ok, ${failed} failed)`);
  }

  return { fireDetections, pagination: undefined };
}

export function declareRecords(data) {
  return Array.isArray(data?.fireDetections) ? data.fireDetections.length : 0;
}

async function main() {
  const apiKey = process.env.NASA_FIRMS_API_KEY || process.env.FIRMS_API_KEY || '';
  if (!apiKey) {
    console.log('NASA_FIRMS_API_KEY not set — skipping fire detections seed');
    process.exit(0);
  }

  console.log('  FIRMS key configured');

  await runSeed('wildfire', 'fires', CANONICAL_KEY, () => fetchAllRegions(apiKey), {
    validateFn: (data) => Array.isArray(data?.fireDetections) && data.fireDetections.length > 0,
    ttlSeconds: 7200,
    lockTtlMs: 2_400_000, // 40 min — 27 slots × ~72s worst case (30s timeout + 6s backoff + 30s retry + 6s pace) ≈ 32.4 min; pad headroom. Next cron tick sees lock held and safely skips.
    sourceVersion: FIRMS_SOURCES.join('+'),
    declareRecords,
    schemaVersion: 1,
    maxStaleMin: 360,
  });
}

main().catch(err => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : ''; console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});
