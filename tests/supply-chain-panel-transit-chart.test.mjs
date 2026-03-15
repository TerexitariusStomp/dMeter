import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const panelSrc = readFileSync(resolve(root, 'src', 'components', 'SupplyChainPanel.ts'), 'utf-8');

function extractMethodBody(source, methodName) {
  const signature = new RegExp(`(?:private\\s+|public\\s+)?${methodName}\\s*\\([^)]*\\)\\s*(?::[^\\{]+)?\\{`);
  const match = signature.exec(source);
  if (!match) throw new Error(`Could not find ${methodName} in source`);

  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let state = 'code';
  let escaped = false;

  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'line-comment') {
      if (ch === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
      continue;
    }
    if (state === 'single-quote') {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '\'') state = 'code';
      continue;
    }
    if (state === 'double-quote') {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') state = 'code';
      continue;
    }
    if (state === 'template') {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '`') state = 'code';
      continue;
    }

    if (ch === '/' && next === '/') {
      state = 'line-comment';
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      state = 'block-comment';
      i += 1;
      continue;
    }
    if (ch === '\'') {
      state = 'single-quote';
      continue;
    }
    if (ch === '"') {
      state = 'double-quote';
      continue;
    }
    if (ch === '`') {
      state = 'template';
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart, i);
    }
  }

  throw new Error(`Could not extract body for ${methodName}`);
}

function createFakeTimers(startMs = 1_000) {
  const tasks = new Map();
  let now = startMs;
  let nextId = 1;

  return {
    setTimeout(fn, delay = 0) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, { at: now + Math.max(0, delay), fn });
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
    advanceBy(ms) {
      const target = now + Math.max(0, ms);
      while (true) {
        const due = Array.from(tasks.entries())
          .filter(([, task]) => task.at <= target)
          .sort((a, b) => (a[1].at - b[1].at) || (a[0] - b[0]))[0];
        if (!due) break;
        const [id, task] = due;
        tasks.delete(id);
        now = task.at;
        task.fn();
      }
      now = target;
    },
    has(id) {
      return tasks.has(id);
    },
  };
}

function createMutationObserverHarness() {
  const observers = [];

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }

    observe(target, options) {
      this.target = target;
      this.options = options;
    }

    disconnect() {
      this.disconnected = true;
    }
  }

  return { FakeMutationObserver, observers };
}

function buildRender({ timers, MutationObserver }) {
  const methodBody = extractMethodBody(panelSrc, 'render')
    .replace(/ as HTMLElement \| null/g, '')
    .replace(/\(\): boolean =>/g, '() =>');
  const factory = new Function('MutationObserver', 'setTimeout', 'clearTimeout', 't', `
    return function render() {
      ${methodBody}
    };
  `);

  return factory(
    MutationObserver,
    timers.setTimeout.bind(timers),
    timers.clearTimeout.bind(timers),
    (key) => key
  );
}

function buildClearTransitChart({ timers }) {
  const methodBody = extractMethodBody(panelSrc, 'clearTransitChart');
  const factory = new Function('clearTimeout', `
    return function clearTransitChart() {
      ${methodBody}
    };
  `);
  return factory(timers.clearTimeout.bind(timers));
}

function createPanelContext() {
  const placeholder = { nodeType: 1 };
  return {
    activeTab: 'chokepoints',
    expandedChokepoint: 'Suez Canal',
    chokepointData: {
      chokepoints: [{
        name: 'Suez Canal',
        disruptionScore: 90,
        status: 'red',
        activeWarnings: 2,
        aisDisruptions: 1,
        congestionLevel: 'high',
        description: 'Test chokepoint',
        affectedRoutes: ['Asia-Europe'],
        transitSummary: {
          history: [{ date: '2026-03-15', tanker: 4, cargo: 8 }],
          todayTotal: 12,
          todayTanker: 4,
          todayCargo: 8,
          todayOther: 0,
          wowChangePct: 3.2,
          riskLevel: 'high',
          incidentCount7d: 1,
          riskSummary: 'Elevated risk',
          riskReportAction: 'Reroute if needed',
        },
      }],
      upstreamUnavailable: false,
    },
    shippingData: null,
    mineralsData: null,
    content: {
      querySelector(selector) {
        return selector === '[data-chart-cp="Suez Canal"]' ? placeholder : null;
      },
    },
    transitChart: {
      mounts: [],
      destroyCalls: 0,
      mount(el, history) {
        this.mounts.push({ el, history });
      },
      destroy() {
        this.destroyCalls += 1;
      },
    },
    chartObserver: null,
    chartMountTimer: null,
    clearTransitChart() {
      throw new Error('clearTransitChart stub must be replaced');
    },
    renderChokepoints() {
      return '<div data-chart-cp="Suez Canal"></div>';
    },
    renderShipping() {
      return '<div></div>';
    },
    renderMinerals() {
      return '<div></div>';
    },
    setContent(html) {
      this.lastContentHtml = html;
    },
  };
}

describe('SupplyChainPanel transit chart mount behavior', () => {
  let timers;

  beforeEach(() => {
    timers = createFakeTimers();
  });

  afterEach(() => {
    timers.advanceBy(1_000);
  });

  it('mounts the transit chart via fallback timer when render is a no-op', () => {
    const { FakeMutationObserver, observers } = createMutationObserverHarness();
    const render = buildRender({ timers, MutationObserver: FakeMutationObserver });
    const ctx = createPanelContext();
    ctx.clearTransitChart = buildClearTransitChart({ timers }).bind(ctx);

    render.call(ctx);

    assert.equal(observers.length, 1, 'expected a mutation observer to be registered');
    assert.equal(ctx.transitChart.mounts.length, 0, 'chart should not mount synchronously before timer fires');
    assert.ok(ctx.chartMountTimer, 'expected fallback timer to be scheduled');

    timers.advanceBy(219);
    assert.equal(ctx.transitChart.mounts.length, 0, 'fallback should wait the full delay');

    timers.advanceBy(1);
    assert.equal(ctx.transitChart.mounts.length, 1, 'fallback timer should mount chart when no mutation arrives');
    assert.equal(observers[0].disconnected, true, 'fallback mount should disconnect the observer');
    assert.equal(ctx.chartMountTimer, null, 'timer handle should be cleared after fallback mount');
  });

  it('clearTransitChart cancels a pending fallback timer before it fires', () => {
    const { FakeMutationObserver } = createMutationObserverHarness();
    const render = buildRender({ timers, MutationObserver: FakeMutationObserver });
    const clearTransitChart = buildClearTransitChart({ timers });
    const ctx = createPanelContext();
    ctx.clearTransitChart = clearTransitChart.bind(ctx);

    render.call(ctx);

    const pendingTimerId = ctx.chartMountTimer;
    assert.ok(pendingTimerId, 'expected render to schedule a timer');
    assert.equal(timers.has(pendingTimerId), true, 'scheduled timer should still be pending');

    clearTransitChart.call(ctx);

    assert.equal(ctx.chartMountTimer, null, 'clearTransitChart should drop the timer handle');
    assert.equal(timers.has(pendingTimerId), false, 'clearTransitChart should cancel the pending timer');
    assert.equal(ctx.transitChart.destroyCalls, 2, 'chart destroy should run once from render pre-clear and once from explicit clear');
  });
});
