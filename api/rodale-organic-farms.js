import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { jsonResponse } from './_json-response.js';
import { readJsonFromUpstash } from './_upstash-json.js';

export const config = { runtime: 'edge' };
const REDIS_KEY = 'agriculture:rodale-organic-farms:v1';

export default async function handler(req) {
  const cors = getCorsHeaders(req, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (isDisallowedOrigin(req)) return jsonResponse({ error: 'Origin not allowed' }, 403, cors);

  const data = await readJsonFromUpstash(REDIS_KEY);
  if (!data) {
    return jsonResponse({ error: 'Data temporarily unavailable' }, 503, { ...cors, 'Cache-Control': 'no-cache, no-store' });
  }

  return jsonResponse(data, 200, {
    ...cors,
    'Cache-Control': 's-maxage=900, stale-while-revalidate=300, stale-if-error=1800',
  });
}