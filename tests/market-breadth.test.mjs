import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

describe('Market breadth bootstrap registration', () => {
  const cacheKeysSrc = readFileSync(join(root, 'server', '_shared', 'cache-keys.ts'), 'utf-8');
  const bootstrapSrc = readFileSync(join(root, 'api', 'bootstrap.js'), 'utf-8');
  const healthSrc = readFileSync(join(root, 'api', 'health.js'), 'utf-8');
  const gatewaySrc = readFileSync(join(root, 'server', 'gateway.ts'), 'utf-8');

  it('cache-keys.ts has breadthHistory in BOOTSTRAP_CACHE_KEYS', () => {
    assert.match(cacheKeysSrc, /breadthHistory:\s+'market:breadth-history:v1'/);
  });

  it('cache-keys.ts has breadthHistory in BOOTSTRAP_TIERS', () => {
    assert.match(cacheKeysSrc, /breadthHistory:\s+'slow'/);
  });

  it('bootstrap.js has breadthHistory key', () => {
    assert.match(bootstrapSrc, /breadthHistory:\s+'market:breadth-history:v1'/);
  });

  it('bootstrap.js has breadthHistory in SLOW_KEYS', () => {
    assert.match(bootstrapSrc, /'breadthHistory'/);
  });

  it('health.js has breadthHistory data key', () => {
    assert.match(healthSrc, /breadthHistory:\s+'market:breadth-history:v1'/);
  });

  it('health.js has breadthHistory seed-meta config', () => {
    assert.match(healthSrc, /breadthHistory:\s+\{\s*key:\s+'seed-meta:market:breadth-history'/);
  });

  it('gateway.ts has market breadth history cache tier', () => {
    assert.match(gatewaySrc, /\/api\/market\/v1\/get-market-breadth-history/);
  });
});

describe('Market breadth seed script', () => {
  const seedSrc = readFileSync(join(root, 'scripts', 'seed-market-breadth.mjs'), 'utf-8');

  it('uses correct Redis key', () => {
    assert.match(seedSrc, /market:breadth-history:v1/);
  });

  it('has a 30-day TTL', () => {
    assert.match(seedSrc, /2592000/);
  });

  it('fetches all three Barchart breadth symbols', () => {
    assert.match(seedSrc, /S5TW/);
    assert.match(seedSrc, /S5FI/);
    assert.match(seedSrc, /S5TH/);
  });

  it('maintains rolling 252-day history', () => {
    assert.match(seedSrc, /HISTORY_LENGTH\s*=\s*252/);
  });

  it('calls runSeed with validation', () => {
    assert.match(seedSrc, /runSeed\(/);
    assert.match(seedSrc, /validateFn/);
  });
});

describe('Market breadth RPC handler', () => {
  const handlerSrc = readFileSync(join(root, 'server', 'worldmonitor', 'market', 'v1', 'get-market-breadth-history.ts'), 'utf-8');

  it('reads from correct cache key', () => {
    assert.match(handlerSrc, /market:breadth-history:v1/);
  });

  it('returns unavailable=true on empty data', () => {
    assert.match(handlerSrc, /unavailable:\s*true/);
  });

  it('maps history entries to BreadthSnapshot', () => {
    assert.match(handlerSrc, /BreadthSnapshot/);
  });
});

describe('Market breadth proto', () => {
  const protoSrc = readFileSync(join(root, 'proto', 'worldmonitor', 'market', 'v1', 'get_market_breadth_history.proto'), 'utf-8');
  const serviceSrc = readFileSync(join(root, 'proto', 'worldmonitor', 'market', 'v1', 'service.proto'), 'utf-8');

  it('defines GetMarketBreadthHistoryRequest and Response', () => {
    assert.match(protoSrc, /GetMarketBreadthHistoryRequest/);
    assert.match(protoSrc, /GetMarketBreadthHistoryResponse/);
  });

  it('defines BreadthSnapshot message', () => {
    assert.match(protoSrc, /message BreadthSnapshot/);
  });

  it('is imported in service.proto', () => {
    assert.match(serviceSrc, /get_market_breadth_history\.proto/);
  });

  it('has RPC registered in MarketService', () => {
    assert.match(serviceSrc, /rpc GetMarketBreadthHistory/);
  });
});

describe('Market breadth panel', () => {
  const panelSrc = readFileSync(join(root, 'src', 'components', 'MarketBreadthPanel.ts'), 'utf-8');

  it('is registered in handler.ts', () => {
    const handlerTs = readFileSync(join(root, 'server', 'worldmonitor', 'market', 'v1', 'handler.ts'), 'utf-8');
    assert.match(handlerTs, /getMarketBreadthHistory/);
  });

  it('builds SVG area chart', () => {
    assert.match(panelSrc, /<svg viewBox/);
    assert.match(panelSrc, /polyline/);
    assert.match(panelSrc, /<path/);
  });

  it('shows 3 series with correct colors', () => {
    assert.match(panelSrc, /#3b82f6/); // blue for 20d
    assert.match(panelSrc, /#f59e0b/); // orange for 50d
    assert.match(panelSrc, /#22c55e/); // green for 200d
  });

  it('fetches from bootstrap and RPC', () => {
    assert.match(panelSrc, /getHydratedData/);
    assert.match(panelSrc, /getMarketBreadthHistory/);
  });
});
