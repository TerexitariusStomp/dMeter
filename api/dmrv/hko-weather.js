import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:hko-weather:v1', unavailableMessage: 'hko weather data unavailable', cacheTtlMs: 120000, cacheControl: 's-maxage=600, stale-while-revalidate=120, stale-if-error=900' });
