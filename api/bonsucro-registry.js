import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { jsonResponse } from './_json-response.js';
import { readJsonFromUpstash } from './_upstash-json.js';

export const config = { runtime: 'edge' };

const REDIS_KEY = 'environment:bonsucro-registry:v1';
const CACHE_TTL_MS = 10 * 60 * 1000;
const NEG_TTL_MS = 60 * 1000;

let memoryCache = null;
let memoryCacheAt = 0;
let negativeCacheUntil = 0;

async function fetchCachedPayload() {
  const now = Date.now();
  if (memoryCache && now - memoryCacheAt < CACHE_TTL_MS) return memoryCache;
  if (now < negativeCacheUntil) return null;

  let payload;
  try {
    payload = await readJsonFromUpstash(REDIS_KEY);
  } catch {
    payload = null;
  }

  if (!payload) {
    negativeCacheUntil = now + NEG_TTL_MS;
    return null;
  }

  memoryCache = payload;
  memoryCacheAt = now;
  return payload;
}

export default async function handler(req) {
  const cors = getCorsHeaders(req, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (isDisallowedOrigin(req)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, cors);
  }

  const payload = await fetchCachedPayload();
  if (!payload) {
    return jsonResponse({ error: 'Bonsucro registry data is temporarily unavailable' }, 503, {
      ...cors,
      'Cache-Control': 'no-cache, no-store',
    });
  }

  return jsonResponse(payload, 200, {
    ...cors,
    'Cache-Control': 's-maxage=900, stale-while-revalidate=300, stale-if-error=1800',
  });
}
