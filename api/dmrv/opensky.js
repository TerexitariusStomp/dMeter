import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:opensky:v1',
  unavailableMessage: 'OpenSky data unavailable',
  cacheTtlMs: 180000,
  cacheControl: 's-maxage=300, stale-while-revalidate=120, stale-if-error=900',
});
