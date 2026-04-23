import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:xeno-canto:v1', unavailableMessage: 'Xeno-canto data unavailable', cacheTtlMs: 600000, cacheControl: 's-maxage=1800, stale-while-revalidate=600, stale-if-error=1800' });
