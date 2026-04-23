import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:open-charge:v1',
  unavailableMessage: 'Open Charge data unavailable',
  cacheTtlMs: 900000,
  cacheControl: 's-maxage=3600, stale-while-revalidate=900, stale-if-error=7200',
});
