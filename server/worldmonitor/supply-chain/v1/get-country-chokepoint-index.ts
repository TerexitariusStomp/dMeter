import type {
  ServerContext,
  GetCountryChokepointIndexRequest,
  GetCountryChokepointIndexResponse,
} from '../../../../src/generated/server/worldmonitor/supply_chain/v1/service_server';

import { getCachedJson } from '../../../_shared/redis';
import { isCallerPremium } from '../../../_shared/premium-check';

const EMPTY: Omit<GetCountryChokepointIndexResponse, 'iso2' | 'hs2'> = {
  exposures: [],
  primaryChokepointId: '',
  vulnerabilityIndex: 0,
  fetchedAt: '',
};

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
    // Redis read failure — return empty rather than error
  }

  return { iso2, hs2, ...EMPTY };
}
