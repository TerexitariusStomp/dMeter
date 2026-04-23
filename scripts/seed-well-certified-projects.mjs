#!/usr/bin/env node
/**
 * seed-well-certified-projects.mjs
 * Fetches WELL Certified project directory from v2-api.wellcertified.com
 * and seeds Redis. The upstream API does not expose coordinates;
 * data is stored as structured tabular records with summary stats.
 */
import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'buildings:well-certified-projects:v1';
const BOOTSTRAP_KEY = 'buildings:well-certified-projects-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6 hours

const API_BASE = 'https://v2-api.wellcertified.com/api/project-directory/get';
const PAGE_LIMIT = 100;
const FETCH_CONCURRENCY = 8;

function compactProject(p) {
  return {
    id: p.id ?? null,
    nid: p.nid ?? null,
    name: p.name?.trim() || null,
    slug: p.slug?.trim() || null,
    city: p.city?.trim() || null,
    state: p.state?.trim() || null,
    country: p.country?.trim() || null,
    area: p.area?.trim() || null,
    organization: p.organization?.trim() || null,
    projectType: p.project_type?.trim() || null,
    standard: p.standard?.trim() || null,
    sector: p.sector?.trim() || null,
    industry: p.industry?.trim() || null,
    tourAvailable: p.tour_available === 'Yes',
    privateProject: p.private_project === 'Yes',
    certificationStatus: Array.isArray(p.certification_status)
      ? p.certification_status.map(cs => ({
          type: cs.type?.trim() || null,
          date: cs.date || null,
          expiry: cs.expiry || null,
        }))
      : [],
    url: p.url?.trim() || null,
    projectImageUrl: p.project_image_url?.trim() || null,
    featured: p.featured === 1 || p.featured === true,
  };
}

async function fetchPage(pageNum) {
  const url = new URL(API_BASE);
  url.searchParams.set('page', String(pageNum));
  url.searchParams.set('limit', String(PAGE_LIMIT));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': CHROME_UA,
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) throw new Error(`WELL API HTTP ${res.status} on page ${pageNum}`);
  const json = await res.json();
  return json;
}

async function fetchAllProjects() {
  const first = await fetchPage(1);
  const totalPages = first.last_page ?? 1;
  const total = first.total ?? 0;
  const all = (first.data || []).map(compactProject);

  const remaining = [];
  for (let p = 2; p <= totalPages; p++) {
    remaining.push(p);
  }

  // Fetch remaining pages in batches
  for (let i = 0; i < remaining.length; i += FETCH_CONCURRENCY) {
    const batch = remaining.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(p => fetchPage(p)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        all.push(...(r.value.data || []).map(compactProject));
      } else {
        console.warn('Page fetch failed:', r.reason?.message || r.reason);
      }
    }
  }

  // Deduplicate by id
  const seen = new Set();
  const deduped = [];
  for (const proj of all) {
    if (!seen.has(proj.id)) {
      seen.add(proj.id);
      deduped.push(proj);
    }
  }

  // Summary
  const byStatus = {};
  const byType = {};
  const byCountry = {};
  for (const p of deduped) {
    for (const cs of p.certificationStatus) {
      byStatus[cs.type] = (byStatus[cs.type] || 0) + 1;
    }
    byType[p.projectType] = (byType[p.projectType] || 0) + 1;
    byCountry[p.country] = (byCountry[p.country] || 0) + 1;
  }

  return {
    meta: {
      source: 'WELL Certified Project Directory',
      sourceUrl: 'https://account.wellcertified.com/directories/projects',
      fetchedAt: new Date().toISOString(),
      totalUpstream: total,
      pagesFetched: totalPages,
      rowsFetched: all.length,
      rowsAfterDedup: deduped.length,
    },
    summary: {
      byCertificationStatus: byStatus,
      byProjectType: byType,
      byCountry: byCountry,
    },
    projects: deduped,
  };
}

function validate(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.projects) &&
    data.projects.length > 0
  );
}

function declareRecords(data) {
  return data && typeof data === 'object' && Array.isArray(data.projects)
    ? data.projects.length
    : 0;
}

runSeed('buildings', 'well-certified-projects', CANONICAL_KEY, fetchAllProjects, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'well-api-v2',
  schemaVersion: 1,
  maxStaleMin: 360,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
