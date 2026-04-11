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

// Proto3 doubles cannot encode "absent" — we ship JSON null instead so the UI
// can distinguish a real 0% reading from a missing/failed one. The generated
// response interface types these as `number`, but the JSON transport preserves
// null values at runtime; casts below accommodate the type/runtime gap.
type BreadthSnapshotLoose = Omit<BreadthSnapshot, 'pctAbove20d' | 'pctAbove50d' | 'pctAbove200d'> & {
  pctAbove20d: number | null;
  pctAbove50d: number | null;
  pctAbove200d: number | null;
};
type BreadthResponseLoose = Omit<
  GetMarketBreadthHistoryResponse,
  'currentPctAbove20d' | 'currentPctAbove50d' | 'currentPctAbove200d' | 'history'
> & {
  currentPctAbove20d: number | null;
  currentPctAbove50d: number | null;
  currentPctAbove200d: number | null;
  history: BreadthSnapshotLoose[];
};

function emptyUnavailable(): GetMarketBreadthHistoryResponse {
  return {
    currentPctAbove20d: 0,
    currentPctAbove50d: 0,
    currentPctAbove200d: 0,
    updatedAt: '',
    history: [],
    unavailable: true,
  };
}

export async function getMarketBreadthHistory(
  _ctx: ServerContext,
  _req: GetMarketBreadthHistoryRequest,
): Promise<GetMarketBreadthHistoryResponse> {
  try {
    const raw = await getCachedJson(SEED_CACHE_KEY, true) as SeedPayload | null;
    if (!raw?.current || !Array.isArray(raw.history) || raw.history.length === 0) {
      return emptyUnavailable();
    }

    // Preserve null for current + history readings so a partial seed failure
    // (one Barchart symbol returning null) can be distinguished from a real
    // 0% breadth reading in the UI. Panel treats null as "missing".
    const history: BreadthSnapshotLoose[] = raw.history.map((e) => ({
      date: e.date,
      pctAbove20d: e.pctAbove20d ?? null,
      pctAbove50d: e.pctAbove50d ?? null,
      pctAbove200d: e.pctAbove200d ?? null,
    }));

    const loose: BreadthResponseLoose = {
      currentPctAbove20d: raw.current.pctAbove20d ?? null,
      currentPctAbove50d: raw.current.pctAbove50d ?? null,
      currentPctAbove200d: raw.current.pctAbove200d ?? null,
      updatedAt: raw.updatedAt ?? '',
      history,
      unavailable: false,
    };
    return loose as unknown as GetMarketBreadthHistoryResponse;
  } catch {
    return emptyUnavailable();
  }
}
