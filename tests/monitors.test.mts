import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyMonitorHighlightsToNews,
  evaluateMonitorMatches,
  normalizeMonitor,
  prepareMonitorsForRuntime,
} from '../src/services/monitors.ts';
import type { Monitor } from '../src/types/index.ts';

describe('normalizeMonitor', () => {
  it('migrates legacy keyword monitors into the richer rule shape', () => {
    const monitor = normalizeMonitor({
      id: 'legacy',
      keywords: ['Iran', ' Hormuz '],
      color: '#fff',
    } as Monitor);

    assert.deepEqual(monitor.keywords, ['iran', 'hormuz']);
    assert.deepEqual(monitor.includeKeywords, ['iran', 'hormuz']);
    assert.deepEqual(monitor.excludeKeywords, []);
    assert.deepEqual(monitor.sources, ['news']);
    assert.equal(monitor.matchMode, 'any');
    assert.ok(monitor.name);
  });
});

describe('prepareMonitorsForRuntime', () => {
  it('strips pro-only rule features for free runtime execution', () => {
    const runtime = prepareMonitorsForRuntime([{
      id: 'm1',
      name: 'Hormuz',
      keywords: ['hormuz'],
      includeKeywords: ['hormuz'],
      excludeKeywords: ['analysis'],
      sources: ['news', 'advisories', 'cross-source'],
      color: '#0f0',
    }], false);

    assert.equal(runtime.length, 1);
    assert.deepEqual(runtime[0]?.excludeKeywords, []);
    assert.deepEqual(runtime[0]?.sources, ['news']);
  });
});

describe('evaluateMonitorMatches', () => {
  it('matches across news, advisories, and cross-source feeds when pro access is enabled', () => {
    const monitor: Monitor = {
      id: 'm1',
      name: 'Hormuz Watch',
      keywords: ['hormuz'],
      includeKeywords: ['hormuz'],
      sources: ['news', 'advisories', 'cross-source'],
      color: '#0f0',
    };

    const matches = evaluateMonitorMatches([monitor], {
      news: [{
        source: 'Reuters',
        title: 'Shipping insurance rises near Hormuz',
        link: 'https://example.com/hormuz-news',
        pubDate: new Date('2026-03-28T10:00:00Z'),
        isAlert: true,
      }],
      advisories: [{
        title: 'Travel advisory updated for Strait of Hormuz transits',
        link: 'https://example.com/hormuz-advisory',
        pubDate: new Date('2026-03-28T11:00:00Z'),
        source: 'UK FCDO',
        sourceCountry: 'GB',
        country: 'OM',
        level: 'reconsider',
      }],
      crossSourceSignals: [{
        id: 'sig-1',
        type: 'CROSS_SOURCE_SIGNAL_TYPE_SHIPPING_DISRUPTION',
        theater: 'Strait of Hormuz',
        summary: 'Composite shipping disruption detected around Hormuz traffic lanes.',
        severity: 'CROSS_SOURCE_SIGNAL_SEVERITY_HIGH',
        severityScore: 82,
        detectedAt: Date.parse('2026-03-28T12:00:00Z'),
        contributingTypes: ['shipping_disruption', 'market_stress'],
        signalCount: 2,
      }],
    }, { proAccess: true });

    assert.equal(matches.length, 3);
    assert.deepEqual(matches.map((match) => match.sourceKind), ['cross-source', 'advisories', 'news']);
  });

  it('honors exclude keywords when pro access is enabled', () => {
    const monitor: Monitor = {
      id: 'm2',
      name: 'Iran hard match',
      keywords: ['iran'],
      includeKeywords: ['iran'],
      excludeKeywords: ['opinion'],
      sources: ['news'],
      color: '#f00',
    };

    const matches = evaluateMonitorMatches([monitor], {
      news: [{
        source: 'Example',
        title: 'Opinion: Iran strategy is shifting',
        link: 'https://example.com/opinion',
        pubDate: new Date('2026-03-28T10:00:00Z'),
        isAlert: false,
      }],
    }, { proAccess: true });

    assert.equal(matches.length, 0);
  });

  it('matches close word derivatives for broad monitor terms', () => {
    const monitor: Monitor = {
      id: 'm3',
      name: 'Iran broad',
      keywords: ['iran'],
      includeKeywords: ['iran'],
      sources: ['news'],
      color: '#00f',
    };

    const matches = evaluateMonitorMatches([monitor], {
      news: [{
        source: 'Example',
        title: 'Iranian shipping patterns shift after new sanctions',
        link: 'https://example.com/iranian-shipping',
        pubDate: new Date('2026-03-28T10:00:00Z'),
        isAlert: false,
      }],
    }, { proAccess: false });

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.matchedTerms[0], 'iran');
  });
});

describe('applyMonitorHighlightsToNews', () => {
  it('annotates matched news items with monitor colors and clears unmatched colors', () => {
    const monitor: Monitor = {
      id: 'm4',
      name: 'China Watch',
      keywords: ['china'],
      includeKeywords: ['china'],
      sources: ['news'],
      color: '#abc',
    };

    const highlighted = applyMonitorHighlightsToNews([monitor], [
      {
        source: 'Example',
        title: 'China export controls tighten',
        link: 'https://example.com/china',
        pubDate: new Date('2026-03-28T10:00:00Z'),
        isAlert: false,
      },
      {
        source: 'Example',
        title: 'Brazil soybean crop outlook improves',
        link: 'https://example.com/brazil',
        pubDate: new Date('2026-03-28T10:00:00Z'),
        isAlert: false,
        monitorColor: '#stale',
      },
    ], { proAccess: false });

    assert.equal(highlighted[0]?.monitorColor, '#abc');
    assert.equal(highlighted[1]?.monitorColor, undefined);
  });
});
