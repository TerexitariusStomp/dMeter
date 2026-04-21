import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';
import { jsonResponse } from '../_json-response.js';
import { readJsonFromUpstash } from '../_upstash-json.js';

export const config = { runtime: 'edge' };

const REDIS_KEY = 'dmrv:usgs-water:v1';
let cached = null;
let cachedAt = 0;
const CACHE_TTL = 300_000;

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (isDisallowedOrigin(req)) return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);

  const now = Date.now();
  if (!cached || now - cachedAt > CACHE_TTL) {
    try {
      const data = await readJsonFromUpstash(REDIS_KEY);
      if (data) { cached = data; cachedAt = now; }
    } catch { /* use stale */ }
  }

  if (!cached) {
    return jsonResponse({ error: 'USGS water data unavailable' }, 503, {
      'Cache-Control': 'no-cache', ...corsHeaders,
    });
  }

  return jsonResponse(cached, 200, {
    'Cache-Control': 's-maxage=900, stale-while-revalidate=300, stale-if-error=1800',
    ...corsHeaders,
  });
}
