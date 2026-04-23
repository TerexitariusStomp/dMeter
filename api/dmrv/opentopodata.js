import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:opentopodata:v1',
  unavailableMessage: 'OpenTopoData unavailable',
  cacheTtlMs: 900000,
  cacheControl: 's-maxage=7200, stale-while-revalidate=1800, stale-if-error=7200',
});
