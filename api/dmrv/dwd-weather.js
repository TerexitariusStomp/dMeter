import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:dwd-weather:v1', unavailableMessage: 'dwd weather data unavailable', cacheTtlMs: 180000, cacheControl: 's-maxage=900, stale-while-revalidate=120, stale-if-error=900' });
