import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:metno-forecast:v1',
  unavailableMessage: 'met.no forecast unavailable',
  cacheTtlMs: 300000,
  cacheControl: 's-maxage=1800, stale-while-revalidate=600, stale-if-error=3600',
});
