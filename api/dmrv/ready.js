import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';
import { jsonResponse } from '../_json-response.js';
import { redisPipeline } from '../_upstash-json.js';

export const config = { runtime: 'edge' };

const REQUIRED_DATASETS = [
  ['sensor-community', 'seed-meta:dmrv:sensor-community', 30],
  ['opensensemap', 'seed-meta:dmrv:opensensemap', 30],
  ['emsc-earthquakes', 'seed-meta:dmrv:emsc-earthquakes', 10],
  ['noaa-buoys', 'seed-meta:dmrv:noaa-buoys', 60],
  ['flood-monitoring', 'seed-meta:dmrv:flood-monitoring', 15],
  ['usgs-water', 'seed-meta:dmrv:usgs-water', 15],
  ['grid-status', 'seed-meta:dmrv:grid-status', 5],
  ['open-meteo', 'seed-meta:dmrv:open-meteo', 30],
  ['gdacs', 'seed-meta:dmrv:gdacs', 15],
  ['usgs-quakes', 'seed-meta:dmrv:usgs-quakes', 10],
];

const OPTIONAL_DATASETS = [
  ['greynoise', 'seed-meta:dmrv:greynoise', 60],
  ['uk-carbon', 'seed-meta:dmrv:uk-carbon', 30],
  ['danish-energi', 'seed-meta:dmrv:danish-energi', 30],
  ['gruenstrom', 'seed-meta:dmrv:gruenstrom', 60],
  ['opensky', 'seed-meta:dmrv:opensky', 10],
  ['noaa-ngdc', 'seed-meta:dmrv:noaa-ngdc', 60],
  ['uv-index', 'seed-meta:dmrv:uv-index', 60],
  ['pm25-lass', 'seed-meta:dmrv:pm25-lass', 30],
  ['openfema', 'seed-meta:dmrv:openfema', 60],
  ['open-charge', 'seed-meta:dmrv:open-charge', 120],
  ['luchtmeetnet', 'seed-meta:dmrv:luchtmeetnet', 30],
  ['energy-charts', 'seed-meta:dmrv:energy-charts', 15],
  ['copernicus-atmos', 'seed-meta:dmrv:copernicus-atmos', 60],
  ['aviationweather', 'seed-meta:dmrv:aviationweather', 10],
  ['rainviewer', 'seed-meta:dmrv:rainviewer', 10],
  ['purpleair', 'seed-meta:dmrv:purpleair', 30],
  ['currentuv', 'seed-meta:dmrv:currentuv', 60],
  ['gbif-biodiversity', 'seed-meta:dmrv:gbif-biodiversity', 360],
  ['obis-marine', 'seed-meta:dmrv:obis-marine', 360],
  ['opentopodata', 'seed-meta:dmrv:opentopodata', 1440],
  ['7timer-forecast', 'seed-meta:dmrv:7timer-forecast', 180],
  ['metno-forecast', 'seed-meta:dmrv:metno-forecast', 60],
  ['aare-river', 'seed-meta:dmrv:aare-river', 30],
  ['adresse-geocode', 'seed-meta:dmrv:adresse-geocode', 1440],
  ['api-status-check', 'seed-meta:dmrv:api-status-check', 30],
  ['nasa-open', 'seed-meta:dmrv:nasa-open', 360],
  ['noaa-nws-alerts', 'seed-meta:dmrv:noaa-nws-alerts', 15],
  ['nasa-power', 'seed-meta:dmrv:nasa-power', 360],
  ['open-notify-iss', 'seed-meta:dmrv:open-notify-iss', 5],
  ['open-elevation', 'seed-meta:dmrv:open-elevation', 1440],
  ['noaa-nws-forecast', 'seed-meta:dmrv:noaa-nws-forecast', 30],
  ['global-flood-api', 'seed-meta:dmrv:global-flood-api', 60],
  ['open-meteo-air-quality', 'seed-meta:dmrv:open-meteo-air-quality', 60],
  ['open-meteo-marine', 'seed-meta:dmrv:open-meteo-marine', 60],
  ['worms-marine-species', 'seed-meta:dmrv:worms-marine-species', 1440],
  ['tle-satellites', 'seed-meta:dmrv:tle-satellites', 360],
];

function datasetStatus(meta, intervalMin, now) {
  if (!meta || typeof meta !== 'object') return { status: 'missing', stale: true, ageMin: null };
  const fetchedAt = Number(meta.fetchedAt || 0);
  const ageMs = fetchedAt > 0 ? now - fetchedAt : Number.POSITIVE_INFINITY;
  const stale = !Number.isFinite(ageMs) || ageMs > (intervalMin * 2 * 60 * 1000) || meta.status === 'error';
  return {
    status: stale ? (meta.status === 'error' ? 'error' : 'stale') : 'ok',
    stale,
    ageMin: Number.isFinite(ageMs) ? Math.round(ageMs / 60000) : null,
    fetchedAt: fetchedAt || null,
    recordCount: meta.recordCount ?? null,
  };
}

async function fetchMeta(keys) {
  const pipeline = keys.map((k) => ['GET', k]);
  const data = await redisPipeline(pipeline, 4000);
  if (!data) throw new Error('Redis unavailable');
  const out = new Map();
  for (let i = 0; i < keys.length; i++) {
    const raw = data[i]?.result;
    if (!raw) continue;
    try { out.set(keys[i], JSON.parse(raw)); } catch {}
  }
  return out;
}

export default async function handler(req) {
  const cors = getCorsHeaders(req, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (isDisallowedOrigin(req)) return jsonResponse({ error: 'Origin not allowed' }, 403, cors);

  const threshold = (() => {
    const value = Number(new URL(req.url).searchParams.get('threshold'));
    if (!Number.isFinite(value)) return 0.8;
    return Math.min(1, Math.max(0, value));
  })();

  const all = [...REQUIRED_DATASETS, ...OPTIONAL_DATASETS];
  let meta;
  try {
    meta = await fetchMeta(all.map(([, key]) => key));
  } catch {
    return jsonResponse({ ready: false, reason: 'redis_unavailable' }, 503, { ...cors, 'Cache-Control': 'no-cache' });
  }

  const now = Date.now();
  const required = {};
  const optional = {};

  let requiredHealthy = 0;
  for (const [name, key, intervalMin] of REQUIRED_DATASETS) {
    const status = datasetStatus(meta.get(key), intervalMin, now);
    required[name] = status;
    if (!status.stale) requiredHealthy += 1;
  }

  let optionalHealthy = 0;
  for (const [name, key, intervalMin] of OPTIONAL_DATASETS) {
    const status = datasetStatus(meta.get(key), intervalMin, now);
    optional[name] = status;
    if (!status.stale) optionalHealthy += 1;
  }

  const requiredRatio = REQUIRED_DATASETS.length ? requiredHealthy / REQUIRED_DATASETS.length : 1;
  const optionalRatio = OPTIONAL_DATASETS.length ? optionalHealthy / OPTIONAL_DATASETS.length : 1;
  const ready = requiredRatio >= threshold;

  return jsonResponse({
    ready,
    threshold,
    checkedAt: now,
    required_ratio: Number(requiredRatio.toFixed(3)),
    optional_ratio: Number(optionalRatio.toFixed(3)),
    coverage: {
      required_healthy: requiredHealthy,
      required_total: REQUIRED_DATASETS.length,
      optional_healthy: optionalHealthy,
      optional_total: OPTIONAL_DATASETS.length,
    },
    required,
    optional,
    policy: {
      required_feeds_gate_readiness: true,
      optional_feeds_report_degraded_only: true,
    },
  }, ready ? 200 : 503, {
    ...cors,
    'Cache-Control': 'max-age=30, stale-while-revalidate=30, stale-if-error=120',
  });
}
