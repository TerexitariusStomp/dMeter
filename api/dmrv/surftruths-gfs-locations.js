import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:surftruths-gfs-locations:v1', unavailableMessage: 'surftruths gfs locations unavailable', cacheTtlMs: 300000, cacheControl: 's-maxage=1800, stale-while-revalidate=300, stale-if-error=1800' });
