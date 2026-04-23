#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CKAN_BASE = 'https://data.naturalcapitalalliance.stanford.edu';
const PACKAGE_SEARCH_URL = `${CKAN_BASE}/api/3/action/package_search`;

const CANONICAL_KEY = 'environment:natcap-map-data:v1';
const BOOTSTRAP_KEY = 'environment:natcap-map-data-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6h

const MAP_FORMAT_ALLOWLIST = new Set([
  'GEOJSON', 'TOPOJSON', 'JSON', 'CSV',
  'SHP', 'ZIP', 'KML', 'KMZ',
  'GEOTIFF', 'TIFF', 'TIF',
  'WMS', 'WFS', 'GPKG',
]);

const MAP_URL_HINTS = [
  '.geojson', '.json', '.topojson', '.csv',
  '.shp', '.zip', '.kml', '.kmz',
  '.tif', '.tiff', 'wms', 'wfs', 'arcgis', 'featureserver', 'tiles',
];

function normalizeFormat(value) {
  return String(value || '').trim().toUpperCase();
}

function isMapResource(resource) {
  const format = normalizeFormat(resource?.format);
  if (MAP_FORMAT_ALLOWLIST.has(format)) return true;

  const url = String(resource?.url || '').toLowerCase();
  if (MAP_URL_HINTS.some((hint) => url.includes(hint))) return true;

  return false;
}

function parseSpatialGeometry(pkg) {
  const extras = Array.isArray(pkg?.extras) ? pkg.extras : [];
  const spatial = extras.find((entry) => entry?.key === 'spatial')?.value;
  if (!spatial || typeof spatial !== 'string') return null;

  try {
    const geometry = JSON.parse(spatial);
    if (!geometry || typeof geometry !== 'object' || !geometry.type) return null;
    return geometry;
  } catch {
    return null;
  }
}

function compactResource(resource) {
  return {
    id: resource?.id || null,
    name: resource?.name || null,
    format: normalizeFormat(resource?.format),
    url: resource?.url || null,
    size: typeof resource?.size === 'number' ? resource.size : null,
    created: resource?.created || null,
    lastModified: resource?.last_modified || null,
  };
}

async function fetchPackages() {
  const rows = 100;
  let start = 0;
  let total = null;
  const out = [];

  while (total === null || start < total) {
    const resp = await fetch(`${PACKAGE_SEARCH_URL}?rows=${rows}&start=${start}`, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(25_000),
    });
    if (!resp.ok) throw new Error(`package_search HTTP ${resp.status}`);

    const json = await resp.json();
    const result = json?.result;
    const results = Array.isArray(result?.results) ? result.results : [];

    if (!Array.isArray(result?.results)) {
      throw new Error('package_search returned invalid shape');
    }

    if (total === null) total = Number(result?.count || results.length);
    out.push(...results);

    if (results.length === 0) break;
    start += results.length;
  }

  return out;
}

async function fetchNatcapMapData() {
  const packages = await fetchPackages();

  const datasets = [];
  const features = [];
  const formatCounts = {};
  let mapResourceCount = 0;

  for (const pkg of packages) {
    const resources = Array.isArray(pkg?.resources) ? pkg.resources : [];
    const mapResources = resources.filter(isMapResource).map(compactResource);

    if (mapResources.length === 0) continue;

    for (const res of mapResources) {
      const format = res.format || 'UNKNOWN';
      formatCounts[format] = (formatCounts[format] || 0) + 1;
      mapResourceCount += 1;
    }

    const dataset = {
      id: pkg?.id || null,
      name: pkg?.name || null,
      title: pkg?.title || null,
      notes: pkg?.notes || null,
      metadataCreated: pkg?.metadata_created || null,
      metadataModified: pkg?.metadata_modified || null,
      organization: pkg?.organization?.title || pkg?.organization?.name || null,
      tags: Array.isArray(pkg?.tags) ? pkg.tags.map((t) => t?.name).filter(Boolean) : [],
      resourceCount: resources.length,
      mapResourceCount: mapResources.length,
      mapResources,
    };

    datasets.push(dataset);

    const geometry = parseSpatialGeometry(pkg);
    if (geometry) {
      features.push({
        type: 'Feature',
        geometry,
        properties: {
          datasetId: dataset.id,
          datasetName: dataset.name,
          title: dataset.title,
          organization: dataset.organization,
          mapResourceCount: dataset.mapResourceCount,
          mapResources,
        },
      });
    }
  }

  datasets.sort((a, b) => (b.mapResourceCount || 0) - (a.mapResourceCount || 0));

  return {
    source: 'Stanford Natural Capital Alliance Data Hub (CKAN)',
    sourceUrl: `${CKAN_BASE}/dataset/`,
    fetchedAt: new Date().toISOString(),
    datasetCount: datasets.length,
    mapResourceCount,
    formatCounts,
    datasets,
    coverage: {
      type: 'FeatureCollection',
      features,
    },
  };
}

function validate(data) {
  return Array.isArray(data?.datasets) && data.datasets.length > 0;
}

export function declareRecords(data) {
  return Array.isArray(data?.datasets) ? data.datasets.length : 0;
}

runSeed('environment', 'natcap-map-data', CANONICAL_KEY, fetchNatcapMapData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'natcap-ckan-v1',
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 360,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
