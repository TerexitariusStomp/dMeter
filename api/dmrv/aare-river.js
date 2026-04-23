import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:aare-river:v1',
  unavailableMessage: 'Aare river data unavailable',
  cacheTtlMs: 180000,
  cacheControl: 's-maxage=600, stale-while-revalidate=180, stale-if-error=900',
});
