#!/usr/bin/env node
/**
 * Health check + warm-ping for resilience country scores. Reads the static
 * index, checks how many countries have cached scores, and warms any missing
 * ones by calling the Vercel score endpoint in batches of 10.
 *
 * Runs every 5 hours via Railway cron (slightly inside the 6-hour score cache
 * TTL to keep caches warm). Does NOT write rankings (the Vercel ranking
 * handler owns that with proper greyedOut split).
 *
 * The warm-ping step requires WORLDMONITOR_API_KEY in env. When cache keys are
 * bumped (formula change), this prevents 222 countries from needing on-demand
 * warming, which can hit Vercel Edge timeout limits.
 */

import {
  getRedisCredentials,
  loadEnvFile,
  logSeedResult,
} from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

export const RESILIENCE_SCORE_CACHE_PREFIX = 'resilience:score:v6:';
export const RESILIENCE_RANKING_CACHE_KEY = 'resilience:ranking:v6';
export const RESILIENCE_RANKING_CACHE_TTL_SECONDS = 6 * 60 * 60; // kept for test parity — ranking write owned by Vercel handler
export const RESILIENCE_STATIC_INDEX_KEY = 'resilience:static:index:v1';

async function redisGetJson(url, token, key) {
  const resp = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data?.result) return null;
  try { return JSON.parse(data.result); } catch { return null; }
}

async function redisPipeline(url, token, commands) {
  const resp = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Redis pipeline HTTP ${resp.status} — ${text.slice(0, 200)}`);
  }
  return resp.json();
}

async function seedResilienceScores() {
  const { url, token } = getRedisCredentials();

  const index = await redisGetJson(url, token, RESILIENCE_STATIC_INDEX_KEY);
  const countryCodes = (index?.countries ?? [])
    .map((c) => String(c || '').trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));

  if (countryCodes.length === 0) {
    console.warn('[resilience-scores] Static index is empty — has seed-resilience-static run this year?');
    return { skipped: true, reason: 'no_index' };
  }

  console.log(`[resilience-scores] Reading cached scores for ${countryCodes.length} countries...`);

  const getCommands = countryCodes.map((c) => ['GET', `${RESILIENCE_SCORE_CACHE_PREFIX}${c}`]);
  const results = await redisPipeline(url, token, getCommands);

  const missing = [];
  let scored = 0;
  for (let i = 0; i < countryCodes.length; i++) {
    const raw = results[i]?.result;
    if (typeof raw === 'string') {
      try { JSON.parse(raw); scored++; } catch { missing.push(countryCodes[i]); }
    } else {
      missing.push(countryCodes[i]);
    }
  }

  console.log(`[resilience-scores] ${scored}/${countryCodes.length} countries have cached scores`);

  if (missing.length > 0) {
    const API_BASE = process.env.API_BASE_URL || 'https://api.worldmonitor.app';
    const WM_KEY = process.env.WORLDMONITOR_API_KEY || '';
    const CHROME_UA = 'Mozilla/5.0 (compatible; WorldMonitor-Seed/1.0)';
    const BATCH_SIZE = 10;
    const WARM_TIMEOUT_MS = 15_000;

    if (WM_KEY) {
      console.log(`  Warming ${missing.length} missing scores via Vercel API...`);
      let warmed = 0;
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch.map(async (cc) => {
          const warmUrl = `${API_BASE}/api/resilience/v1/get-resilience-score?countryCode=${cc}`;
          const resp = await fetch(warmUrl, {
            headers: { 'User-Agent': CHROME_UA, 'X-WorldMonitor-Key': WM_KEY },
            signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return cc;
        }));
        warmed += batchResults.filter((r) => r.status === 'fulfilled').length;
      }
      console.log(`  Warmed: ${warmed}/${missing.length} scores`);
      scored += warmed;
    } else {
      console.log(`  ${missing.length} scores missing but WORLDMONITOR_API_KEY not set — skipping warm-ping`);
    }
  }

  return { skipped: false, recordCount: scored, total: countryCodes.length };
}

async function main() {
  const startedAt = Date.now();
  const result = await seedResilienceScores();
  logSeedResult('resilience:scores', result.recordCount ?? 0, Date.now() - startedAt, {
    skipped: Boolean(result.skipped),
    ...(result.total != null && { total: result.total }),
    ...(result.reason != null && { reason: result.reason }),
  });
}

if (process.argv[1]?.endsWith('seed-resilience-scores.mjs')) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FATAL: ${message}`);
    process.exit(1);
  });
}
