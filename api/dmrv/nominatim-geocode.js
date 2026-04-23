import { createDmrvDatasetHandler } from './_dataset-endpoint.js';
export const config = { runtime: 'edge' };
export default createDmrvDatasetHandler({ redisKey: 'dmrv:nominatim-geocode:v1', unavailableMessage: 'Nominatim geocode data unavailable', cacheTtlMs: 600000, cacheControl: 's-maxage=3600, stale-while-revalidate=1200, stale-if-error=3600' });
