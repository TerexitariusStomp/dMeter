#!/usr/bin/env node
/**
 * seed-gstc-certified-destinations.mjs
 * Fetches GSTC Certified Sustainable Destinations from the official GSTC Google My Maps.
 * Source: https://www.gstc.org/certified-sustainable-destinations/
 * Map ID: 1qS8sGm9F2mr_tRld2zyA7Me3lJo
 *
 * The map aggregates destinations certified by GSTC-Accredited bodies:
 * - EarthCheck
 * - Green Destinations
 * - Vireo Srl
 */

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'tourism:gstc-certified-destinations:v1';
const BOOTSTRAP_KEY = 'tourism:gstc-certified-destinations-bootstrap:v1';
const CACHE_TTL = 24 * 60 * 60; // 24h — destinations change infrequently
const KML_URL = 'https://www.google.com/maps/d/kml?mid=1qS8sGm9F2mr_tRld2zyA7Me3lJo&forcekml=1';

function inferCertifier(description) {
  if (!description) return 'Unknown';
  const d = description.toLowerCase();
  if (d.includes('earthcheck')) return 'EarthCheck';
  if (d.includes('green destinations')) return 'Green Destinations';
  if (d.includes('vireo') || d.includes('gstc-d criteria by vireo')) return 'Vireo Srl';
  if (d.includes('gstc')) return 'GSTC';
  return 'Unknown';
}

function parseKml(kmlText) {
  const destinations = [];
  const placemarkRegex = /<Placemark>(.*?)<\/Placemark>/gs;
  let block;
  while ((block = placemarkRegex.exec(kmlText)) !== null) {
    const blockContent = block[1];

    const nameMatch = blockContent.match(/<name>(.*?)<\/name>/s);
    if (!nameMatch) continue;
    let name = nameMatch[1].trim().replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();

    const descMatch = blockContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s) ||
                     blockContent.match(/<description>(.*?)<\/description>/s);
    let description = '';
    if (descMatch) {
      description = descMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    const coordMatch = blockContent.match(/<coordinates>(.*?)<\/coordinates>/s);
    if (!coordMatch) continue;
    const coordText = coordMatch[1].trim();
    const coordLines = coordText.split(/\s+/).filter(Boolean);
    if (coordLines.length === 0) continue;

    const firstCoord = coordLines[0].split(',');
    if (firstCoord.length < 2) continue;
    const lon = parseFloat(firstCoord[0]);
    const lat = parseFloat(firstCoord[1]);
    if (isNaN(lat) || isNaN(lon)) continue;

    destinations.push({
      name,
      description,
      latitude: lat,
      longitude: lon,
      certifier: inferCertifier(description),
    });
  }
  return destinations;
}

async function fetchGSTCDestinations() {
  const res = await fetch(KML_URL, {
    headers: {
      Accept: 'application/xml',
      'User-Agent': CHROME_UA,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`GSTC KML HTTP ${res.status}`);
  const kml = await res.text();

  const destinations = parseKml(kml);
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new Error('No destinations parsed from KML');
  }

  return {
    source: 'gstc-certified-destinations',
    fetchedAt: new Date().toISOString(),
    destinations,
    count: destinations.length,
  };
}

function validate(data) {
  return Array.isArray(data?.destinations) && data.destinations.length > 0;
}

function declareRecords(data) {
  return Array.isArray(data?.destinations) ? data.destinations.length : 0;
}

await runSeed('tourism', 'gstc-certified-destinations', CANONICAL_KEY, fetchGSTCDestinations, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'kml-v1',
  schemaVersion: 1,
  maxStaleMin: 1440,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err?.cause?.message || err?.cause?.code || err?.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
