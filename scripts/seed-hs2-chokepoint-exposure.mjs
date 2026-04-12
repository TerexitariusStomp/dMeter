#!/usr/bin/env node

// @ts-check

import { createRequire } from 'node:module';
import {
  acquireLockSafely,
  extendExistingTtl,
  getRedisCredentials,
  loadEnvFile,
  logSeedResult,
  releaseLock,
} from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

// ── Constants ─────────────────────────────────────────────────────────────────

/** @type {string} */
export const META_KEY = 'seed-meta:supply_chain:chokepoint-exposure';
/** @type {string} */
export const KEY_PREFIX = 'supply-chain:exposure:';
/** @type {number} */
export const TTL_SECONDS = 172800; // 48h — 2× daily cron interval
/** @type {string} */
const COMTRADE_KEY_PREFIX = 'comtrade:bilateral-hs4:';
const LOCK_DOMAIN = 'supply_chain:chokepoint-exposure';
const LOCK_TTL_MS = 5 * 60 * 1000;

// Top 10 HS2 chapters by global trade volume and strategic importance.
const HS2_CODES = [
  '27', // Mineral Fuels (energy)
  '84', // Machinery & Mechanical Appliances
  '85', // Electrical Machinery & Electronics
  '87', // Vehicles
  '30', // Pharmaceuticals
  '72', // Iron & Steel
  '39', // Plastics
  '29', // Organic Chemicals
  '10', // Cereals (food security)
  '62', // Apparel (textiles)
];

// Lightweight copy of the chokepoint registry fields needed for exposure computation.
// Kept in sync with src/config/chokepoint-registry.ts — update both together.
/** @type {Array<{id: string, displayName: string, routeIds: string[], shockModelSupported: boolean}>} */
const CHOKEPOINT_REGISTRY = [
  { id: 'suez',            displayName: 'Suez Canal',            shockModelSupported: true,  routeIds: ['china-europe-suez','china-us-east-suez','gulf-europe-oil','qatar-europe-lng','singapore-med','india-europe'] },
  { id: 'malacca_strait',  displayName: 'Strait of Malacca',     shockModelSupported: true,  routeIds: ['china-europe-suez','china-us-east-suez','gulf-asia-oil','qatar-asia-lng','india-se-asia','china-africa','cpec-route'] },
  { id: 'hormuz_strait',   displayName: 'Strait of Hormuz',      shockModelSupported: true,  routeIds: ['gulf-europe-oil','gulf-asia-oil','qatar-europe-lng','qatar-asia-lng','gulf-americas-cape'] },
  { id: 'bab_el_mandeb',   displayName: 'Bab el-Mandeb',         shockModelSupported: true,  routeIds: ['china-europe-suez','china-us-east-suez','gulf-europe-oil','qatar-europe-lng','singapore-med','india-europe'] },
  { id: 'panama',          displayName: 'Panama Canal',          shockModelSupported: false, routeIds: ['china-us-east-panama','panama-transit'] },
  { id: 'taiwan_strait',   displayName: 'Taiwan Strait',         shockModelSupported: false, routeIds: ['china-us-west','intra-asia-container'] },
  { id: 'cape_of_good_hope', displayName: 'Cape of Good Hope',   shockModelSupported: false, routeIds: ['brazil-china-bulk','gulf-americas-cape','asia-europe-cape'] },
  { id: 'gibraltar',       displayName: 'Strait of Gibraltar',   shockModelSupported: false, routeIds: ['gulf-europe-oil','singapore-med','india-europe','asia-europe-cape'] },
  { id: 'bosphorus',       displayName: 'Bosporus Strait',       shockModelSupported: false, routeIds: ['russia-med-oil'] },
  { id: 'korea_strait',    displayName: 'Korea Strait',          shockModelSupported: false, routeIds: [] },
  { id: 'dover_strait',    displayName: 'Dover Strait',          shockModelSupported: false, routeIds: [] },
  { id: 'kerch_strait',    displayName: 'Kerch Strait',          shockModelSupported: false, routeIds: [] },
  { id: 'lombok_strait',   displayName: 'Lombok Strait',         shockModelSupported: false, routeIds: [] },
];

// ── HS4 → HS2 mapping (derived from seed-comtrade-bilateral-hs4.mjs HS4_CODES) ──

/** @type {Record<string, string>} */
const HS4_TO_HS2 = {
  '2709': '27', '2711': '27', '2710': '27',
  '8542': '85', '8517': '85',
  '8703': '87', '8704': '87', '8708': '87',
  '3004': '30',
  '7108': '71', '7601': '76', '7202': '72',
  '3901': '39', '2902': '29',
  '1001': '10', '1201': '12',
  '6204': '62', '0203': '02',
  '8471': '84', '8411': '84',
};

// ── HS2 → Cargo type mapping (matches get-route-explorer-lane.ts pattern) ────

/** @type {Record<string, string>} */
const HS2_CARGO_TYPE = {
  '27': 'energy',
  '84': 'container',
  '85': 'container',
  '87': 'container',
  '30': 'container',
  '72': 'bulk',
  '39': 'container',
  '29': 'container',
  '10': 'bulk',
  '62': 'container',
};

/** @type {Record<string, string>} */
const CARGO_TO_ROUTE_CATEGORY = {
  container: 'container',
  energy: 'energy',
  bulk: 'bulk',
};

// ── Lightweight TRADE_ROUTES waypoints (kept in sync with src/config/trade-routes.ts) ──

/** @type {Array<{id: string, category: string, waypoints: string[]}>} */
const TRADE_ROUTES = [
  { id: 'china-europe-suez', category: 'container', waypoints: ['malacca_strait', 'bab_el_mandeb', 'suez'] },
  { id: 'china-us-west', category: 'container', waypoints: ['taiwan_strait'] },
  { id: 'china-us-east-suez', category: 'container', waypoints: ['malacca_strait', 'bab_el_mandeb', 'suez'] },
  { id: 'china-us-east-panama', category: 'container', waypoints: ['panama'] },
  { id: 'gulf-europe-oil', category: 'energy', waypoints: ['hormuz_strait', 'bab_el_mandeb', 'suez', 'gibraltar'] },
  { id: 'gulf-asia-oil', category: 'energy', waypoints: ['hormuz_strait', 'malacca_strait'] },
  { id: 'qatar-europe-lng', category: 'energy', waypoints: ['hormuz_strait', 'bab_el_mandeb', 'suez'] },
  { id: 'qatar-asia-lng', category: 'energy', waypoints: ['hormuz_strait', 'malacca_strait'] },
  { id: 'us-europe-lng', category: 'energy', waypoints: [] },
  { id: 'russia-med-oil', category: 'energy', waypoints: ['bosphorus'] },
  { id: 'intra-asia-container', category: 'container', waypoints: ['taiwan_strait'] },
  { id: 'singapore-med', category: 'container', waypoints: ['bab_el_mandeb', 'suez', 'gibraltar'] },
  { id: 'brazil-china-bulk', category: 'bulk', waypoints: ['cape_of_good_hope'] },
  { id: 'gulf-americas-cape', category: 'energy', waypoints: ['hormuz_strait', 'cape_of_good_hope'] },
  { id: 'asia-europe-cape', category: 'container', waypoints: ['cape_of_good_hope', 'gibraltar'] },
  { id: 'india-europe', category: 'container', waypoints: ['bab_el_mandeb', 'suez', 'gibraltar'] },
  { id: 'india-se-asia', category: 'container', waypoints: ['malacca_strait'] },
  { id: 'china-africa', category: 'container', waypoints: ['malacca_strait'] },
  { id: 'cpec-route', category: 'container', waypoints: ['malacca_strait'] },
  { id: 'panama-transit', category: 'container', waypoints: ['panama'] },
  { id: 'transatlantic', category: 'container', waypoints: [] },
];

/** @type {Map<string, string[]>} */
const ROUTE_WAYPOINTS = new Map(TRADE_ROUTES.map(r => [r.id, r.waypoints]));

/** @type {Map<string, string>} */
const ROUTE_CATEGORY = new Map(TRADE_ROUTES.map(r => [r.id, r.category]));

// ── Load country-port-clusters ────────────────────────────────────────────────

const require = createRequire(import.meta.url);
/** @type {Record<string, {nearestRouteIds: string[], coastSide: string}>} */
const COUNTRY_PORT_CLUSTERS = require('./shared/country-port-clusters.json');

// ── Route selection helpers ───────────────────────────────────────────────────

/**
 * Find overlapping routes between exporter and importer clusters.
 * @param {string[]} exporterRoutes
 * @param {string[]} importerRoutes
 * @returns {string[]}
 */
function findOverlappingRoutes(exporterRoutes, importerRoutes) {
  const importerSet = new Set(importerRoutes);
  return exporterRoutes.filter(r => importerSet.has(r));
}

/**
 * Pick the best route for a given cargo type from available routes.
 * Prefers routes matching the cargo category (mirrors get-route-explorer-lane.ts:78).
 * Uses exporter routes when no overlap exists, since exporter corridors determine
 * which chokepoints trade flows through regardless of specific destination.
 * @param {string[]} exporterRoutes
 * @param {string[]} importerRoutes
 * @param {string} cargoType
 * @returns {string | null}
 */
function pickPrimaryRoute(exporterRoutes, importerRoutes, cargoType) {
  if (exporterRoutes.length === 0) return null;
  const preferredCategory = CARGO_TO_ROUTE_CATEGORY[cargoType] ?? 'container';

  /**
   * Sort routes by: (1) has waypoints (mandatory for exposure contribution),
   * (2) matches preferred cargo category. Routes without waypoints (e.g. transatlantic)
   * produce zero exposure and must be deprioritized.
   * @param {string[]} routes
   * @returns {string[]}
   */
  const rankRoutes = (routes) => [...routes].sort((a, b) => {
    const wpA = (ROUTE_WAYPOINTS.get(a) ?? []).length > 0 ? 0 : 1;
    const wpB = (ROUTE_WAYPOINTS.get(b) ?? []).length > 0 ? 0 : 1;
    if (wpA !== wpB) return wpA - wpB;
    const catA = (ROUTE_CATEGORY.get(a) ?? '') === preferredCategory ? 0 : 1;
    const catB = (ROUTE_CATEGORY.get(b) ?? '') === preferredCategory ? 0 : 1;
    return catA - catB;
  });

  // First: try shared routes (most precise)
  const shared = findOverlappingRoutes(exporterRoutes, importerRoutes);
  if (shared.length > 0) {
    const ranked = rankRoutes(shared);
    if ((ROUTE_WAYPOINTS.get(ranked[0]) ?? []).length > 0) return ranked[0];
  }

  // Fallback: use exporter's routes filtered by cargo type + waypoints.
  const cargoWithWp = exporterRoutes.filter(
    r => ROUTE_CATEGORY.get(r) === preferredCategory && (ROUTE_WAYPOINTS.get(r) ?? []).length > 0,
  );
  if (cargoWithWp.length > 0) return cargoWithWp[0];

  // Last resort: any exporter route with waypoints
  const withWaypoints = exporterRoutes.filter(r => (ROUTE_WAYPOINTS.get(r) ?? []).length > 0);
  return withWaypoints[0] ?? null;
}

// ── Exposure computation ──────────────────────────────────────────────────────

/**
 * Country-level route-based exposure (legacy fallback).
 * @param {string[]} nearestRouteIds
 * @param {string} coastSide
 * @param {string} hs2
 * @returns {{ exposures: object[], primaryChokepointId: string, vulnerabilityIndex: number }}
 */
export function computeCountryLevelExposure(nearestRouteIds, coastSide, hs2) {
  const isEnergy = hs2 === '27';
  const routeSet = new Set(nearestRouteIds);

  const entries = CHOKEPOINT_REGISTRY.map(cp => {
    const overlap = cp.routeIds.filter(r => routeSet.has(r)).length;
    const maxRoutes = Math.max(cp.routeIds.length, 1);
    let score = (overlap / maxRoutes) * 100;
    if (isEnergy && cp.shockModelSupported) score = Math.min(score * 1.5, 100);
    return {
      chokepointId: cp.id,
      chokepointName: cp.displayName,
      exposureScore: Math.round(score * 10) / 10,
      shockSupported: cp.shockModelSupported,
    };
  }).sort((a, b) => b.exposureScore - a.exposureScore);

  if (entries[0]) entries[0] = { ...entries[0], coastSide };

  const weights = [0.5, 0.3, 0.2];
  const vulnerabilityIndex = Math.round(
    entries.slice(0, 3).reduce((sum, e, i) => sum + e.exposureScore * weights[i], 0) * 10,
  ) / 10;

  return {
    exposures: entries,
    primaryChokepointId: entries[0]?.chokepointId ?? '',
    vulnerabilityIndex,
  };
}

/**
 * @typedef {{ hs4: string, description: string, totalValue: number, topExporters: Array<{partnerCode: number, partnerIso2: string, value: number, share: number}>, year: number }} ComtradeProduct
 */

/**
 * Flow-weighted chokepoint exposure using Comtrade bilateral trade data.
 * @param {string} iso2 - Importer country
 * @param {string} hs2 - HS2 chapter code
 * @param {ComtradeProduct[]} comtradeProducts - All products for this country
 * @param {{nearestRouteIds: string[], coastSide: string}} importerCluster
 * @returns {{ exposures: object[], primaryChokepointId: string, vulnerabilityIndex: number }}
 */
export function computeFlowWeightedExposure(iso2, hs2, comtradeProducts, importerCluster) {
  const sectorProducts = comtradeProducts.filter(p => HS4_TO_HS2[p.hs4] === hs2);
  if (sectorProducts.length === 0) {
    return { exposures: [], primaryChokepointId: '', vulnerabilityIndex: 0 };
  }

  const sectorTotalValue = sectorProducts.reduce((s, p) => s + p.totalValue, 0);
  if (sectorTotalValue <= 0) {
    return { exposures: [], primaryChokepointId: '', vulnerabilityIndex: 0 };
  }

  const cargoType = HS2_CARGO_TYPE[hs2] ?? 'container';
  const isEnergy = hs2 === '27';

  /** @type {Map<string, number>} chokepointId → accumulated value */
  const cpValue = new Map();
  let anyRouteFound = false;

  for (const product of sectorProducts) {
    for (const exporter of product.topExporters) {
      if (!exporter.partnerIso2 || exporter.partnerIso2.length !== 2) continue;
      const exporterEntry = COUNTRY_PORT_CLUSTERS[exporter.partnerIso2];
      if (!exporterEntry || typeof exporterEntry === 'string') continue;

      const primaryRoute = pickPrimaryRoute(
        exporterEntry.nearestRouteIds ?? [],
        importerCluster.nearestRouteIds ?? [],
        cargoType,
      );
      if (!primaryRoute) continue;

      anyRouteFound = true;
      const waypoints = ROUTE_WAYPOINTS.get(primaryRoute) ?? [];
      for (const cpId of waypoints) {
        cpValue.set(cpId, (cpValue.get(cpId) ?? 0) + exporter.value);
      }
    }
  }

  if (!anyRouteFound) {
    return { exposures: [], primaryChokepointId: '', vulnerabilityIndex: 0 };
  }

  const entries = CHOKEPOINT_REGISTRY.map(cp => {
    let score = 100 * (cpValue.get(cp.id) ?? 0) / sectorTotalValue;
    if (isEnergy && cp.shockModelSupported) score = Math.min(score * 1.5, 100);
    score = Math.min(score, 100);
    return {
      chokepointId: cp.id,
      chokepointName: cp.displayName,
      exposureScore: Math.round(score * 10) / 10,
      coastSide: '',
      shockSupported: cp.shockModelSupported,
    };
  }).sort((a, b) => b.exposureScore - a.exposureScore);

  if (entries[0]) entries[0] = { ...entries[0], coastSide: importerCluster.coastSide ?? '' };

  const weights = [0.5, 0.3, 0.2];
  const vulnerabilityIndex = Math.round(
    entries.slice(0, 3).reduce((sum, e, i) => sum + e.exposureScore * weights[i], 0) * 10,
  ) / 10;

  return {
    exposures: entries,
    primaryChokepointId: entries[0]?.chokepointId ?? '',
    vulnerabilityIndex,
  };
}

// ── Redis pipeline helper ─────────────────────────────────────────────────────

/**
 * @param {Array<string[]>} commands
 */
async function redisPipeline(commands) {
  const { url, token } = getRedisCredentials();
  const resp = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Redis pipeline failed: HTTP ${resp.status} — ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Batch-read Comtrade bilateral HS4 data for all countries from Redis.
 * @param {string[]} iso2List
 * @returns {Promise<Map<string, ComtradeProduct[]>>}
 */
async function loadComtradeData(iso2List) {
  const keys = iso2List.map(iso2 => `${COMTRADE_KEY_PREFIX}${iso2}:v1`);
  const { url, token } = getRedisCredentials();
  const commands = keys.map(k => ['GET', k]);

  const resp = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    console.warn(`[chokepoint-exposure] Comtrade MGET failed: HTTP ${resp.status}`);
    return new Map();
  }

  const results = await resp.json();
  /** @type {Map<string, ComtradeProduct[]>} */
  const map = new Map();
  for (let i = 0; i < iso2List.length; i++) {
    const raw = results[i]?.result;
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.products && Array.isArray(parsed.products)) {
        map.set(iso2List[i], parsed.products);
      }
    } catch { /* skip malformed */ }
  }
  return map;
}

export async function main() {
  const startedAt = Date.now();
  const runId = `${LOCK_DOMAIN}:${startedAt}`;
  const lock = await acquireLockSafely(LOCK_DOMAIN, runId, LOCK_TTL_MS, { label: LOCK_DOMAIN });

  if (lock.skipped) {
    const allKeys = Object.keys(COUNTRY_PORT_CLUSTERS)
      .filter(k => k !== '_comment' && k.length === 2)
      .flatMap(iso2 => HS2_CODES.map(hs2 => `${KEY_PREFIX}${iso2}:${hs2}:v2`));
    await extendExistingTtl([...allKeys, META_KEY], TTL_SECONDS)
      .catch(e => console.warn('[chokepoint-exposure] TTL extension (skipped) failed:', e.message));
    return;
  }
  if (!lock.locked) {
    console.log('[chokepoint-exposure] Lock held, skipping');
    return;
  }

  /** @param {number} count @param {string} [status] */
  const writeMeta = async (count, status = 'ok') => {
    const meta = JSON.stringify({ fetchedAt: Date.now(), recordCount: count, status });
    await redisPipeline([['SET', META_KEY, meta, 'EX', TTL_SECONDS * 3]])
      .catch(e => console.warn('[chokepoint-exposure] Failed to write seed-meta:', e.message));
  };

  try {
    const countries = Object.entries(COUNTRY_PORT_CLUSTERS).filter(
      ([k]) => k !== '_comment' && k.length === 2,
    );
    const iso2List = countries.map(([iso2]) => iso2);

    console.log(`[chokepoint-exposure] Loading Comtrade bilateral data for ${iso2List.length} countries...`);
    const comtradeMap = await loadComtradeData(iso2List);
    console.log(`[chokepoint-exposure] Comtrade data loaded for ${comtradeMap.size}/${iso2List.length} countries`);
    console.log(`[chokepoint-exposure] Computing exposure for ${countries.length} countries × ${HS2_CODES.length} HS2 code(s)...`);

    const commands = [];
    let writtenCount = 0;
    let flowWeightedCount = 0;
    let fallbackCount = 0;

    for (const hs2 of HS2_CODES) {
      for (const [iso2, cluster] of countries) {
        const comtradeProducts = comtradeMap.get(iso2);
        let result;

        if (comtradeProducts && comtradeProducts.length > 0) {
          result = computeFlowWeightedExposure(iso2, hs2, comtradeProducts, cluster);
          if (result.exposures.length > 0) {
            flowWeightedCount++;
          } else {
            result = computeCountryLevelExposure(cluster.nearestRouteIds ?? [], cluster.coastSide ?? '', hs2);
            fallbackCount++;
          }
        } else {
          result = computeCountryLevelExposure(cluster.nearestRouteIds ?? [], cluster.coastSide ?? '', hs2);
          fallbackCount++;
        }

        const payload = JSON.stringify({
          iso2,
          hs2,
          ...result,
          fetchedAt: new Date().toISOString(),
        });
        commands.push(['SET', `${KEY_PREFIX}${iso2}:${hs2}:v2`, payload, 'EX', TTL_SECONDS]);
        writtenCount++;
      }
    }

    commands.push([
      'SET', META_KEY,
      JSON.stringify({ fetchedAt: Date.now(), recordCount: writtenCount, status: 'ok' }),
      'EX', TTL_SECONDS * 3,
    ]);

    const results = await redisPipeline(commands);
    const failures = results.filter(r => r?.error || r?.result === 'ERR');
    if (failures.length > 0) {
      throw new Error(`Redis pipeline: ${failures.length}/${commands.length} commands failed`);
    }

    logSeedResult('supply_chain:chokepoint-exposure', writtenCount, Date.now() - startedAt, {
      countries: countries.length,
      hs2Codes: HS2_CODES,
      flowWeighted: flowWeightedCount,
      fallback: fallbackCount,
      ttlH: TTL_SECONDS / 3600,
    });
    console.log(`[chokepoint-exposure] Seeded ${writtenCount} v2 keys (${flowWeightedCount} flow-weighted, ${fallbackCount} fallback)`);
  } catch (err) {
    console.error('[chokepoint-exposure] Seed failed:', err.message || err);
    const existingKeys = Object.keys(COUNTRY_PORT_CLUSTERS)
      .filter(k => k !== '_comment' && k.length === 2)
      .flatMap(iso2 => HS2_CODES.map(hs2 => `${KEY_PREFIX}${iso2}:${hs2}:v2`));
    await extendExistingTtl([...existingKeys, META_KEY], TTL_SECONDS)
      .catch(e => console.warn('[chokepoint-exposure] TTL extension failed:', e.message));
    await writeMeta(0, 'error');
    throw err;
  } finally {
    await releaseLock(LOCK_DOMAIN, runId);
  }
}

const isMain = process.argv[1]?.endsWith('seed-hs2-chokepoint-exposure.mjs');
if (isMain) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
