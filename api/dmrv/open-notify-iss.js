import { createDmrvDatasetHandler } from './_dataset-endpoint.js';

export const config = { runtime: 'edge' };

export default createDmrvDatasetHandler({
  redisKey: 'dmrv:open-notify-iss:v1',
  unavailableMessage: 'Open Notify ISS data unavailable',
  cacheTtlMs: 60000,
  cacheControl: 's-maxage=300, stale-while-revalidate=60, stale-if-error=600',
});
