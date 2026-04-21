import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:usgs-quakes:v1',
  unavailableMessage: 'USGS quakes data unavailable',
  cacheTtlMs: 180000,
  cacheControl: 's-maxage=300, stale-while-revalidate=120, stale-if-error=900',
});
