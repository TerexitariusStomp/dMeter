import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:uv-index:v1',
  unavailableMessage: 'UV index data unavailable',
  cacheTtlMs: 600000,
  cacheControl: 's-maxage=1200, stale-while-revalidate=300, stale-if-error=1800',
});
