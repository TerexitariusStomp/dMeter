import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:open-meteo:v1',
  unavailableMessage: 'Open-Meteo data unavailable',
  cacheTtlMs: 300000,
  cacheControl: 's-maxage=1200, stale-while-revalidate=300, stale-if-error=1800',
});
