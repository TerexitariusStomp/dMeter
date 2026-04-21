import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:pm25-lass:v1',
  unavailableMessage: 'PM2.5 LASS data unavailable',
  cacheTtlMs: 300000,
  cacheControl: 's-maxage=900, stale-while-revalidate=300, stale-if-error=1800',
});
