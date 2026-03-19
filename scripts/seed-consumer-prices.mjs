#!/usr/bin/env node

/**
 * Seed script: fetches compact snapshot payloads from consumer-prices-core
 * and writes them to Upstash Redis for WorldMonitor bootstrap hydration.
 *
 * Run manually: node scripts/seed-consumer-prices.mjs
 * Deployed as: Railway cron service (same pattern as ais-relay loops)
 *
 * Memory: runSeed() calls process.exit(0) — use extraKeys for all keys.
 */

import { loadEnvFile, CHROME_UA, writeExtraKeyWithMeta } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const BASE_URL = process.env.CONSUMER_PRICES_CORE_BASE_URL;
const API_KEY = process.env.CONSUMER_PRICES_CORE_API_KEY;
const MARKET = process.env.CONSUMER_PRICES_DEFAULT_MARKET || 'ae';
const BASKET = 'essentials-ae';

if (!BASE_URL) {
  console.warn('[consumer-prices] CONSUMER_PRICES_CORE_BASE_URL not set — writing empty placeholders');
}

async function fetchSnapshot(path) {
  if (!BASE_URL) return null;
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': CHROME_UA,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      console.warn(`  [consumer-prices] ${path} HTTP ${resp.status}`);
      return null;
    }
    return resp.json();
  } catch (err) {
    console.warn(`  [consumer-prices] ${path} error: ${err.message}`);
    return null;
  }
}

function emptyOverview(market) {
  return {
    marketCode: market,
    asOf: Date.now(),
    currencyCode: 'AED',
    essentialsIndex: 0,
    valueBasketIndex: 0,
    wowPct: 0,
    momPct: 0,
    retailerSpreadPct: 0,
    coveragePct: 0,
    freshnessLagMin: 0,
    topCategories: [],
    upstreamUnavailable: true,
  };
}

function emptyMovers(market, range) {
  return { marketCode: market, asOf: Date.now(), range, risers: [], fallers: [], upstreamUnavailable: true };
}

function emptySpread(market, basket) {
  return { marketCode: market, asOf: Date.now(), basketSlug: basket, currencyCode: 'AED', retailers: [], spreadPct: 0, upstreamUnavailable: true };
}

function emptyFreshness(market) {
  return { marketCode: market, asOf: Date.now(), retailers: [], overallFreshnessMin: 0, stalledCount: 0, upstreamUnavailable: true };
}

async function run() {
  console.log(`[consumer-prices] seeding market=${MARKET} basket=${BASKET}`);

  const TTL_OVERVIEW   = 1800;  // 30 min
  const TTL_MOVERS     = 1800;  // 30 min
  const TTL_SPREAD     = 3600;  // 60 min
  const TTL_FRESHNESS  = 600;   // 10 min

  // Fetch all snapshots in parallel
  const [overview, movers30d, movers7d, spread, freshness] = await Promise.all([
    fetchSnapshot(`/wm/consumer-prices/v1/overview?market=${MARKET}`),
    fetchSnapshot(`/wm/consumer-prices/v1/movers?market=${MARKET}&days=30`),
    fetchSnapshot(`/wm/consumer-prices/v1/movers?market=${MARKET}&days=7`),
    fetchSnapshot(`/wm/consumer-prices/v1/retailer-spread?market=${MARKET}&basket=${BASKET}`),
    fetchSnapshot(`/wm/consumer-prices/v1/freshness?market=${MARKET}`),
  ]);

  const writes = [
    {
      key: `consumer-prices:overview:${MARKET}`,
      data: overview ?? emptyOverview(MARKET),
      ttl: TTL_OVERVIEW,
      metaKey: `seed-meta:consumer-prices:overview:${MARKET}`,
    },
    {
      key: `consumer-prices:movers:${MARKET}:30d`,
      data: movers30d ?? emptyMovers(MARKET, '30d'),
      ttl: TTL_MOVERS,
      metaKey: `seed-meta:consumer-prices:movers:${MARKET}:30d`,
    },
    {
      key: `consumer-prices:movers:${MARKET}:7d`,
      data: movers7d ?? emptyMovers(MARKET, '7d'),
      ttl: TTL_MOVERS,
      metaKey: `seed-meta:consumer-prices:movers:${MARKET}:7d`,
    },
    {
      key: `consumer-prices:retailer-spread:${MARKET}:${BASKET}`,
      data: spread ?? emptySpread(MARKET, BASKET),
      ttl: TTL_SPREAD,
      metaKey: `seed-meta:consumer-prices:spread:${MARKET}`,
    },
    {
      key: `consumer-prices:freshness:${MARKET}`,
      data: freshness ?? emptyFreshness(MARKET),
      ttl: TTL_FRESHNESS,
      metaKey: `seed-meta:consumer-prices:freshness:${MARKET}`,
    },
  ];

  let failed = 0;
  for (const { key, data, ttl, metaKey } of writes) {
    try {
      const recordCount = Array.isArray(data.retailers ?? data.categories ?? data.risers)
        ? (data.retailers ?? data.categories ?? data.risers ?? []).length
        : 1;
      await writeExtraKeyWithMeta(key, data, ttl, recordCount, metaKey);
      console.log(`  [consumer-prices] wrote ${key} (${recordCount} records)`);
    } catch (err) {
      console.error(`  [consumer-prices] failed ${key}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[consumer-prices] done. ${writes.length - failed}/${writes.length} keys written.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('[consumer-prices] seed failed:', err);
  process.exit(1);
});
