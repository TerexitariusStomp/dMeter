/**
 * Tests for gzip Accept-Encoding support in Node.js fetch (undici).
 *
 * Phase 0: Proves whether the runtime auto-decompresses gzip responses.
 * Phase 1: Tests the chosen approach (FETCH_HEADERS constant or fetchGzip wrapper).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync, deflateSync } from 'node:zlib';

const TEST_JSON = { hello: 'world', count: 42 };
const TEST_CSV = 'name,value\nalpha,1\nbeta,2\ngamma,3\n';
const GZIPPED_JSON = gzipSync(JSON.stringify(TEST_JSON));
const GZIPPED_CSV = gzipSync(TEST_CSV);
const DEFLATED_JSON = deflateSync(JSON.stringify(TEST_JSON));

let server;
let baseUrl;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost`);
    const path = url.pathname;

    if (path === '/json-gzip') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
      res.end(GZIPPED_JSON);
    } else if (path === '/json-plain') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(TEST_JSON));
    } else if (path === '/csv-gzip') {
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Content-Encoding': 'gzip' });
      res.end(GZIPPED_CSV);
    } else if (path === '/json-deflate') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'deflate' });
      res.end(DEFLATED_JSON);
    } else if (path === '/404-gzip') {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
      res.end(gzipSync(JSON.stringify({ error: 'not found' })));
    } else if (path === '/corrupt-gzip') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
      res.end(Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xff, 0xff]));
    } else if (path === '/brotli') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'br' });
      res.end(JSON.stringify(TEST_JSON));
    } else if (path === '/echo-headers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(req.headers));
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
});

// ─── Phase 0: Runtime proof ───

describe('Phase 0: Node.js fetch gzip runtime behavior', () => {
  let autoDecompresses;

  it('determines whether Node.js fetch auto-decompresses gzip', async () => {
    const resp = await fetch(`${baseUrl}/json-gzip`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    try {
      const data = await resp.json();
      autoDecompresses = true;
      assert.deepEqual(data, TEST_JSON, 'Auto-decompressed JSON should match');
      console.log('  [RESULT] Node.js fetch AUTO-DECOMPRESSES gzip → use Phase 1A (thin constant)');
    } catch {
      autoDecompresses = false;
      console.log('  [RESULT] Node.js fetch does NOT auto-decompress → use Phase 1B (wrapper)');
    }
    assert.ok(autoDecompresses !== undefined, 'Runtime behavior determined');
  });
});

// ─── Phase 1 tests: work regardless of approach chosen ───

describe('Gzip decompression with native fetch', () => {
  it('uncompressed response passes through unchanged', async () => {
    const resp = await fetch(`${baseUrl}/json-plain`, {
      headers: { 'Accept-Encoding': 'gzip, deflate' },
    });
    assert.equal(resp.ok, true);
    assert.deepEqual(await resp.json(), TEST_JSON);
  });

  it('gzip JSON response decompresses via .json()', async () => {
    const resp = await fetch(`${baseUrl}/json-gzip`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(resp.ok, true);
    assert.deepEqual(await resp.json(), TEST_JSON);
  });

  it('gzip CSV response decompresses via .text()', async () => {
    const resp = await fetch(`${baseUrl}/csv-gzip`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(resp.ok, true);
    assert.equal(await resp.text(), TEST_CSV);
  });

  it('deflate JSON response decompresses via .json()', async () => {
    const resp = await fetch(`${baseUrl}/json-deflate`, {
      headers: { 'Accept-Encoding': 'deflate' },
    });
    assert.equal(resp.ok, true);
    assert.deepEqual(await resp.json(), TEST_JSON);
  });

  it('Accept-Encoding does not clobber other headers', async () => {
    const resp = await fetch(`${baseUrl}/echo-headers`, {
      headers: {
        'User-Agent': 'TestAgent/1.0',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
    });
    const headers = await resp.json();
    assert.equal(headers['user-agent'], 'TestAgent/1.0');
    assert.equal(headers['accept'], 'application/json');
    assert.ok(headers['accept-encoding'].includes('gzip'));
  });

  it('non-ok status (404) with gzip still decompresses', async () => {
    const resp = await fetch(`${baseUrl}/404-gzip`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(resp.ok, false);
    assert.equal(resp.status, 404);
    const data = await resp.json();
    assert.deepEqual(data, { error: 'not found' });
  });

  it('corrupt gzip stream rejects on .json()', async () => {
    const resp = await fetch(`${baseUrl}/corrupt-gzip`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    await assert.rejects(() => resp.json(), /unexpected end|premature|invalid/i);
  });
});

describe('FETCH_HEADERS constant in _seed-utils.mjs', () => {
  it('exports FETCH_HEADERS with User-Agent and Accept-Encoding', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(__dirname, '..', 'scripts', '_seed-utils.mjs'), 'utf-8');
    assert.ok(src.includes('FETCH_HEADERS'), 'Should export FETCH_HEADERS constant');
    assert.ok(src.includes("'Accept-Encoding'"), 'FETCH_HEADERS should include Accept-Encoding');
    assert.ok(src.includes('CHROME_UA'), 'FETCH_HEADERS should reference CHROME_UA');
  });
});
