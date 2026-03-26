#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const KEY = 'market:earnings-calendar:v1';
const TTL = 129600; // 36h — 3× a 12h cron interval

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchAll() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.warn('  FINNHUB_API_KEY not set — skipping');
    return { earnings: [], unavailable: true };
  }

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);

  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${toDateStr(from)}&to=${toDateStr(to)}`;

  const resp = await fetch(url, {
    headers: { 'User-Agent': CHROME_UA, 'X-Finnhub-Token': apiKey },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(`Finnhub earnings calendar HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const raw = Array.isArray(data?.earningsCalendar) ? data.earningsCalendar : [];

  const earnings = raw
    .filter(e => e.symbol)
    .map(e => {
      const epsEst = e.epsEstimate != null ? Number(e.epsEstimate) : null;
      const epsAct = e.epsActual != null ? Number(e.epsActual) : null;
      const revEst = e.revenueEstimate != null ? Number(e.revenueEstimate) : null;
      const revAct = e.revenueActual != null ? Number(e.revenueActual) : null;
      const hasActuals = epsAct != null;
      let surpriseDirection = '';
      if (hasActuals && epsEst != null) {
        if (epsAct > epsEst) surpriseDirection = 'beat';
        else if (epsAct < epsEst) surpriseDirection = 'miss';
      }
      return {
        symbol: String(e.symbol),
        company: e.name ? String(e.name) : String(e.symbol),
        date: e.date ? String(e.date) : '',
        hour: e.hour ? String(e.hour) : '',
        epsEstimate: epsEst,
        revenueEstimate: revEst,
        epsActual: epsAct,
        revenueActual: revAct,
        hasActuals,
        surpriseDirection,
      };
    })
    // Keep companies with meaningful analyst coverage:
    // - revenue estimate >= $10M (eliminates micro/nano-caps with near-zero revenue)
    // - OR no revenue estimate but |EPS estimate| >= $0.10 (financials, REITs, etc.)
    .filter(e => {
      if (e.revenueEstimate != null) return e.revenueEstimate >= 10_000_000;
      if (e.epsEstimate != null) return Math.abs(e.epsEstimate) >= 0.10;
      return false;
    })
    // Within same date, largest companies first; across dates, chronological
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return Math.abs(b.revenueEstimate ?? 0) - Math.abs(a.revenueEstimate ?? 0);
    })
    .slice(0, 100);

  console.log(`  Fetched ${earnings.length} earnings entries`);
  return { earnings, unavailable: false };
}

function validate(data) {
  return Array.isArray(data?.earnings) && data.earnings.length > 0;
}

if (process.argv[1]?.endsWith('seed-earnings-calendar.mjs')) {
  runSeed('market', 'earnings-calendar', KEY, fetchAll, {
    validateFn: validate,
    ttlSeconds: TTL,
    sourceVersion: 'finnhub-v1',
  }).catch(err => { console.error('FATAL:', err.message || err); process.exit(1); });
}
