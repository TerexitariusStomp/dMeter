import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';
import { jsonResponse } from '../_json-response.js';
import { readJsonFromUpstash } from '../_upstash-json.js';

export const config = { runtime: 'edge' };

export function createDmrvDatasetHandler({ redisKey, unavailableMessage = 'dMRV dataset unavailable', cacheTtlMs = 300_000, cacheControl = 's-maxage=900, stale-while-revalidate=300, stale-if-error=1800' }) {
  let cached = null;
  let cachedAt = 0;

  return async function handler(req) {
    const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (isDisallowedOrigin(req)) return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);

    const now = Date.now();
    if (!cached || now - cachedAt > cacheTtlMs) {
      try {
        const data = await readJsonFromUpstash(redisKey);
        if (data) { cached = data; cachedAt = now; }
      } catch {
        // serve stale cache if available
      }
    }

    if (!cached) {
      return jsonResponse({ error: unavailableMessage }, 503, {
        'Cache-Control': 'no-cache',
        ...corsHeaders,
      });
    }

    return jsonResponse(cached, 200, {
      'Cache-Control': cacheControl,
      ...corsHeaders,
    });
  };
}
