#!/usr/bin/env node
/**
 * seed-earthcheck-members.mjs
 * Attempts to ingest EarthCheck Certification Members.
 *
 * Source: https://earthcheck.org/about/members/
 *
 * The EarthCheck member directory is published via a Microsoft Power BI
 * embedded report behind a lead-generation form.  There is no public
 * REST API for the full member list.  This seeder therefore:
 *
 *   1. Attempts to scrape any public member references (case-studies,
 *      research pages, etc.).
 *   2. Falls back to a "gated" sentinel payload so the edge function
 *      can surface a helpful status to consumers.
 *
 * When EarthCheck opens an API or publishes a downloadable dataset,
 * replace fetchPublicMembers() with the real fetcher and remove the
 * _gated sentinel.
 */

import { loadEnvFile, CHROME_UA, runSeed, curlFetch } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'tourism:earthcheck-members:v1';
const BOOTSTRAP_KEY = 'tourism:earthcheck-members-bootstrap:v1';
const CACHE_TTL = 6 * 60 * 60; // 6h

const EARTHCHECK_MEMBERS_PAGE = 'https://earthcheck.org/about/members/';
const EARTHCHECK_CASE_STUDIES = 'https://earthcheck.org/case-studies/';

/**
 * Scrape public case-study pages for member names & locations.
 * This yields a *partial* dataset — only members with published case studies.
 */
async function fetchPublicMembers() {
  const members = [];

  // 1. Try to scrape the members page for any inline JSON / data attributes.
  try {
    const html = curlFetch(EARTHCHECK_MEMBERS_PAGE, null, {
      'User-Agent': CHROME_UA,
      Accept: 'text/html',
    });

    // Look for JSON-LD structured data that might contain member references
    const ldJsonMatches = html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
    for (const m of ldJsonMatches) {
      try {
        const ld = JSON.parse(m[1]);
        if (ld['@type'] === 'ItemList' && Array.isArray(ld.itemListElement)) {
          for (const item of ld.itemListElement) {
            if (item.name) {
              members.push({
                name: item.name,
                source: 'members-page-ld+json',
                url: item.url || null,
                latitude: null,
                longitude: null,
                partial: true,
              });
            }
          }
        }
      } catch { /* ignore malformed JSON-LD */ }
    }
  } catch (err) {
    console.warn('  Members page scrape failed:', err.message);
  }

  // 2. Scrape case-studies index for member names
  try {
    const html = curlFetch(EARTHCHECK_CASE_STUDIES, null, {
      'User-Agent': CHROME_UA,
      Accept: 'text/html',
    });

    // Very permissive regex to extract article titles / member names
    // Case-study titles are usually like "How [Member Name] earned its..."
    const titleMatches = html.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gs);
    const seen = new Set();
    for (const m of titleMatches) {
      let text = m[1].replace(/<[^>]+>/g, '').trim();
      // Decode common HTML entities
      text = text.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—');
      if (!text || text.length < 10 || text.length > 140) continue;

      // Heuristic: skip generic headings / footer / nav
      const lower = text.toLowerCase();
      const skipTerms = [
        'case stud', 'read more', 'category', 'about', 'certification', 'training',
        'advisory', 'events', 'research', 'resources', 'contact', 'home',
        'sustainability', 'science', 'planet', 'good for business', 'solutions',
        'services', 'back to', 'see all', 'latest', 'member', 'directory', 'form',
        'keep up to date', 'news from earthcheck', 'acknowledgement of country',
        'get instant access', 'discussion paper', 'briefing paper',
        'earthcheck certified', 'aligned globally', '© ', 'copyright',
      ];
      if (skipTerms.some(t => lower.includes(t))) continue;

      // Try to extract the actual member name from case-study titles
      // Patterns: "How [Name] earned...", "[Name] is sustainable...", "[Name]: ..."
      let name = text;
      const extractPatterns = [
        /How\s+(.+?)\s+(earned|achieved|measure|is|are|delivers|embracing|keeping|becoming)/i,
        /^(.+?):\s+(How|Committed|Iceland|Whole|Bringing)/i,
        /^(.+?)\s+is\s+sustainable/i,
        /^(.+?)\s+are\s+setting/i,
        /^(.+?)\s+measure\s+what/i,
      ];
      for (const pat of extractPatterns) {
        const match = text.match(pat);
        if (match) {
          name = match[1].trim();
          break;
        }
      }

      if (name.length < 4 || name.length > 80) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      members.push({
        name,
        source: 'case-study-title',
        originalTitle: text,
        url: null,
        latitude: null,
        longitude: null,
        partial: true,
      });
    }
  } catch (err) {
    console.warn('  Case-studies scrape failed:', err.message);
  }

  // 3. If we got *any* members, return them alongside the gated sentinel.
  //    Consumers can display partial data while the full directory is pending.
  return {
    _gated: true,
    message:
      'EarthCheck member directory is behind a lead-generation form + Power BI embed. ' +
      'Automated ingestion is not possible without API access or manual form submission. ' +
      'This payload contains only publicly scraped case-study references.',
    members,
    sourceUrl: EARTHCHECK_MEMBERS_PAGE,
    fetchedAt: new Date().toISOString(),
  };
}

function validate(data) {
  // Accept gated payloads (they carry a members array, possibly empty).
  if (data && data._gated === true) return true;
  return Array.isArray(data?.members) || Array.isArray(data);
}

function declareRecords(data) {
  if (data && data._gated === true) return data.members?.length ?? 0;
  return Array.isArray(data?.members) ? data.members.length : Array.isArray(data) ? data.length : 0;
}

await runSeed('tourism', 'earthcheck-members', CANONICAL_KEY, fetchPublicMembers, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'scrape-gated-v1',
  schemaVersion: 1,
  maxStaleMin: 360,
  extraKeys: [{ key: BOOTSTRAP_KEY, ttl: CACHE_TTL, declareRecords }],
  declareRecords,
  zeroIsValid: true, // gated payload with 0 scraped members is still valid
}).catch((err) => {
  const cause = err?.cause ? ` (cause: ${err?.cause?.message || err?.cause?.code || err?.cause})` : '';
  console.error('FATAL:', (err?.message || err) + cause);
  process.exit(1);
});
