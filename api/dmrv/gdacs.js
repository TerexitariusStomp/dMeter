import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:gdacs:v1',
  unavailableMessage: 'GDACS data unavailable',
  cacheTtlMs: 180000,
  cacheControl: 's-maxage=300, stale-while-revalidate=120, stale-if-error=900',
});
