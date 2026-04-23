#!/usr/bin/env node
/**
 * seed-gdacs.mjs
 *
 * GDACS — Global Disaster Alert and Coordination System (UN-OCHA / JRC)
 * Real-time alerts: Earthquakes, Tropical Cyclones, Floods, Volcanoes, Droughts, Tsunamis.
 * https://www.gdacs.org/gdacsapi/api/events
 * No API key required. CC BY 4.0 license.
 *
 * Ideal for dMRV: real-time cross-validation of natural hazard events globally.
 *
 * Stored at:  dmrv:gdacs:v1
 * Meta key:   seed-meta:dmrv:gdacs
 * TTL:        900s (15min — matches alert update frequency)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:gdacs:v1';
const CACHE_TTL     = 900;
const FETCH_TIMEOUT = 20_000;

const HEADERS = {
  Accept:       'application/json',
  'User-Agent': CHROME_UA,
};

const BASE = 'https://www.gdacs.org/gdacsapi/api/events';

const ALERT_COLORS = 'Orange,Red,Green';
const EVENT_TYPES  = 'EQ,TC,FL,VO,DR,TS';

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:gdacs',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    // Fetch current active alerts (Orange + Red = significant)
    const url = `${BASE}/geteventlist/SEARCH?eventlist=${EVENT_TYPES}&alertlevel=${ALERT_COLORS}&limit=100`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) throw new Error(`GDACS HTTP ${res.status}`);
    const data = await res.json();

    const features = data.features ?? [];
    const events = features.map(f => {
      const p = f.properties ?? {};
      return {
        id:          p.eventid,
        episode:     p.episodeid,
        type:        p.eventtype,  // EQ, TC, FL, VO, DR, TS
        name:        p.name,
        description: p.description?.replace(/<[^>]+>/g, '') ?? null,
        alert:       p.alertlevel,  // Green, Orange, Red
        glide:       p.glide,       // GLIDE number for cross-referencing
        lat:         f.geometry?.coordinates?.[1] ?? null,
        lon:         f.geometry?.coordinates?.[0] ?? null,
        from:        p.fromdate,
        to:          p.todate,
        population:  p.populationaffected ?? null,
        magnitude:   p.severitydata?.severity ?? null,
        url:         p.url?.report ?? null,
      };
    });

    // Summarize by type and alert level
    const byType = {};
    const byAlert = { Green: 0, Orange: 0, Red: 0 };
    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (e.alert in byAlert) byAlert[e.alert]++;
    }

    await verifySeedKey(CANONICAL_KEY, 'events');
    return {
      total:      events.length,
      by_type:    byType,
      by_alert:   byAlert,
      events,
      fetchedAt:  new Date().toISOString(),
    };
  },
});
