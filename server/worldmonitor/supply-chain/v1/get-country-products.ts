import type {
  ServerContext,
  GetCountryProductsRequest,
  GetCountryProductsResponse,
  CountryProduct,
} from '../../../../src/generated/server/worldmonitor/supply_chain/v1/service_server';

import { isCallerPremium } from '../../../_shared/premium-check';
import { getCachedJson } from '../../../_shared/redis';

interface BilateralHs4Payload {
  iso2: string;
  products?: CountryProduct[];
  fetchedAt?: string;
}

export async function getCountryProducts(
  ctx: ServerContext,
  req: GetCountryProductsRequest,
): Promise<GetCountryProductsResponse> {
  const isPro = await isCallerPremium(ctx.request);
  const iso2 = (req.iso2 ?? '').trim().toUpperCase();
  const empty: GetCountryProductsResponse = { iso2, products: [], fetchedAt: '' };
  if (!isPro) return empty;
  if (!/^[A-Z]{2}$/.test(iso2)) return empty;

  // Seeder writes via raw key (no env-prefix) — match it on read.
  const key = `comtrade:bilateral-hs4:${iso2}:v1`;
  const payload = await getCachedJson(key, true).catch(() => null) as BilateralHs4Payload | null;
  if (!payload) return empty;

  return {
    iso2,
    products: Array.isArray(payload.products) ? payload.products : [],
    fetchedAt: payload.fetchedAt ?? '',
  };
}
