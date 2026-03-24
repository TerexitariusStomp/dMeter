import { toApiUrl } from '@/services/runtime';

export interface HormuzDataPoint {
  date: string;
  value: number;
}

export interface HormuzChart {
  label: string;
  title: string;
  series: HormuzDataPoint[];
}

export interface HormuzTrackerData {
  fetchedAt: number;
  updatedDate: string | null;
  title: string | null;
  summary: string | null;
  paragraphs: string[];
  status: 'closed' | 'disrupted' | 'restricted' | 'open';
  charts: HormuzChart[];
  attribution: { source: string; url: string };
}

let cachedData: HormuzTrackerData | null = null;
let cachedAt = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

export async function fetchHormuzTracker(): Promise<HormuzTrackerData | null> {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL) return cachedData;

  try {
    const resp = await fetch(toApiUrl('/api/supply-chain/hormuz-tracker'), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return cachedData;

    const raw = (await resp.json()) as HormuzTrackerData;
    if (!raw.attribution) return cachedData;

    cachedData = raw;
    cachedAt = now;
    return cachedData;
  } catch {
    return cachedData;
  }
}
