import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:naturemapr:v1', unavailableMessage: 'NatureMapr data unavailable', cacheTtlMs: 600000, cacheControl: 's-maxage=1800, stale-while-revalidate=600, stale-if-error=1800' });
