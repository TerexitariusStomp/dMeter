import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:websitecarbon-data:v1', unavailableMessage: 'websitecarbon data unavailable', cacheTtlMs: 300000, cacheControl: 's-maxage=3600, stale-while-revalidate=600, stale-if-error=3600' });
