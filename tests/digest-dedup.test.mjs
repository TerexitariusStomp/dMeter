/**
 * Test: digest fuzzy deduplication merges near-duplicate stories.
 *
 * Run: node --test tests/digest-dedup.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  resolve(__dirname, '..', 'scripts', 'seed-digest-notifications.mjs'),
  'utf-8',
);

// ── Extract the dedup functions via dynamic evaluation ────────────────────────
// We extract the pure functions (no side-effects, no imports) to test them.

const STOP_WORDS_BLOCK = src.match(/const STOP_WORDS = new Set\(\[[\s\S]*?\]\);/)?.[0];
const thresholdConsts = src.match(/const JACCARD_MERGE_THRESHOLD[\s\S]*?const CLUSTER_JOIN_MIN_DISTINCTIVE_WHEN_HAS_EVIDENCE\s*=\s*\d+;/)?.[0];
const stripSourceSuffix = src.match(/function stripSourceSuffix\(title\) \{[\s\S]*?\n\}/)?.[0];
const extractTitleWords = src.match(/function extractTitleWords\(title\) \{[\s\S]*?\n\}/)?.[0];
const jaccardSimilarity = src.match(/function jaccardSimilarity\(setA, setB\) \{[\s\S]*?\n\}/)?.[0];
const sharesDistinctiveContent = src.match(/function sharesDistinctiveContent\([^)]+\) \{[\s\S]*?\n\}/)?.[0];
const deduplicateStories = src.match(/function deduplicateStories\(stories\) \{[\s\S]*?\n\}/)?.[0];

assert.ok(STOP_WORDS_BLOCK, 'STOP_WORDS not found in source');
assert.ok(thresholdConsts, 'merge threshold constants not found in source');
assert.ok(stripSourceSuffix, 'stripSourceSuffix not found in source');
assert.ok(extractTitleWords, 'extractTitleWords not found in source');
assert.ok(jaccardSimilarity, 'jaccardSimilarity not found in source');
assert.ok(sharesDistinctiveContent, 'sharesDistinctiveContent not found in source');
assert.ok(deduplicateStories, 'deduplicateStories not found in source');

const mod = {};
new Function('mod', `
  ${STOP_WORDS_BLOCK}
  ${thresholdConsts}
  ${stripSourceSuffix}
  ${extractTitleWords}
  ${jaccardSimilarity}
  ${sharesDistinctiveContent}
  ${deduplicateStories}
  mod.stripSourceSuffix = stripSourceSuffix;
  mod.extractTitleWords = extractTitleWords;
  mod.jaccardSimilarity = jaccardSimilarity;
  mod.sharesDistinctiveContent = sharesDistinctiveContent;
  mod.deduplicateStories = deduplicateStories;
`)(mod);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('stripSourceSuffix', () => {
  it('strips "- reuters.com"', () => {
    assert.equal(
      mod.stripSourceSuffix('US fighter jet shot down over Iran - reuters.com'),
      'US fighter jet shot down over Iran',
    );
  });

  it('strips "- Reuters"', () => {
    assert.equal(
      mod.stripSourceSuffix('Downed planes spell new peril for Trump - Reuters'),
      'Downed planes spell new peril for Trump',
    );
  });

  it('strips "- AP News"', () => {
    assert.equal(
      mod.stripSourceSuffix('US military jets hit in Iran war - AP News'),
      'US military jets hit in Iran war',
    );
  });

  it('strips "- apnews.com"', () => {
    assert.equal(
      mod.stripSourceSuffix('US military jets hit in Iran war - apnews.com'),
      'US military jets hit in Iran war',
    );
  });

  it('preserves titles without source suffix', () => {
    assert.equal(
      mod.stripSourceSuffix('Myanmar coup leader elected president'),
      'Myanmar coup leader elected president',
    );
  });
});

describe('deduplicateStories', () => {
  function story(title, score = 10, mentions = 1, hash = undefined) {
    return { title, currentScore: score, mentionCount: mentions, sources: [], severity: 'critical', hash: hash ?? title.slice(0, 8) };
  }

  it('merges near-duplicate Reuters headlines about downed jet', () => {
    const stories = [
      story('US fighter jet shot down over Iran, search underway for crew, US official says - reuters.com', 90),
      story('US fighter jet shot down over Iran, search underway for crew, US officials say - reuters.com', 85),
      story('US fighter jet shot down over Iran, search under way for crew member, US officials say - reuters.com', 80),
      story('US fighter jet shot down over Iran, search under way for crew member, US officials say - Reuters', 75),
      story('US fighter jet shot down over Iran, search underway for crew member, US officials say - Reuters', 70),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(result.length, 1, `Expected 1 cluster, got ${result.length}: ${result.map(r => r.title).join(' | ')}`);
    assert.equal(result[0].currentScore, 90);
    assert.equal(result[0].mentionCount, 5);
  });

  it('keeps genuinely different stories separate', () => {
    const stories = [
      story('US fighter jet shot down over Iran', 90),
      story('Myanmar coup leader Min Aung Hlaing elected president', 80),
      story('Brent oil spot price soars to $141', 70),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(result.length, 3);
  });

  it('merges same story reported by different outlets with different suffixes', () => {
    const stories = [
      story('Downed planes spell new peril for Trump as Tehran hunts missing US pilot - Reuters', 90),
      story('Downed planes spell new peril for Trump as Tehran hunts missing US pilot - reuters.com', 85),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(result.length, 1);
    assert.equal(result[0].currentScore, 90);
  });

  it('merges stories with minor wording differences', () => {
    const stories = [
      story('US rescues airman whose F-15 was downed in Iran, US officials say - Reuters', 90),
      story('Iran says several enemy aircraft destroyed during US pilot rescue mission - Reuters', 80),
      story('Trump, Israel pressure Iran ahead of deadline as search continues for missing US airman - Reuters', 70),
    ];
    const result = mod.deduplicateStories(stories);
    // These are different enough events/angles that they should stay separate
    assert.ok(result.length >= 2, `Expected at least 2 clusters, got ${result.length}`);
  });

  it('carries mergedHashes from all clustered stories for source lookup', () => {
    const stories = [
      story('US fighter jet shot down - reuters.com', 90, 1, 'hash_a'),
      story('US fighter jet shot down - Reuters', 80, 1, 'hash_b'),
      story('US fighter jet shot down - AP News', 70, 1, 'hash_c'),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].mergedHashes, ['hash_a', 'hash_b', 'hash_c']);
  });

  it('preserves single stories without modification', () => {
    const stories = [story('Only one story here', 50, 3)];
    const result = mod.deduplicateStories(stories);
    assert.equal(result.length, 1);
    assert.equal(result[0].mentionCount, 3);
    assert.deepEqual(result[0].mergedHashes, [stories[0].hash]);
  });

  // REGRESSION (2026-04-19): a real brief surfaced 6 separate stories
  // about the Strait-of-Hormuz closure with wildly different phrasing
  // (one said "closed", another "defiant message ... cross Hormuz",
  // another framed as "Middle East crisis live"). At Jaccard ≥ 0.55
  // with frozen cluster words, all 6 passed through as distinct.
  // With the new rules (threshold 0.35 + distinctive-content second
  // pass + growing cluster pool) they collapse to a single cluster.
  it('merges 6 wire variants of the same Hormuz closure event into one cluster', () => {
    const stories = [
      story('Iran says it has closed Strait of Hormuz again over US blockade', 95, 1, 'h02'),
      story('Iran closes Strait of Hormuz again over US blockade and fires on ships', 90, 1, 'h05'),
      story('Defiant message from Iran as vessels attempting to cross Hormuz report gunfire - Reuters', 85, 1, 'h07'),
      story('Middle East crisis live: Iran warns it will close strait of Hormuz if US blockade continues', 80, 1, 'h08'),
      story('Middle East crisis live: Iran says it has closed the strait of Hormuz; tanker reports being attacked', 75, 1, 'h10'),
      story('Middle East crisis live: tanker reports attack as Iran closes strait of Hormuz; French soldier killed in Lebanon', 70, 1, 'h11'),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(result.length, 1, `expected 1 Hormuz cluster, got ${result.length}: ${result.map((r) => r.title).join(' | ')}`);
    // All six hashes carried through so source-lookup still works.
    assert.equal(result[0].mergedHashes.length, 6);
    // The highest-scored variant wins as the display title.
    assert.ok(result[0].title.includes('Iran says it has closed Strait'));
    // Mention-count is the sum across the cluster.
    assert.equal(result[0].mentionCount, 6);
  });

  // Asymmetry check: the 6-Hormuz merge must survive any processing
  // order. The greedy clusterer could in principle pick a "sibling"
  // first story whose low Jaccard with the dominant variant seeds
  // two clusters instead of one; the post-pass cluster-cluster
  // merge is what guards against that.
  it('Hormuz merge survives reversed processing order (score equalised)', () => {
    const titles = [
      'Middle East crisis live: tanker reports attack as Iran closes strait of Hormuz; French soldier killed in Lebanon',
      'Middle East crisis live: Iran says it has closed the strait of Hormuz; tanker reports being attacked',
      'Middle East crisis live: Iran warns it will close strait of Hormuz if US blockade continues',
      'Defiant message from Iran as vessels attempting to cross Hormuz report gunfire - Reuters',
      'Iran closes Strait of Hormuz again over US blockade and fires on ships',
      'Iran says it has closed Strait of Hormuz again over US blockade',
    ];
    const stories = titles.map((t, i) => story(t, 70 - i, 1, `r${i}`));
    const result = mod.deduplicateStories(stories);
    assert.equal(result.length, 1, `expected 1 cluster under reverse order, got ${result.length}: ${result.map((r) => r.title).join(' | ')}`);
  });

  // FALSE-POSITIVE GUARD: a single shared entity ("Iran") must NOT
  // be enough to merge two genuinely different stories — the
  // distinctive-content rule requires ≥2 shared words. Protects
  // against collapsing unrelated regional coverage into one bucket.
  it('does not merge two stories that share only one entity word', () => {
    const stories = [
      story('Iran announces new nuclear enrichment facility in Natanz', 90, 1, 'n1'),
      story('Saudi Arabia and Iran resume diplomatic relations', 85, 1, 'n2'),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(result.length, 2, 'unrelated stories sharing only "iran" must stay separate');
  });

  // The existing "US rescues airman" trio (see below) must still
  // stay as ≥2 clusters — the new rules must not over-merge
  // different-angle coverage of the same incident.
});

describe('sharesDistinctiveContent (new secondary merge signal)', () => {
  // The third arg is the "min distinctive shared" threshold.
  // Call sites pass 1 for has-evidence clusters, 2 for singletons /
  // post-pass.
  it('requires ≥2 total shared words regardless of threshold', () => {
    const a = new Set(['iran', 'hormuz', 'blockade']);
    const b = new Set(['iran', 'nuclear', 'enrichment']);
    assert.equal(mod.sharesDistinctiveContent(a, b, 1), false, 'only 1 shared word is not enough');
  });

  it('min=1 merges when 2+ shared AND ≥1 is length ≥5', () => {
    const a = new Set(['iran', 'hormuz', 'closed']);
    const b = new Set(['iran', 'hormuz', 'tanker', 'attack']);
    assert.equal(mod.sharesDistinctiveContent(a, b, 1), true);
  });

  it('min=1 rejects when both shared words are short (<5 chars)', () => {
    const a = new Set(['iran', 'gaza', 'attack']);
    const b = new Set(['iran', 'gaza', 'relief']);
    assert.equal(mod.sharesDistinctiveContent(a, b, 1), false);
  });

  it('min=2 rejects when only one distinctive word is shared (singleton guard)', () => {
    // {iran, airman} — airman is 6 chars (distinctive), iran is 4.
    // Under the singleton rule (need ≥2 distinctive), this fails —
    // prevents unrelated Iran stories from collapsing just because
    // both happen to mention "airman" once.
    const a = new Set(['iran', 'airman', 'rescues']);
    const b = new Set(['iran', 'airman', 'missing']);
    assert.equal(mod.sharesDistinctiveContent(a, b, 2), false);
  });

  it('min=2 accepts when 2+ distinctive words are shared', () => {
    // strait + hormuz + tanker all distinctive ≥5
    const a = new Set(['iran', 'strait', 'hormuz', 'tanker']);
    const b = new Set(['iran', 'strait', 'hormuz', 'blockade']);
    assert.equal(mod.sharesDistinctiveContent(a, b, 2), true);
  });
});
