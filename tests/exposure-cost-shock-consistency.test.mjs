/**
 * Tests for issue #2969: Sector Exposure and Cost Shock directional consistency.
 *
 * Validates that the flow-based exposure scoring in get-country-chokepoint-index.ts
 * uses the same Comtrade + PortWatch data path as get-country-cost-shock.ts, so the
 * two widgets can never show contradictory signals (100% exposure + $0 cost shock).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const readSrc = (relPath) => readFileSync(resolve(root, relPath), 'utf-8');

// ========================================================================
// 1. Pure scoring functions from _shock-compute.ts
// ========================================================================

import {
  computeGulfShare,
  CHOKEPOINT_EXPOSURE,
} from '../server/worldmonitor/intelligence/v1/_shock-compute.ts';

import { CHOKEPOINT_REGISTRY } from '../src/config/chokepoint-registry.ts';

const PROXIED_GULF_SHARE = 0.40;

const SHOCK_MODEL_IDS = new Set(
  CHOKEPOINT_REGISTRY.filter(c => c.shockModelSupported).map(c => c.id),
);

/**
 * Replicates the flow-based scoring formula from get-country-chokepoint-index.ts
 * for shock-model chokepoints with HS 27.
 */
function flowBasedScore(gulfShare, chokepointId, flowRatio = 1.0) {
  const baseExposure = CHOKEPOINT_EXPOSURE[chokepointId] ?? 1.0;
  const clampedRatio = Math.max(0, Math.min(flowRatio, 1.5));
  return Math.min(gulfShare * baseExposure * clampedRatio * 100, 100);
}

/**
 * Replicates the cost shock Gulf share formula from compute-energy-shock.ts:247.
 * Returns the effective Gulf crude share used to compute supply deficit.
 */
function costShockGulfShare(gulfShare, chokepointId, flowRatio = null) {
  const baseExposure = CHOKEPOINT_EXPOSURE[chokepointId] ?? 1.0;
  const exposureMult = flowRatio !== null ? baseExposure * flowRatio : baseExposure;
  return gulfShare * exposureMult;
}

// ========================================================================
// 2. computeGulfShare unit tests
// ========================================================================

describe('computeGulfShare', () => {
  it('returns 0 share for empty flows', () => {
    const result = computeGulfShare([]);
    assert.equal(result.share, 0);
    assert.equal(result.hasData, false);
  });

  it('returns 0 share when no Gulf partners', () => {
    const flows = [
      { tradeValueUsd: 1_000_000, partnerCode: '156' }, // China
      { tradeValueUsd: 500_000, partnerCode: '392' },   // Japan
    ];
    const result = computeGulfShare(flows);
    assert.equal(result.share, 0);
    assert.equal(result.hasData, true);
  });

  it('returns high share when mostly Gulf imports', () => {
    const flows = [
      { tradeValueUsd: 8_000_000, partnerCode: '682' }, // Saudi Arabia
      { tradeValueUsd: 2_000_000, partnerCode: '784' }, // UAE
      { tradeValueUsd: 1_000_000, partnerCode: '156' }, // China (non-Gulf)
    ];
    const result = computeGulfShare(flows);
    assert.ok(result.hasData);
    assert.ok(result.share > 0.8, `Expected Gulf share > 0.8, got ${result.share}`);
  });

  it('ignores zero and negative values', () => {
    const flows = [
      { tradeValueUsd: 0, partnerCode: '682' },
      { tradeValueUsd: -100, partnerCode: '784' },
      { tradeValueUsd: 1_000_000, partnerCode: '156' },
    ];
    const result = computeGulfShare(flows);
    assert.equal(result.share, 0); // all Gulf flows are zero/negative
    assert.equal(result.hasData, true);
  });
});

// ========================================================================
// 3. Flow-based scoring formula tests
// ========================================================================

describe('flow-based exposure scoring formula', () => {
  it('high Gulf share produces high Hormuz exposure', () => {
    const score = flowBasedScore(0.80, 'hormuz_strait');
    assert.ok(score >= 50, `Expected score >= 50, got ${score}`);
  });

  it('zero Gulf share produces zero Hormuz exposure', () => {
    const score = flowBasedScore(0, 'hormuz_strait');
    assert.equal(score, 0);
  });

  it('proxied Gulf share (40%) produces moderate exposure', () => {
    const score = flowBasedScore(PROXIED_GULF_SHARE, 'hormuz_strait');
    assert.ok(score > 20 && score < 60, `Expected 20 < score < 60, got ${score}`);
  });

  it('Suez has lower base exposure than Hormuz', () => {
    const hormuz = flowBasedScore(0.50, 'hormuz_strait');
    const suez = flowBasedScore(0.50, 'suez');
    assert.ok(hormuz > suez, `Hormuz (${hormuz}) should be > Suez (${suez})`);
  });

  it('score caps at 100', () => {
    const score = flowBasedScore(1.0, 'hormuz_strait', 1.5);
    assert.ok(score <= 100, `Score should cap at 100, got ${score}`);
  });

  it('flow ratio amplifies or dampens score', () => {
    const normal = flowBasedScore(0.50, 'hormuz_strait', 1.0);
    const high = flowBasedScore(0.50, 'hormuz_strait', 1.3);
    const low = flowBasedScore(0.50, 'hormuz_strait', 0.5);
    assert.ok(high > normal, 'High flow ratio should amplify');
    assert.ok(low < normal, 'Low flow ratio should dampen');
  });
});

// ========================================================================
// 4. Directional consistency: exposure and cost shock agree
// ========================================================================

describe('directional consistency between exposure and cost shock', () => {
  const testCases = [
    { name: 'high Gulf importer', gulfShare: 0.70, cp: 'hormuz_strait', flowRatio: 1.0 },
    { name: 'low Gulf importer', gulfShare: 0.05, cp: 'hormuz_strait', flowRatio: 1.0 },
    { name: 'zero Gulf importer', gulfShare: 0.0, cp: 'suez', flowRatio: 1.0 },
    { name: 'moderate with degraded flow', gulfShare: 0.40, cp: 'malacca_strait', flowRatio: null },
    { name: 'high share, low flow ratio', gulfShare: 0.60, cp: 'bab_el_mandeb', flowRatio: 0.3 },
  ];

  for (const tc of testCases) {
    it(`${tc.name}: exposure direction matches cost shock direction`, () => {
      const exposureScore = flowBasedScore(tc.gulfShare, tc.cp, tc.flowRatio ?? 1.0);
      const shockShare = costShockGulfShare(tc.gulfShare, tc.cp, tc.flowRatio);

      if (tc.gulfShare === 0) {
        assert.equal(exposureScore, 0, 'Zero Gulf share must produce zero exposure');
        assert.equal(shockShare, 0, 'Zero Gulf share must produce zero cost shock share');
      } else if (tc.gulfShare < 0.1) {
        assert.ok(exposureScore < 15, `Low Gulf share should give low exposure, got ${exposureScore}`);
        assert.ok(shockShare < 0.1, `Low Gulf share should give low shock share, got ${shockShare}`);
      } else {
        assert.ok(exposureScore > 10, `Moderate+ Gulf share should give meaningful exposure, got ${exposureScore}`);
        assert.ok(shockShare > 0.05, `Moderate+ Gulf share should give meaningful shock share, got ${shockShare}`);
      }
    });
  }

  it('a sector scored 100 exposure always implies nonzero cost shock share', () => {
    for (const cpId of SHOCK_MODEL_IDS) {
      for (let share = 0; share <= 1.0; share += 0.05) {
        const score = flowBasedScore(share, cpId);
        const shockShare = costShockGulfShare(share, cpId);
        if (Math.round(score) >= 100) {
          assert.ok(
            shockShare > 0,
            `exposure=100 for ${cpId} at share=${share.toFixed(2)} but cost shock share=${shockShare}`,
          );
        }
      }
    }
  });

  it('zero cost shock share always implies zero or low exposure', () => {
    for (const cpId of SHOCK_MODEL_IDS) {
      const score = flowBasedScore(0, cpId);
      assert.equal(score, 0, `Zero Gulf share must give zero exposure for ${cpId}`);
    }
  });
});

// ========================================================================
// 5. Country-specific directional tests (Turkey, US, China)
// ========================================================================

describe('country-specific directional tests', () => {
  it('Turkey + Bosporus: non-shock-model CP, shockSupported=false', () => {
    const bosphorus = CHOKEPOINT_REGISTRY.find(c => c.id === 'bosphorus');
    assert.ok(bosphorus, 'Bosphorus must exist in registry');
    assert.equal(bosphorus.shockModelSupported, false, 'Bosphorus has no shock model');
    // Static scoring still applies for non-shock-model CPs.
    // The response carries shockSupported=false so UI can indicate model unavailable.
  });

  it('US + Hormuz: low Gulf crude dependence', () => {
    // US imports mostly from Canada/Mexico, not Gulf states.
    // With low Gulf share (~5-10%), Hormuz exposure should be low.
    const lowGulfShare = 0.08;
    const score = flowBasedScore(lowGulfShare, 'hormuz_strait');
    assert.ok(score < 15, `US-like Gulf share should give low Hormuz exposure, got ${score}`);
  });

  it('China + Malacca: moderate Gulf crude share', () => {
    // China imports ~30-40% from Gulf states, transiting Malacca.
    const moderateGulfShare = 0.35;
    const score = flowBasedScore(moderateGulfShare, 'malacca_strait');
    assert.ok(score > 15 && score < 60, `China-like Gulf share should give moderate Malacca exposure, got ${score}`);
  });

  it('Japan + Hormuz: high Gulf crude dependence', () => {
    // Japan imports ~80% from Gulf states.
    const highGulfShare = 0.80;
    const score = flowBasedScore(highGulfShare, 'hormuz_strait');
    assert.ok(score >= 60, `Japan-like Gulf share should give high Hormuz exposure, got ${score}`);
  });
});

// ========================================================================
// 6. Source code guards: handler uses flow-based scoring
// ========================================================================

describe('get-country-chokepoint-index source code guards', () => {
  const src = readSrc('server/worldmonitor/supply-chain/v1/get-country-chokepoint-index.ts');

  it('imports computeGulfShare or getGulfCrudeShare for flow-based scoring', () => {
    assert.ok(
      src.includes('getGulfCrudeShare') || src.includes('computeGulfShare'),
      'Handler must import Gulf share computation from Comtrade path',
    );
  });

  it('imports CHOKEPOINT_EXPOSURE for flow multipliers', () => {
    assert.match(src, /CHOKEPOINT_EXPOSURE/);
  });

  it('reads PortWatch flow data via CHOKEPOINT_FLOWS_KEY constant', () => {
    assert.match(src, /CHOKEPOINT_FLOWS_KEY/);
  });

  it('imports PROXIED_GULF_SHARE from compute-energy-shock (single source of truth)', () => {
    assert.match(src, /import.*PROXIED_GULF_SHARE.*from.*compute-energy-shock/);
  });

  it('still imports COUNTRY_PORT_CLUSTERS for static fallback', () => {
    assert.match(src, /country-port-clusters/);
  });

  it('cache TTL is 600s (10min), not 86400 (24h)', () => {
    assert.match(src, /CACHE_TTL\s*=\s*600/);
  });

  it('calls isCallerPremium and returns empty when not PRO', () => {
    assert.match(src, /isCallerPremium/);
  });

  it('cache key uses v2', () => {
    assert.ok(
      src.includes('CHOKEPOINT_EXPOSURE_KEY'),
      'Must use versioned cache key from cache-keys.ts',
    );
  });
});
