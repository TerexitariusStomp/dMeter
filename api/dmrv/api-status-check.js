import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:api-status-check:v1',
  unavailableMessage: 'API status check data unavailable',
  cacheTtlMs: 180000,
  cacheControl: 's-maxage=900, stale-while-revalidate=300, stale-if-error=1800',
});
