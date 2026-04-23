#!/usr/bin/env node
/**
 * seed-greynoise.mjs
 *
 * Fetches mass-scanner and background internet noise intelligence from
 * GreyNoise Community API.
 * https://docs.greynoise.io/reference/community-api
 *
 * Community tier: IP lookups are free; GNQL trend queries available.
 * API key: optional for community lookups (GREYNOISE_API_KEY env var).
 *
 * Supplements existing cyber threats (FeodoTracker, URLhaus, OTX) with
 * a mass-scanner / benign-noise perspective — helping distinguish
 * targeted attacks from background internet noise.
 *
 * Stored at:  dmrv:greynoise:v1
 * Meta key:   seed-meta:dmrv:greynoise
 * TTL:        3600s (1h)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY  = 'dmrv:greynoise:v1';
const CACHE_TTL      = 3600;
const FETCH_TIMEOUT  = 15_000;
const API_KEY        = process.env.GREYNOISE_API_KEY || '';

// GreyNoise GNQL search — returns IPs classified as noise/mass scanners
// Quick endpoint returns stats without per-IP details (no key required for community stats)
const NOISE_STATS_URL = 'https://api.greynoise.io/v2/meta/metadata';
const TRENDS_URL      = 'https://api.greynoise.io/v2/experimental/gnql/stats?query=last_seen:1d';

// Top attacked ports / CVE trends via community GNQL
const TOP_TAGS_URL    = 'https://api.greynoise.io/v2/meta/metadata';

function buildHeaders() {
  const h = {
    Accept: 'application/json',
    'User-Agent': CHROME_UA,
  };
  if (API_KEY) h['key'] = API_KEY;
  return h;
}

async function fetchMetadata() {
  try {
    const res = await fetch(NOISE_STATS_URL, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchTrends() {
  if (!API_KEY) return null; // GNQL stats require key
  try {
    const res = await fetch(TRENDS_URL, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Fetch top scanners from OTX as a fallback for greynoise trend data
async function fetchOtxMassScanners() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const url = `https://otx.alienvault.com/api/v1/indicators/export?type=IPv4&modified_since=${since}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results || []).slice(0, 200).map(r => ({
      ip:           r.indicator,
      country:      r.country || null,
      tags:         r.tags || [],
      type:         'mass_scanner',
      last_seen:    r.modified || null,
    }));
  } catch {
    return [];
  }
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:greynoise',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    const [metadata, trends, fallbackIps] = await Promise.all([
      fetchMetadata(),
      fetchTrends(),
      API_KEY ? Promise.resolve([]) : fetchOtxMassScanners(),
    ]);

    const scanners = fallbackIps;
    const stats = {
      has_api_key:      !!API_KEY,
      noise_ips_today:  metadata?.noise_ip_count_today || null,
      benign_ips_today: metadata?.benign_ip_count_today || null,
      total_noise:      metadata?.noise_ip_count || null,
      sources:          API_KEY ? ['greynoise-api'] : ['otx-fallback'],
    };

    if (trends?.buckets) {
      stats.top_tags    = (trends.buckets.tags || []).slice(0, 20);
      stats.top_ports   = (trends.buckets.destination_port || []).slice(0, 20);
      stats.top_asns    = (trends.buckets.asn || []).slice(0, 10);
      stats.top_countries = (trends.buckets.country_code || []).slice(0, 20);
    }

    await verifySeedKey(CANONICAL_KEY, 'stats');
    return { stats, scanners, fetchedAt: new Date().toISOString() };
  },
});
