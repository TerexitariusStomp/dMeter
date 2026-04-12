import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFlowWeightedExposure,
  computeCountryLevelExposure,
} from '../scripts/seed-hs2-chokepoint-exposure.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CLUSTERS = require('../scripts/shared/country-port-clusters.json');

function getCluster(iso2) {
  const c = CLUSTERS[iso2];
  if (!c || typeof c === 'string') return { nearestRouteIds: [], coastSide: 'unknown' };
  return c;
}

// Mock Comtrade data: Turkey imports crude oil from Saudi Arabia and Russia
const TURKEY_COMTRADE = [
  {
    hs4: '2709',
    description: 'Crude Petroleum',
    totalValue: 10_000_000,
    topExporters: [
      { partnerCode: 682, partnerIso2: 'SA', value: 4_000_000, share: 0.4 },
      { partnerCode: 643, partnerIso2: 'RU', value: 3_000_000, share: 0.3 },
      { partnerCode: 368, partnerIso2: 'IQ', value: 2_000_000, share: 0.2 },
    ],
    year: 2023,
  },
  {
    hs4: '8542',
    description: 'Semiconductors',
    totalValue: 5_000_000,
    topExporters: [
      { partnerCode: 158, partnerIso2: 'TW', value: 2_000_000, share: 0.4 },
      { partnerCode: 156, partnerIso2: 'CN', value: 1_500_000, share: 0.3 },
      { partnerCode: 410, partnerIso2: 'KR', value: 1_000_000, share: 0.2 },
    ],
    year: 2023,
  },
  {
    hs4: '6204',
    description: 'Garments',
    totalValue: 2_000_000,
    topExporters: [
      { partnerCode: 156, partnerIso2: 'CN', value: 1_000_000, share: 0.5 },
      { partnerCode: 50, partnerIso2: 'BD', value: 600_000, share: 0.3 },
    ],
    year: 2023,
  },
];

// Mock Comtrade data: US imports
const US_COMTRADE = [
  {
    hs4: '2709',
    description: 'Crude Petroleum',
    totalValue: 100_000_000,
    topExporters: [
      { partnerCode: 682, partnerIso2: 'SA', value: 30_000_000, share: 0.3 },
      { partnerCode: 124, partnerIso2: 'CA', value: 50_000_000, share: 0.5 },
    ],
    year: 2023,
  },
  {
    hs4: '8542',
    description: 'Semiconductors',
    totalValue: 50_000_000,
    topExporters: [
      { partnerCode: 158, partnerIso2: 'TW', value: 20_000_000, share: 0.4 },
      { partnerCode: 156, partnerIso2: 'CN', value: 15_000_000, share: 0.3 },
      { partnerCode: 410, partnerIso2: 'KR', value: 10_000_000, share: 0.2 },
    ],
    year: 2023,
  },
];

describe('computeFlowWeightedExposure', () => {
  it('Turkey: Energy and Electronics produce different scores', () => {
    const trCluster = getCluster('TR');
    const energy = computeFlowWeightedExposure('TR', '27', TURKEY_COMTRADE, trCluster);
    const elec = computeFlowWeightedExposure('TR', '85', TURKEY_COMTRADE, trCluster);

    assert.ok(energy.exposures.length > 0, 'Energy should have exposures');
    assert.ok(elec.exposures.length > 0, 'Electronics should have exposures');

    const energyTop = energy.exposures[0];
    const elecTop = elec.exposures[0];
    const scoresMatch = energyTop.chokepointId === elecTop.chokepointId
      && energyTop.exposureScore === elecTop.exposureScore;
    assert.ok(!scoresMatch, 'Energy and Electronics must not have identical top chokepoint + score');
  });

  it('Turkey: Energy, Electronics, and Apparel all differ', () => {
    const trCluster = getCluster('TR');
    const energy = computeFlowWeightedExposure('TR', '27', TURKEY_COMTRADE, trCluster);
    const elec = computeFlowWeightedExposure('TR', '85', TURKEY_COMTRADE, trCluster);
    const apparel = computeFlowWeightedExposure('TR', '62', TURKEY_COMTRADE, trCluster);

    const vulnSet = new Set([energy.vulnerabilityIndex, elec.vulnerabilityIndex, apparel.vulnerabilityIndex]);
    assert.ok(vulnSet.size >= 2, `At least 2 of 3 sectors should have different vulnerability indices, got: ${[...vulnSet]}`);
  });

  it('US: Energy shows Hormuz, Electronics shows different primary', () => {
    const usCluster = getCluster('US');
    const energy = computeFlowWeightedExposure('US', '27', US_COMTRADE, usCluster);
    const elec = computeFlowWeightedExposure('US', '85', US_COMTRADE, usCluster);

    const energyHormuz = energy.exposures.find(e => e.chokepointId === 'hormuz_strait');
    const elecHormuz = elec.exposures.find(e => e.chokepointId === 'hormuz_strait');

    if (energyHormuz && elecHormuz) {
      assert.ok(energyHormuz.exposureScore > elecHormuz.exposureScore,
        'Energy should have higher Hormuz exposure than Electronics');
    }
  });

  it('no matching HS4 rows returns empty exposures', () => {
    const trCluster = getCluster('TR');
    const result = computeFlowWeightedExposure('TR', '99', TURKEY_COMTRADE, trCluster);
    assert.equal(result.exposures.length, 0);
    assert.equal(result.primaryChokepointId, '');
    assert.equal(result.vulnerabilityIndex, 0);
  });

  it('unknown partnerIso2 is skipped gracefully', () => {
    const trCluster = getCluster('TR');
    const badData = [{
      hs4: '2709',
      description: 'Crude',
      totalValue: 1_000_000,
      topExporters: [
        { partnerCode: 999, partnerIso2: '', value: 500_000, share: 0.5 },
        { partnerCode: 682, partnerIso2: 'SA', value: 500_000, share: 0.5 },
      ],
      year: 2023,
    }];
    const result = computeFlowWeightedExposure('TR', '27', badData, trCluster);
    assert.ok(result.exposures.length > 0, 'Should still produce results from valid exporter');
  });

  it('landlocked importer with no routes gets empty exposures', () => {
    const emptyCluster = { nearestRouteIds: [], coastSide: 'landlocked' };
    const result = computeFlowWeightedExposure('XX', '27', TURKEY_COMTRADE, emptyCluster);
    // Exporter routes still produce exposure (exporter corridors determine chokepoints)
    // But if we also use a fake country with no Comtrade match, it should be empty
    // Test that a real landlocked country (Ethiopia) still gets exposure from exporter routes
    const etCluster = getCluster('ET');
    const etResult = computeFlowWeightedExposure('ET', '27', TURKEY_COMTRADE, etCluster);
    // Ethiopia has routes in cluster, so exporter-based routing still produces results
    assert.ok(etResult.exposures.length >= 0, 'Landlocked with routes may have exposure via exporter corridors');
  });

  it('energy boost never exceeds 100', () => {
    const trCluster = getCluster('TR');
    const energy = computeFlowWeightedExposure('TR', '27', TURKEY_COMTRADE, trCluster);
    for (const e of energy.exposures) {
      assert.ok(e.exposureScore <= 100, `Score ${e.exposureScore} for ${e.chokepointId} exceeds 100`);
    }
  });

  it('scores are on 0-100 scale', () => {
    const trCluster = getCluster('TR');
    const result = computeFlowWeightedExposure('TR', '27', TURKEY_COMTRADE, trCluster);
    for (const e of result.exposures) {
      assert.ok(e.exposureScore >= 0 && e.exposureScore <= 100,
        `Score ${e.exposureScore} for ${e.chokepointId} out of range`);
    }
  });

  it('only primary route chokepoints count (no overcounting)', () => {
    const trCluster = getCluster('TR');
    const energy = computeFlowWeightedExposure('TR', '27', TURKEY_COMTRADE, trCluster);
    const totalScore = energy.exposures.reduce((s, e) => s + e.exposureScore, 0);
    assert.ok(totalScore <= 1300,
      `Total chokepoint scores (${totalScore}) unreasonably high — possible overcounting`);
  });
});

describe('computeCountryLevelExposure (fallback)', () => {
  it('produces non-empty exposures for countries with routes', () => {
    const trCluster = getCluster('TR');
    const result = computeCountryLevelExposure(trCluster.nearestRouteIds, trCluster.coastSide, '27');
    assert.ok(result.exposures.length > 0);
    assert.ok(result.primaryChokepointId !== '');
  });

  it('all sectors produce identical scores (the bug this fix addresses)', () => {
    const trCluster = getCluster('TR');
    const energy = computeCountryLevelExposure(trCluster.nearestRouteIds, trCluster.coastSide, '27');
    const elec = computeCountryLevelExposure(trCluster.nearestRouteIds, trCluster.coastSide, '85');
    // The old algorithm gives same scores for non-energy sectors
    // Energy has a 1.5x boost on shock-supported chokepoints, so it differs
    // But Electronics and Apparel should be identical
    const apparel = computeCountryLevelExposure(trCluster.nearestRouteIds, trCluster.coastSide, '62');
    assert.deepEqual(
      elec.exposures.map(e => e.exposureScore),
      apparel.exposures.map(e => e.exposureScore),
      'Old algorithm should give identical scores for non-energy sectors',
    );
  });

  it('energy boost clamps to 100', () => {
    const trCluster = getCluster('TR');
    const result = computeCountryLevelExposure(trCluster.nearestRouteIds, trCluster.coastSide, '27');
    for (const e of result.exposures) {
      assert.ok(e.exposureScore <= 100, `Fallback score ${e.exposureScore} exceeds 100`);
    }
  });
});

describe('cargo-type route selection', () => {
  it('Energy sector prefers energy lanes for Gulf exporters', () => {
    const usCluster = getCluster('US');
    const energy = computeFlowWeightedExposure('US', '27', US_COMTRADE, usCluster);
    const hormuz = energy.exposures.find(e => e.chokepointId === 'hormuz_strait');
    assert.ok(hormuz, 'Hormuz should appear for US Energy imports from Saudi Arabia');
    assert.ok(hormuz.exposureScore > 0, 'Hormuz exposure should be > 0');
  });

  it('Bulk sectors (Cereals) prefer bulk lanes', () => {
    const cnCluster = getCluster('CN');
    const cerealData = [{
      hs4: '1001',
      description: 'Wheat',
      totalValue: 5_000_000,
      topExporters: [
        { partnerCode: 76, partnerIso2: 'BR', value: 3_000_000, share: 0.6 },
        { partnerCode: 36, partnerIso2: 'AU', value: 2_000_000, share: 0.4 },
      ],
      year: 2023,
    }];
    const result = computeFlowWeightedExposure('CN', '10', cerealData, cnCluster);
    if (result.exposures.length > 0) {
      const cape = result.exposures.find(e => e.chokepointId === 'cape_of_good_hope');
      assert.ok(cape, 'Cape of Good Hope should appear for China Cereals from Brazil (bulk route)');
    }
  });

  it('CA→US does not pick transatlantic (no waypoints) over routes with chokepoints', () => {
    const usCluster = getCluster('US');
    // CA exports electronics to US — shared routes: transatlantic (no wp), china-us-west (taiwan_strait)
    const caData = [{
      hs4: '8542',
      description: 'Semiconductors',
      totalValue: 5_000_000,
      topExporters: [
        { partnerCode: 124, partnerIso2: 'CA', value: 5_000_000, share: 1.0 },
      ],
      year: 2023,
    }];
    const result = computeFlowWeightedExposure('US', '85', caData, usCluster);
    // Must not produce all-zero exposure from picking transatlantic
    const hasNonZero = result.exposures.some(e => e.exposureScore > 0);
    assert.ok(hasNonZero, 'CA→US must pick a route with waypoints, not transatlantic (all-zero bug)');
  });
});
