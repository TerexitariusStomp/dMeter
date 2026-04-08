import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { jsonResponse } from './_json-response.js';

export const config = { runtime: 'edge' };

const REQUEST_TIMEOUT_MS = 12_000;

const PROVIDERS = Object.freeze({
  thesportsdb: {
    baseUrl: 'https://www.thesportsdb.com/api/v1/json/123',
    endpointTtls: Object.freeze({
      '/all_leagues.php': 6 * 60 * 60,
      '/lookupleague.php': 60 * 60,
      '/search_all_seasons.php': 60 * 60,
      '/lookuptable.php': 10 * 60,
      '/eventslast.php': 10 * 60,
      '/eventsnext.php': 5 * 60,
      '/lookupeventstats.php': 10 * 60,
      '/searchplayers.php': 30 * 60,
      '/lookupplayer.php': 60 * 60,
    }),
    allowedParams: Object.freeze({
      '/all_leagues.php': new Set(),
      '/lookupleague.php': new Set(['id']),
      '/search_all_seasons.php': new Set(['id']),
      '/lookuptable.php': new Set(['l', 's']),
      '/eventslast.php': new Set(['id']),
      '/eventsnext.php': new Set(['id']),
      '/lookupeventstats.php': new Set(['id']),
      '/searchplayers.php': new Set(['p']),
      '/lookupplayer.php': new Set(['id']),
    }),
  },
  espn: {
    baseUrl: 'https://www.espn.com',
    endpointTtls: Object.freeze({
      '/nba/standings': 5 * 60,
    }),
    allowedParams: Object.freeze({
      '/nba/standings': new Set(),
    }),
  },
  espnsite: {
    baseUrl: 'https://site.api.espn.com/apis/site/v2/sports',
    endpointTtls: Object.freeze({
      '/soccer/eng.1/scoreboard': 5 * 60,
      '/soccer/eng.1/summary': 2 * 60,
      '/soccer/uefa.champions/scoreboard': 5 * 60,
      '/soccer/uefa.champions/summary': 2 * 60,
      '/soccer/fifa.world/scoreboard': 10 * 60,
      '/soccer/fifa.world/summary': 2 * 60,
      '/soccer/uefa.euro/scoreboard': 10 * 60,
      '/soccer/uefa.euro/summary': 2 * 60,
      '/soccer/conmebol.america/scoreboard': 10 * 60,
      '/soccer/conmebol.america/summary': 2 * 60,
      '/soccer/conmebol.libertadores/scoreboard': 5 * 60,
      '/soccer/conmebol.libertadores/summary': 2 * 60,
      '/basketball/nba/scoreboard': 2 * 60,
      '/basketball/nba/summary': 90,
    }),
    allowedParams: Object.freeze({
      '/soccer/eng.1/scoreboard': new Set(),
      '/soccer/eng.1/summary': new Set(['event']),
      '/soccer/uefa.champions/scoreboard': new Set(),
      '/soccer/uefa.champions/summary': new Set(['event']),
      '/soccer/fifa.world/scoreboard': new Set(),
      '/soccer/fifa.world/summary': new Set(['event']),
      '/soccer/uefa.euro/scoreboard': new Set(),
      '/soccer/uefa.euro/summary': new Set(['event']),
      '/soccer/conmebol.america/scoreboard': new Set(),
      '/soccer/conmebol.america/summary': new Set(['event']),
      '/soccer/conmebol.libertadores/scoreboard': new Set(),
      '/soccer/conmebol.libertadores/summary': new Set(['event']),
      '/basketball/nba/scoreboard': new Set(),
      '/basketball/nba/summary': new Set(['event']),
    }),
  },
  jolpica: {
    baseUrl: 'https://api.jolpi.ca',
    endpointTtls: Object.freeze({
      '/ergast/f1/current/driverStandings.json': 5 * 60,
      '/ergast/f1/current/constructorStandings.json': 5 * 60,
      '/ergast/f1/current/last/results.json': 5 * 60,
      '/ergast/f1/current/next.json': 30 * 60,
    }),
    allowedParams: Object.freeze({
      '/ergast/f1/current/driverStandings.json': new Set(),
      '/ergast/f1/current/constructorStandings.json': new Set(),
      '/ergast/f1/current/last/results.json': new Set(),
      '/ergast/f1/current/next.json': new Set(),
    }),
  },
  openf1: {
    baseUrl: 'https://api.openf1.org',
    endpointTtls: Object.freeze({
      '/v1/drivers': 6 * 60 * 60,
    }),
    allowedParams: Object.freeze({
      '/v1/drivers': new Set(['session_key']),
    }),
  },
});

function resolveSportsRequest(providerKey, rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const provider = PROVIDERS[providerKey] || PROVIDERS.thesportsdb;

  let parsed;
  try {
    parsed = new URL(rawPath, 'https://worldmonitor.app');
  } catch {
    return null;
  }

  const pathname = parsed.pathname;
  if (!(pathname in provider.endpointTtls)) return null;

  const allowedParams = provider.allowedParams[pathname];
  for (const key of parsed.searchParams.keys()) {
    if (!allowedParams.has(key)) return null;
  }

  return {
    upstreamUrl: `${provider.baseUrl}${pathname}${parsed.search}`,
    cacheTtl: provider.endpointTtls[pathname] || 300,
  };
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const requestUrl = new URL(req.url);
  const providerKey = requestUrl.searchParams.get('provider') || 'thesportsdb';
  const requestedPath = requestUrl.searchParams.get('path');
  const resolved = resolveSportsRequest(providerKey, requestedPath);
  if (!resolved) {
    return jsonResponse({ error: 'Invalid sports path' }, 400, corsHeaders);
  }

  const { upstreamUrl, cacheTtl } = resolved;

  try {
    const response = await fetch(upstreamUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'WorldMonitor-Sports-Proxy/1.0',
      },
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': response.ok
          ? `public, max-age=120, s-maxage=${cacheTtl}, stale-while-revalidate=${cacheTtl}`
          : 'public, max-age=15, s-maxage=60, stale-while-revalidate=120',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    return jsonResponse(
      { error: isTimeout ? 'Sports feed timeout' : 'Failed to fetch sports data' },
      isTimeout ? 504 : 502,
      corsHeaders,
    );
  }
}
