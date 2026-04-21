import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:restor-eco:v1', unavailableMessage: 'Restor.eco data unavailable', cacheTtlMs: 600000, cacheControl: 's-maxage=3600, stale-while-revalidate=1200, stale-if-error=3600' });
