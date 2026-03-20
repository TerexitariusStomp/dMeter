import { httpRouter, httpAction } from "convex/server";
import { authComponent, createAuth, TRUSTED_ORIGINS } from "./auth";
import { internal } from "./_generated/api";

const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });

// ---------------------------------------------------------------------------
// CORS helpers for /api/user-role
// ---------------------------------------------------------------------------

function matchOrigin(origin: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    return origin.endsWith(pattern.slice(1)); // *.domain.com → .domain.com suffix
  }
  return origin === pattern;
}

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return TRUSTED_ORIGINS.some((p) => matchOrigin(origin, p)) ? origin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Vary': 'Origin',
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// ---------------------------------------------------------------------------
// OPTIONS preflight
// ---------------------------------------------------------------------------

http.route({
  path: '/api/user-role',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => {
    const origin = allowedOrigin(request.headers.get('Origin'));
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }),
});

// ---------------------------------------------------------------------------
// POST /api/user-role — authenticated role lookup
// ---------------------------------------------------------------------------

http.route({
  path: '/api/user-role',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = allowedOrigin(request.headers.get('Origin'));
    const baseHeaders = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    };

    const auth = createAuth(ctx);
    const session = await auth.api.getSession({ headers: new Headers(request.headers) });
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: baseHeaders,
      });
    }

    const result = await ctx.runQuery(internal.userRoles.getUserRole, {
      userId: session.user.id,
    });
    return new Response(JSON.stringify({ role: result.role }), {
      status: 200,
      headers: baseHeaders,
    });
  }),
});

export default http;
