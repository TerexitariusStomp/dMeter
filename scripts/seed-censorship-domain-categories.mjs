#!/usr/bin/env node
/**
 * seed-censorship-domain-categories.mjs
 *
 * Integrates Censored Planet domain-category taxonomy into dMeter.
 * Source taxonomy: scripts/integrations/censoredplanet/domain_categories.csv
 *
 * Reads candidate domains from existing cyber cache (cyber:threats-bootstrap:v2),
 * maps domains to censorship categories, and publishes summary analytics.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadEnvFile,
  runSeed,
  withRetry,
  CHROME_UA,
  readCanonicalValue,
  verifySeedKey,
} from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const TAXONOMY_PATH = join(__dirname, 'integrations', 'censoredplanet', 'domain_categories.csv');

const CANONICAL_KEY = 'intelligence:censorship-domain-categories:v1';
const CACHE_TTL = 6 * 60 * 60; // 6h

function loadDomainCategoryMap() {
  const lines = readFileSync(TAXONOMY_PATH, 'utf8').split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    const idx = line.indexOf(',');
    if (idx <= 0) continue;
    const domain = line.slice(0, idx).trim().toLowerCase();
    const category = line.slice(idx + 1).trim();
    if (domain && category) map.set(domain, category);
  }
  return map;
}

function extractDomain(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const candidate = raw.includes('://') ? raw : `http://${raw}`;
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function collectDomains(node, out = new Set()) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const item of node) collectDomains(item, out);
    return out;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const key = k.toLowerCase();
      if (typeof v === 'string' && (key.includes('domain') || key.includes('host') || key.includes('url'))) {
        const d = extractDomain(v);
        if (d) out.add(d);
      } else {
        collectDomains(v, out);
      }
    }
    return out;
  }
  if (typeof node === 'string') {
    const d = extractDomain(node);
    if (d) out.add(d);
  }
  return out;
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:intelligence:censorship-domain-categories',
  cacheTtl: CACHE_TTL,
  async fetch() {
    const categoryMap = loadDomainCategoryMap();

    const cyber = await withRetry(
      () => readCanonicalValue('cyber:threats-bootstrap:v2'),
      1,
      500,
    ).catch(() => null);

    const domains = [...collectDomains(cyber || {})].slice(0, 20_000);

    const counts = {};
    const samples = {};
    let known = 0;
    for (const domain of domains) {
      const category = categoryMap.get(domain);
      if (!category) continue;
      known += 1;
      counts[category] = (counts[category] || 0) + 1;
      if (!samples[category]) samples[category] = [];
      if (samples[category].length < 12) samples[category].push(domain);
    }

    const top_categories = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([category, count]) => ({ category, count, sample_domains: samples[category] || [] }));

    const payload = {
      source: 'censoredplanet-domain-taxonomy',
      taxonomy_size: categoryMap.size,
      scanned_domains: domains.length,
      categorized_domains: known,
      uncategorized_domains: Math.max(0, domains.length - known),
      top_categories,
      fetchedAt: new Date().toISOString(),
      userAgent: CHROME_UA,
    };

    await verifySeedKey(CANONICAL_KEY, 'top_categories');
    return payload;
  },
});
