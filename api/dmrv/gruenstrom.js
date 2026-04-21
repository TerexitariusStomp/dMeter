import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:gruenstrom:v1',
  unavailableMessage: 'GruenStrom data unavailable',
  cacheTtlMs: 600000,
  cacheControl: 's-maxage=1200, stale-while-revalidate=300, stale-if-error=1800',
});
