import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:sg-weather:v1', unavailableMessage: 'sg weather data unavailable', cacheTtlMs: 120000, cacheControl: 's-maxage=600, stale-while-revalidate=120, stale-if-error=900' });
