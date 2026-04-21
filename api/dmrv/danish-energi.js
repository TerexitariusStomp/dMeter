import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:danish-energi:v1',
  unavailableMessage: 'Danish Energi data unavailable',
  cacheTtlMs: 300000,
  cacheControl: 's-maxage=600, stale-while-revalidate=180, stale-if-error=900',
});
