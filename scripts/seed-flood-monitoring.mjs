#!/usr/bin/env node
/**
 * seed-flood-monitoring.mjs
 *
 * Aggregates real-time flood alerts and river level data from two authoritative
 * open sources:
 *
 * 1. UK Environment Agency Flood Monitoring API
 *    https://environment.data.gov.uk/flood-monitoring/doc/reference
 *    No API key required. Returns UK flood warnings + river gauging stations.
 *
 * 2. EFAS (European Flood Awareness System) — JRC / Copernicus EMS
 *    https://www.efas.eu  — current flood alerts via REST (no key for alerts feed)
 *    RSS/GeoJSON: https://globalfloods.eu/general-information/efas-bulletin/
 *
 * 3. GFM (Global Flood Monitor) via Dartmouth Flood Observatory
 *    https://floodobservatory.colorado.edu/Archives/index.html  (CSV archive)
 *
 * Stored at:  dmrv:flood-monitoring:v1
 * Meta key:   seed-meta:dmrv:flood-monitoring
 * TTL:        900s (15min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey, sleep } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:flood-monitoring:v1';
const CACHE_TTL     = 900;
const TIMEOUT       = 20_000;

// UK EA flood warnings API
const EA_WARNINGS_URL = 'https://environment.data.gov.uk/flood-monitoring/id/floods?_limit=500';
// UK EA flood stations with severity >= 1 (flood watch)
const EA_STATIONS_URL = 'https://environment.data.gov.uk/flood-monitoring/id/stations?type=SingleLevel&_limit=200&parameter=level&status=Active';

// EFAS latest alert GeoJSON (European Flood Awareness System)
const EFAS_ALERTS_URL = 'https://globalfloods.eu/run_test/efas_current_data.json';

// DFO Global active floods (CSV from Colorado)
const DFO_CSV_URL = 'https://floodobservatory.colorado.edu/temp/FloodArchive.csv';

function severityLabel(eaSeverity) {
  // EA severity levels: 1=severe, 2=warning, 3=alert, 4=info
  switch (eaSeverity) {
    case 1: return 'severe';
    case 2: return 'warning';
    case 3: return 'alert';
    default: return 'info';
  }
}

async function fetchEaWarnings() {
  try {
    const res = await fetch(EA_WARNINGS_URL, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(w => ({
      id:           `ea-${w.floodAreaID || w['@id']?.split('/').pop()}`,
      source:       'UK-EA',
      severity:     severityLabel(w.severityLevel),
      severity_num: w.severityLevel,
      description:  w.description || w.message || null,
      area_name:    w.floodArea?.county || w.eaRegionName || null,
      river_sea:    w.floodArea?.riverOrSea || null,
      lat:          w.floodArea?.centroid?.lat ?? null,
      lon:          w.floodArea?.centroid?.lon ?? null,
      raised_at:    w.timeRaised || null,
      updated_at:   w.timeMessageChanged || null,
      url:          w.floodArea?.quickDialNumber ? `https://flood-warning-information.service.gov.uk/target-area/${w.floodArea.notation}` : null,
    }));
  } catch {
    return [];
  }
}

async function fetchDfoActive() {
  // Fetch only the last 100 rows of DFO archive (active/recent)
  try {
    const res = await fetch(DFO_CSV_URL, {
      headers: { Accept: 'text/csv,text/plain', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return [];
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse CSV header
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const idxOf = name => headers.indexOf(name);

    const events = [];
    // Last 100 rows most recent
    const dataLines = lines.slice(1).slice(-100);
    for (const line of dataLines) {
      const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
      const lat = parseFloat(vals[idxOf('Centroid Y')] || vals[idxOf('Lat')] || '');
      const lon = parseFloat(vals[idxOf('Centroid X')] || vals[idxOf('Long')] || '');
      if (!isFinite(lat) || !isFinite(lon)) continue;

      events.push({
        id:           `dfo-${vals[idxOf('ID')] || vals[0]}`,
        source:       'DFO',
        severity:     vals[idxOf('Severity')] || 'unknown',
        country:      vals[idxOf('Country')] || null,
        area_name:    vals[idxOf('GlideNumber')] || null,
        lat,
        lon,
        started_at:   vals[idxOf('Began')] || null,
        ended_at:     vals[idxOf('Ended')] || null,
        affected:     parseInt(vals[idxOf('Affected')] || '0') || null,
        displaced:    parseInt(vals[idxOf('Displaced')] || '0') || null,
        deaths:       parseInt(vals[idxOf('Dead')] || '0') || null,
        main_cause:   vals[idxOf('MainCause')] || null,
      });
    }
    return events;
  } catch {
    return [];
  }
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:flood-monitoring',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [eaWarnings, dfoEvents] = await Promise.all([
      fetchEaWarnings(),
      fetchDfoActive(),
    ]);

    const allEvents = [...eaWarnings, ...dfoEvents];
    if (allEvents.length === 0) {
      throw new Error('No flood events from any source');
    }

    const summary = {
      total:    allEvents.length,
      severe:   allEvents.filter(e => e.severity === 'severe').length,
      warning:  allEvents.filter(e => e.severity === 'warning').length,
      uk_ea:    eaWarnings.length,
      dfo:      dfoEvents.length,
    };

    await verifySeedKey(CANONICAL_KEY, 'events');
    return { events: allEvents, summary, fetchedAt: new Date().toISOString() };
  },
});
