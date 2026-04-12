import type {
  ServerContext,
  GetCountryChokepointIndexRequest,
  GetCountryChokepointIndexResponse,
  ChokepointExposureEntry,
} from '../../../../src/generated/server/worldmonitor/supply_chain/v1/service_server';

import { getCachedJson } from '../../../_shared/redis';
import { isCallerPremium } from '../../../_shared/premium-check';
import { CHOKEPOINT_REGISTRY } from '../../../../src/config/chokepoint-registry';
import COUNTRY_PORT_CLUSTERS from '../../../../scripts/shared/country-port-clusters.json';

interface PortClusterEntry {
  nearestRouteIds: string[];
  coastSide: string;
}

const EMPTY: Omit<GetCountryChokepointIndexResponse, 'iso2' | 'hs2'> = {
  exposures: [],
  primaryChokepointId: '',
  vulnerabilityIndex: 0,
  fetchedAt: '',
};

function computeFallbackExposure(
  nearestRouteIds: string[],
  hs2: string,
): { exposures: ChokepointExposureEntry[]; primaryChokepointId: string; vulnerabilityIndex: number } {
  const isEnergy = hs2 === '27';
  const routeSet = new Set(nearestRouteIds);

  const entries: ChokepointExposureEntry[] = CHOKEPOINT_REGISTRY.map(cp => {
    const overlap = cp.routeIds.filter(r => routeSet.has(r)).length;
    const maxRoutes = Math.max(cp.routeIds.length, 1);
    let score = (overlap / maxRoutes) * 100;
    if (isEnergy && cp.shockModelSupported) score = Math.min(score * 1.5, 100);
    return {
      chokepointId: cp.id,
      chokepointName: cp.displayName,
      exposureScore: Math.round(score * 10) / 10,
      coastSide: '',
      shockSupported: cp.shockModelSupported,
    };
  }).sort((a, b) => b.exposureScore - a.exposureScore);

  const weights = [0.5, 0.3, 0.2];
  const vulnerabilityIndex = Math.round(
    entries.slice(0, 3).reduce((sum, e, i) => sum + e.exposureScore * weights[i]!, 0) * 10,
  ) / 10;

  return {
    exposures: entries,
    primaryChokepointId: entries[0]?.chokepointId ?? '',
    vulnerabilityIndex,
  };
}

export async function getCountryChokepointIndex(
  ctx: ServerContext,
  req: GetCountryChokepointIndexRequest,
): Promise<GetCountryChokepointIndexResponse> {
  const isPro = await isCallerPremium(ctx.request);
  if (!isPro) {
    return { iso2: req.iso2, hs2: req.hs2 || '27', ...EMPTY };
  }

  const iso2 = req.iso2.trim().toUpperCase();
  const hs2 = (req.hs2?.trim() || '27').replace(/\D/g, '') || '27';

  if (!/^[A-Z]{2}$/.test(iso2) || !/^\d{1,2}$/.test(hs2)) {
    return { iso2: req.iso2, hs2: req.hs2 || '27', ...EMPTY };
  }

  const key = `supply-chain:exposure:${iso2}:${hs2}:v2`;

  try {
    const data = await getCachedJson(key, true);
    if (data) return data as GetCountryChokepointIndexResponse;
  } catch {
    // Redis read failure — fall through to deterministic fallback
  }

  // Cache miss or Redis failure: compute country-level fallback.
  // Covers desktop sidecar (no Upstash), transient Redis misses, and pre-seed state.
  const clusters = COUNTRY_PORT_CLUSTERS as unknown as Record<string, PortClusterEntry>;
  const cluster = clusters[iso2];
  const nearestRouteIds = cluster?.nearestRouteIds ?? [];

  if (nearestRouteIds.length === 0) {
    return { iso2, hs2, ...EMPTY, fetchedAt: new Date().toISOString() };
  }

  const fallback = computeFallbackExposure(nearestRouteIds, hs2);
  return {
    iso2,
    hs2,
    ...fallback,
    fetchedAt: new Date().toISOString(),
  };
}
