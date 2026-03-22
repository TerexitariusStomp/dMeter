/**
 * RPC: getBlsSeries -- reads seeded BLS time series from Railway seed cache.
 * All external BLS API calls happen in scripts/seed-bls-series.mjs on Railway.
 */
import type {
  ServerContext,
  GetBlsSeriesRequest,
  GetBlsSeriesResponse,
} from '../../../../src/generated/server/worldmonitor/economic/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';

const BLS_KEY_PREFIX = 'bls:series';

function normalizeLimit(limit: number): number {
  return limit > 0 ? Math.min(limit, 500) : 60;
}

export async function getBlsSeries(
  _ctx: ServerContext,
  req: GetBlsSeriesRequest,
): Promise<GetBlsSeriesResponse> {
  if (!req.seriesId) return { series: undefined };

  try {
    const seedKey = `${BLS_KEY_PREFIX}:${req.seriesId}`;
    const result = await getCachedJson(seedKey, true) as GetBlsSeriesResponse | null;
    if (!result?.series) return { series: undefined };

    const limit = normalizeLimit(req.limit);
    const obs = result.series.observations;
    const sliced = obs.length > limit ? obs.slice(-limit) : obs;

    return { series: { ...result.series, observations: sliced } };
  } catch {
    return { series: undefined };
  }
}
