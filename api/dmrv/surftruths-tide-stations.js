import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:surftruths-tide-stations:v1', unavailableMessage: 'surftruths tide stations unavailable', cacheTtlMs: 300000, cacheControl: 's-maxage=3600, stale-while-revalidate=600, stale-if-error=3600' });
