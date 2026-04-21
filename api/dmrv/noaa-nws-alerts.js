import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:noaa-nws-alerts:v1',
  unavailableMessage: 'NOAA NWS alerts data unavailable',
  cacheTtlMs: 120000,
  cacheControl: 's-maxage=600, stale-while-revalidate=120, stale-if-error=900',
});
