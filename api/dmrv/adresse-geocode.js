import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:adresse-geocode:v1',
  unavailableMessage: 'Adresse geocode data unavailable',
  cacheTtlMs: 600000,
  cacheControl: 's-maxage=7200, stale-while-revalidate=1800, stale-if-error=7200',
});
