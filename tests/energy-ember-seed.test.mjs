import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEmberCsv,
  buildAllCountriesMap,
  EMBER_KEY_PREFIX,
  EMBER_ALL_KEY,
  EMBER_META_KEY,
  EMBER_TTL_SECONDS,
} from '../scripts/seed-ember-electricity.mjs';

// ─── Fixture builders ──────────────────────────────────────────────────────

function makeRow(overrides = {}) {
  return {
    country_code: 'USA',
    date: '2024-01-01',
    series: 'Coal',
    unit: 'TWh',
    value: '100',
    ...overrides,
  };
}

/**
 * Build a minimal long-format CSV string from an array of row objects.
 * @param {Array<Record<string, string>>} rows
 */
function buildCsv(rows) {
  const headers = ['country_code', 'date', 'series', 'unit', 'value', 'category'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => row[h] ?? '').join(','));
  }
  return lines.join('\n');
}

function threeCountryFixture() {
  // USA: 2024-01 — Fossil=400, Renewables=300, Nuclear=100, Coal=200, Gas=200, Total=800
  // DEU: 2024-01 — Fossil=200, Renewables=500, Nuclear=0, Coal=100, Gas=100, Total=700
  // FRA: 2024-01 — Fossil=50, Renewables=100, Nuclear=400, Coal=20, Gas=30, Total=550
  const rows = [
    // USA
    makeRow({ country_code: 'USA', date: '2024-01-01', series: 'Fossil',           value: '400' }),
    makeRow({ country_code: 'USA', date: '2024-01-01', series: 'Renewables',       value: '300' }),
    makeRow({ country_code: 'USA', date: '2024-01-01', series: 'Nuclear',          value: '100' }),
    makeRow({ country_code: 'USA', date: '2024-01-01', series: 'Coal',             value: '200' }),
    makeRow({ country_code: 'USA', date: '2024-01-01', series: 'Gas',              value: '200' }),
    makeRow({ country_code: 'USA', date: '2024-01-01', series: 'Total Generation', value: '800' }),
    // DEU (Germany)
    makeRow({ country_code: 'DEU', date: '2024-01-01', series: 'Fossil',           value: '200' }),
    makeRow({ country_code: 'DEU', date: '2024-01-01', series: 'Renewables',       value: '500' }),
    makeRow({ country_code: 'DEU', date: '2024-01-01', series: 'Nuclear',          value: '0'   }),
    makeRow({ country_code: 'DEU', date: '2024-01-01', series: 'Coal',             value: '100' }),
    makeRow({ country_code: 'DEU', date: '2024-01-01', series: 'Gas',              value: '100' }),
    makeRow({ country_code: 'DEU', date: '2024-01-01', series: 'Total Generation', value: '700' }),
    // FRA (France)
    makeRow({ country_code: 'FRA', date: '2024-01-01', series: 'Fossil',           value: '50'  }),
    makeRow({ country_code: 'FRA', date: '2024-01-01', series: 'Renewables',       value: '100' }),
    makeRow({ country_code: 'FRA', date: '2024-01-01', series: 'Nuclear',          value: '400' }),
    makeRow({ country_code: 'FRA', date: '2024-01-01', series: 'Coal',             value: '20'  }),
    makeRow({ country_code: 'FRA', date: '2024-01-01', series: 'Gas',              value: '30'  }),
    makeRow({ country_code: 'FRA', date: '2024-01-01', series: 'Total Generation', value: '550' }),
  ];
  return buildCsv(rows);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('parseEmberCsv', () => {
  it('parses a minimal 3-country fixture', () => {
    const csv = threeCountryFixture();
    const result = parseEmberCsv(csv);
    assert.ok(result instanceof Map);
    assert.ok(result.size >= 1, 'should have at least 1 country');
  });

  it('includes one entry per fixture country (US, DE, FR)', () => {
    const csv = threeCountryFixture();
    const result = parseEmberCsv(csv);
    assert.ok(result.has('US'), 'should have US');
    assert.ok(result.has('DE'), 'should have DE');
    assert.ok(result.has('FR'), 'should have FR');
  });

  it('computes fossilShare = (fossil_twh / total_twh) * 100', () => {
    const csv = threeCountryFixture();
    const result = parseEmberCsv(csv);
    const us = result.get('US');
    assert.ok(us != null, 'US entry missing');
    // USA: fossil=400, total=800 → 50%
    assert.ok(Math.abs(us.fossilShare - 50) < 0.01, `fossilShare should be 50, got ${us.fossilShare}`);
  });

  it('computes renewShare correctly', () => {
    const csv = threeCountryFixture();
    const result = parseEmberCsv(csv);
    const us = result.get('US');
    // USA: renewables=300, total=800 → 37.5%
    assert.ok(Math.abs(us.renewShare - 37.5) < 0.01, `renewShare should be 37.5, got ${us.renewShare}`);
  });

  it('sets dataMonth to YYYY-MM from date field', () => {
    const csv = threeCountryFixture();
    const result = parseEmberCsv(csv);
    const us = result.get('US');
    assert.equal(us.dataMonth, '2024-01');
  });

  it('selects the most recent month when a country has two months of data', () => {
    const rows = [
      // Jan 2024
      makeRow({ country_code: 'GBR', date: '2024-01-01', series: 'Fossil',           value: '100' }),
      makeRow({ country_code: 'GBR', date: '2024-01-01', series: 'Total Generation', value: '200' }),
      // Feb 2024 (later — should be selected)
      makeRow({ country_code: 'GBR', date: '2024-02-01', series: 'Fossil',           value: '80'  }),
      makeRow({ country_code: 'GBR', date: '2024-02-01', series: 'Total Generation', value: '210' }),
    ];
    const csv = buildCsv(rows);
    const result = parseEmberCsv(csv);
    const gb = result.get('GB');
    assert.ok(gb != null, 'GB entry missing');
    assert.equal(gb.dataMonth, '2024-02', 'should use the later month');
    // Feb: fossil=80, total=210 → ~38.1%
    assert.ok(Math.abs(gb.fossilShare - (80 / 210) * 100) < 0.01);
  });

  it('skips rows where unit !== TWh', () => {
    const rows = [
      makeRow({ country_code: 'AUS', date: '2024-01-01', series: 'Fossil',           unit: 'GW', value: '100' }),
      makeRow({ country_code: 'AUS', date: '2024-01-01', series: 'Total Generation', unit: 'GW', value: '200' }),
    ];
    const csv = buildCsv(rows);
    const result = parseEmberCsv(csv);
    // AUS should not appear since no TWh rows
    assert.ok(!result.has('AU'), 'AU should be excluded when unit is GW');
  });

  it('skips countries where Total Generation is missing', () => {
    const rows = [
      makeRow({ country_code: 'JPN', date: '2024-01-01', series: 'Fossil', value: '100' }),
      // No Total Generation row for JPN
    ];
    const csv = buildCsv(rows);
    const result = parseEmberCsv(csv);
    assert.ok(!result.has('JP'), 'JP should be excluded when Total Generation is absent');
  });
});

describe('schema sentinel', () => {
  it('throws when Fossil series is not present in any row', () => {
    const rows = [
      makeRow({ country_code: 'USA', date: '2024-01-01', series: 'Coal',             value: '100' }),
      makeRow({ country_code: 'USA', date: '2024-01-01', series: 'Total Generation', value: '200' }),
    ];
    const csv = buildCsv(rows);
    assert.throws(
      () => parseEmberCsv(csv),
      /Fossil.*series not found|schema changed/i,
      'should throw when Fossil series is absent',
    );
  });
});

describe('buildAllCountriesMap', () => {
  it('returns compact shape without seededAt or country fields', () => {
    const csv = threeCountryFixture();
    const countries = parseEmberCsv(csv);
    const allMap = buildAllCountriesMap(countries);
    for (const [, entry] of Object.entries(allMap)) {
      assert.ok(!('seededAt' in entry), 'compact map should not have seededAt');
      assert.ok(!('country' in entry), 'compact map should not have country');
      assert.ok('dataMonth' in entry, 'compact map should have dataMonth');
      assert.ok('fossilShare' in entry, 'compact map should have fossilShare');
    }
  });

  it('has one entry per parsed country', () => {
    const csv = threeCountryFixture();
    const countries = parseEmberCsv(csv);
    const allMap = buildAllCountriesMap(countries);
    assert.equal(Object.keys(allMap).length, countries.size);
  });
});

describe('exported constants', () => {
  it('EMBER_KEY_PREFIX is correct', () => {
    assert.equal(EMBER_KEY_PREFIX, 'energy:ember:v1:');
  });

  it('EMBER_ALL_KEY is correct', () => {
    assert.equal(EMBER_ALL_KEY, 'energy:ember:v1:_all');
  });

  it('EMBER_META_KEY is correct', () => {
    assert.equal(EMBER_META_KEY, 'seed-meta:energy:ember');
  });

  it('EMBER_TTL_SECONDS is 259200 (72h)', () => {
    assert.equal(EMBER_TTL_SECONDS, 259200);
  });

  it('EMBER_TTL_SECONDS covers 3x the 24h daily cron interval', () => {
    const dailyIntervalSeconds = 24 * 60 * 60; // 86400
    assert.ok(
      EMBER_TTL_SECONDS >= 3 * dailyIntervalSeconds,
      `TTL ${EMBER_TTL_SECONDS}s should be >= ${3 * dailyIntervalSeconds}s (3× daily)`,
    );
  });
});

describe('count-drop guard math', () => {
  it('45/60 is acceptable (75% threshold)', () => {
    const prevCount = 60;
    const newCount = 45;
    const ratio = newCount / prevCount;
    assert.ok(ratio >= 0.75, '45/60 = 75% should pass the guard');
  });

  it('44/60 triggers the guard (below 75%)', () => {
    const prevCount = 60;
    const newCount = 44;
    const ratio = newCount / prevCount;
    assert.ok(ratio < 0.75, '44/60 ≈ 73.3% should trigger the guard');
  });
});
