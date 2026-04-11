import type {
  ServerContext,
  GetMarketBreadthHistoryRequest,
  GetMarketBreadthHistoryResponse,
  BreadthSnapshot,
} from '../../../../src/generated/server/worldmonitor/market/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';

const SEED_CACHE_KEY = 'market:breadth-history:v1';

interface SeedEntry {
  date: string;
  pctAbove20d: number | null;
  pctAbove50d: number | null;
  pctAbove200d: number | null;
}

interface SeedPayload {
  updatedAt: string;
  current: {
    pctAbove20d: number | null;
    pctAbove50d: number | null;
    pctAbove200d: number | null;
  };
  history: SeedEntry[];
}

export async function getMarketBreadthHistory(
  _ctx: ServerContext,
  _req: GetMarketBreadthHistoryRequest,
): Promise<GetMarketBreadthHistoryResponse> {
  try {
    const raw = await getCachedJson(SEED_CACHE_KEY, true) as SeedPayload | null;
    if (!raw?.current || !Array.isArray(raw.history) || raw.history.length === 0) {
      return { currentPctAbove20d: 0, currentPctAbove50d: 0, currentPctAbove200d: 0, updatedAt: '', history: [], unavailable: true };
    }

    const history: BreadthSnapshot[] = raw.history.map((e) => ({
      date: e.date,
      pctAbove20d: e.pctAbove20d ?? 0,
      pctAbove50d: e.pctAbove50d ?? 0,
      pctAbove200d: e.pctAbove200d ?? 0,
    }));

    return {
      currentPctAbove20d: raw.current.pctAbove20d ?? 0,
      currentPctAbove50d: raw.current.pctAbove50d ?? 0,
      currentPctAbove200d: raw.current.pctAbove200d ?? 0,
      updatedAt: raw.updatedAt ?? '',
      history,
      unavailable: false,
    };
  } catch {
    return { currentPctAbove20d: 0, currentPctAbove50d: 0, currentPctAbove200d: 0, updatedAt: '', history: [], unavailable: true };
  }
}
