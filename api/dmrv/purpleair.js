import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:purpleair:v1',
  unavailableMessage: 'PurpleAir data unavailable',
  cacheTtlMs: 300000,
  cacheControl: 's-maxage=900, stale-while-revalidate=300, stale-if-error=1800',
});
