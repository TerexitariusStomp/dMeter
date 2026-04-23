import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:intentional-communities:v1', unavailableMessage: 'intentional communities data unavailable', cacheTtlMs: 300000, cacheControl: 's-maxage=1800, stale-while-revalidate=300, stale-if-error=1800' });
