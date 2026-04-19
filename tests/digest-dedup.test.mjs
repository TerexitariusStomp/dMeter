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
const thresholdConsts = src.match(/const JACCARD_MERGE_THRESHOLD[\s\S]*?const SECONDARY_MERGE_MIN_JACCARD\s*=\s*[0-9.]+;/)?.[0];
const stripSourceSuffix = src.match(/function stripSourceSuffix\(title\) \{[\s\S]*?\n\}/)?.[0];
const extractTitleWords = src.match(/function extractTitleWords\(title\) \{[\s\S]*?\n\}/)?.[0];
const jaccardSimilarity = src.match(/function jaccardSimilarity\(setA, setB\) \{[\s\S]*?\n\}/)?.[0];
const countDistinctiveShared = src.match(/function countDistinctiveShared\([^)]+\) \{[\s\S]*?\n\}/)?.[0];
const countShared = src.match(/function countShared\([^)]+\) \{[\s\S]*?\n\}/)?.[0];
const intersectSets = src.match(/function intersectSets\([^)]+\) \{[\s\S]*?\n\}/)?.[0];
const deduplicateStories = src.match(/function deduplicateStories\(stories\) \{[\s\S]*?^\}/m)?.[0];

assert.ok(STOP_WORDS_BLOCK, 'STOP_WORDS not found in source');
assert.ok(thresholdConsts, 'merge threshold constants not found in source');
assert.ok(stripSourceSuffix, 'stripSourceSuffix not found in source');
assert.ok(extractTitleWords, 'extractTitleWords not found in source');
assert.ok(jaccardSimilarity, 'jaccardSimilarity not found in source');
assert.ok(countDistinctiveShared, 'countDistinctiveShared not found in source');
assert.ok(countShared, 'countShared not found in source');
assert.ok(intersectSets, 'intersectSets not found in source');
assert.ok(deduplicateStories, 'deduplicateStories not found in source');

const mod = {};
new Function('mod', `
  ${STOP_WORDS_BLOCK}
  ${thresholdConsts}
  ${stripSourceSuffix}
  ${extractTitleWords}
  ${jaccardSimilarity}
  ${countDistinctiveShared}
  ${countShared}
  ${intersectSets}
  ${deduplicateStories}
  mod.stripSourceSuffix = stripSourceSuffix;
  mod.extractTitleWords = extractTitleWords;
  mod.jaccardSimilarity = jaccardSimilarity;
  mod.countDistinctiveShared = countDistinctiveShared;
  mod.countShared = countShared;
  mod.intersectSets = intersectSets;
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
  // about the Strait-of-Hormuz closure with wildly different phrasing.
  // At the original Jaccard ≥ 0.55 with frozen cluster words, all 6
  // passed through as distinct. The new rules collapse the high-
  // overlap variants into one cluster. One outlier (the "Defiant
  // message from Iran as vessels attempting to cross Hormuz"
  // headline) has Jaccard 0.13 with the rest and only shares
  // {iran, hormuz} — we intentionally leave that outlier as its own
  // cluster rather than relax the rule further, because relaxing
  // would over-merge genuinely distinct events (see the Russia/
  // Odesa and Iran/oil-price regressions below).
  it('collapses at least 5 of 6 Hormuz wire variants into one cluster', () => {
    const stories = [
      story('Iran says it has closed Strait of Hormuz again over US blockade', 95, 1, 'h02'),
      story('Iran closes Strait of Hormuz again over US blockade and fires on ships', 90, 1, 'h05'),
      story('Defiant message from Iran as vessels attempting to cross Hormuz report gunfire - Reuters', 85, 1, 'h07'),
      story('Middle East crisis live: Iran warns it will close strait of Hormuz if US blockade continues', 80, 1, 'h08'),
      story('Middle East crisis live: Iran says it has closed the strait of Hormuz; tanker reports being attacked', 75, 1, 'h10'),
      story('Middle East crisis live: tanker reports attack as Iran closes strait of Hormuz; French soldier killed in Lebanon', 70, 1, 'h11'),
    ];
    const result = mod.deduplicateStories(stories);
    const largestClusterSize = Math.max(...result.map((r) => r.mergedHashes.length));
    assert.ok(
      largestClusterSize >= 5,
      `expected main Hormuz cluster to absorb ≥5 of 6 variants, got max size ${largestClusterSize}. Clusters: ${result.map((r) => `${r.mergedHashes.length}:${r.title.slice(0, 40)}`).join(' | ')}`,
    );
    // At most 2 clusters survive — the main one plus (possibly) the
    // low-overlap "defiant message" outlier.
    assert.ok(
      result.length <= 2,
      `expected ≤2 clusters, got ${result.length}`,
    );
  });

  // Asymmetry check: low-overlap Hormuz variants must still cluster
  // usefully under reverse processing order. We assert that the
  // majority of the 6 stories end up in the SAME cluster, not that
  // all 6 do (the low-vocab-overlap outlier may still float free
  // depending on order — acceptable given the false-positive
  // trade-off).
  it('Hormuz merge under reverse processing order still collapses a majority into one cluster', () => {
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
    const largestClusterSize = Math.max(...result.map((r) => r.mergedHashes.length));
    assert.ok(
      largestClusterSize >= 4,
      `expected majority of 6 Hormuz stories in one cluster under reverse order, got max size ${largestClusterSize}`,
    );
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

describe('countDistinctiveShared / countShared (merge-rule primitives)', () => {
  it('countShared counts words present in both sets regardless of length', () => {
    const a = new Set(['iran', 'hormuz', 'blockade']);
    const b = new Set(['iran', 'gaza', 'attack']);
    assert.equal(mod.countShared(a, b), 1);
  });

  it('countDistinctiveShared counts ONLY shared words of length ≥5', () => {
    // iran(4) + gaza(4) are shared but short. blockade is not shared.
    const a = new Set(['iran', 'gaza', 'blockade']);
    const b = new Set(['iran', 'gaza', 'relief']);
    assert.equal(mod.countDistinctiveShared(a, b), 0, 'both shared words are short');
    const c = new Set(['iran', 'hormuz', 'strait']);
    const d = new Set(['iran', 'hormuz', 'tanker']);
    assert.equal(mod.countDistinctiveShared(c, d), 1, 'only hormuz(6) is distinctive');
  });

  it('intersectSets returns only words present in both', () => {
    const a = new Set(['a', 'b', 'c', 'd']);
    const b = new Set(['c', 'd', 'e', 'f']);
    const out = mod.intersectSets(a, b);
    assert.deepEqual([...out].sort(), ['c', 'd']);
  });
});

describe('deduplicateStories — P1 false-positive regressions (from PR #3195 review)', () => {
  function story(title, score = 10, hash = undefined) {
    return {
      title,
      currentScore: score,
      mentionCount: 1,
      sources: [],
      severity: 'critical',
      hash: hash ?? title.slice(0, 8),
    };
  }

  // REGRESSION P1-1: two genuinely different Lebanon-French events
  // must NOT collapse just because they share {french, lebanon} —
  // both 5+ chars, but the events differ. The added Jaccard floor
  // for singleton-to-singleton merge rejects this pair.
  it('distinct Lebanon stories sharing only {french, lebanon} stay separate', () => {
    const stories = [
      story('French soldier killed in Lebanon after border fire', 90, 'leb1'),
      story('French envoy arrives in Lebanon for emergency talks', 85, 'leb2'),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(
      result.length,
      2,
      `expected 2 clusters, got ${result.length}: ${result.map((r) => r.title).join(' | ')}`,
    );
  });

  // REGRESSION P1-2: a bridge headline that merges into the Hormuz
  // cluster must NOT pollute the cluster's distinctive-content
  // signature. A separate Lebanon cluster must stay separate —
  // previously the post-pass absorbed it via bridge-injected
  // french/lebanon words in the UNION.
  it('bridge headline does not let Hormuz cluster absorb a Lebanon cluster (core vs union)', () => {
    const stories = [
      // Two pure Hormuz stories so the cluster has ≥2 items.
      story('Iran closes Strait of Hormuz again over US blockade', 95, 'h1'),
      story('Iran says it has closed Strait of Hormuz again over US blockade', 90, 'h2'),
      // Bridge headline — legitimately joins the Hormuz cluster but
      // also mentions a Lebanon sub-topic.
      story('Tanker attacked as Iran closes strait of Hormuz; French soldier killed in Lebanon', 85, 'bridge'),
      // Pure Lebanon story — must stay separate despite the bridge
      // injecting "french" and "lebanon" into the Hormuz UNION.
      story('French envoy arrives in Lebanon for emergency talks', 70, 'leb'),
    ];
    const result = mod.deduplicateStories(stories);
    // Expect 2 clusters: Hormuz (+ bridge) and Lebanon.
    assert.equal(
      result.length,
      2,
      `expected 2 clusters, got ${result.length}: ${result.map((r) => r.title).join(' | ')}`,
    );
    // The Lebanon story must survive as its own cluster — not
    // absorbed into the Hormuz cluster.
    const lebanonCluster = result.find((r) => r.title.includes('envoy'));
    assert.ok(lebanonCluster, 'Lebanon cluster must still exist after post-pass');
  });

  // REGRESSION P1-2 (reverse-order): three-story reproducer the
  // reviewer cited — Hormuz + Lebanon + mixed. The mixed headline
  // is a legitimate bridge and joins one side; the OTHER side must
  // stay separate. Previous buggy head collapsed all three into 1.
  it('three stories Hormuz + Lebanon + mixed resolve to 2 clusters, not 1', () => {
    const stories = [
      story('Iran closes Strait of Hormuz again over US blockade', 90, 'h'),
      story('French soldier killed in Lebanon after border fire', 85, 'leb'),
      story('Tanker attacked as Iran closes strait of Hormuz; French soldier killed in Lebanon', 80, 'mixed'),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(
      result.length,
      2,
      `expected 2 clusters (NOT the buggy 1), got ${result.length}: ${result.map((r) => r.title).join(' | ')}`,
    );
  });

  // REGRESSION (second round of P1 review): three Russia-Kyiv-Odesa
  // stories where the first two ARE the same attack and the third
  // is a separate event. Previous rule ("established cluster merges
  // on 1 distinctive + 2 total shared") collapsed all three via
  // {russia, attack} — both length ≥5 but generic event vocabulary.
  // The new rule applies a Jaccard floor of 0.25, and the Odesa
  // story's Jaccard against the Russia-Kyiv cluster (0.143) is
  // below the floor → stays separate.
  it('Russia Kyiv missile attacks stay separate from Russia Odesa grain attack (generic "attack" not enough)', () => {
    const stories = [
      story('Russia missile attack hits Kyiv apartment block', 95, 'rk1'),
      story('Russia missile attack kills civilians in Kyiv', 90, 'rk2'),
      story('Russia attack disrupts grain exports from Odesa port', 85, 'ro1'),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(
      result.length,
      2,
      `expected 2 clusters (the two Kyiv stories merge, Odesa stays separate), got ${result.length}: ${result.map((r) => r.title).join(' | ')}`,
    );
    // The larger cluster is the Kyiv one.
    const sizes = result.map((r) => r.mergedHashes.length).sort((a, b) => b - a);
    assert.deepEqual(sizes, [2, 1], 'larger cluster has both Kyiv stories');
  });

  // REGRESSION (second round): Iran-nuclear-talks coverage vs an
  // oil-price reaction story sharing {iran, nuclear, talks}. All
  // three words clear the 5-char "distinctive" bar but they're
  // generic diplomatic-event vocabulary. Secondary merge requires
  // Jaccard ≥ 0.25 — the oil-price story's Jaccard against the
  // talks cluster is 0.231, just below the floor.
  it('Iran nuclear talks coverage does not absorb an oil-price-reaction story sharing {iran, nuclear, talks}', () => {
    const stories = [
      story('US Iran nuclear talks resume in Oman', 95, 'nt1'),
      story('US Iran nuclear talks enter second day in Oman', 90, 'nt2'),
      story('Oil price rally accelerates on Iran nuclear talks optimism', 85, 'op1'),
    ];
    const result = mod.deduplicateStories(stories);
    assert.equal(
      result.length,
      2,
      `expected 2 clusters (two talks stories merge, oil-price stays separate), got ${result.length}: ${result.map((r) => r.title).join(' | ')}`,
    );
    const sizes = result.map((r) => r.mergedHashes.length).sort((a, b) => b - a);
    assert.deepEqual(sizes, [2, 1], 'larger cluster has both talks stories');
  });
});
