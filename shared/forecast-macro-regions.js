// @ts-check
// Mirror of MACRO_REGION_MAP in scripts/seed-forecasts.mjs (lines 8219-8238).
// Maps the free-text `Forecast.region` string (as written by the seed) to
// a macro region id. Used client-side to filter forecasts when the Forecast
// proto does not expose macroRegion directly.
//
// Keep in sync with scripts/seed-forecasts.mjs MACRO_REGION_MAP. If the seed
// adds new regions, add them here too.

/** @type {Record<string, 'MENA' | 'EAST_ASIA' | 'EUROPE' | 'AMERICAS' | 'SOUTH_ASIA' | 'AFRICA'>} */
export const FORECAST_MACRO_REGION_MAP = {
  // MENA
  'Israel': 'MENA', 'Iran': 'MENA', 'Syria': 'MENA', 'Iraq': 'MENA', 'Lebanon': 'MENA',
  'Gaza': 'MENA', 'Egypt': 'MENA', 'Saudi Arabia': 'MENA', 'Yemen': 'MENA', 'Jordan': 'MENA',
  'Turkey': 'MENA', 'Libya': 'MENA', 'Middle East': 'MENA', 'Persian Gulf': 'MENA',
  'Red Sea': 'MENA', 'Strait of Hormuz': 'MENA', 'Eastern Mediterranean': 'MENA',
  // EAST_ASIA
  'Taiwan': 'EAST_ASIA', 'China': 'EAST_ASIA', 'Japan': 'EAST_ASIA', 'South Korea': 'EAST_ASIA',
  'North Korea': 'EAST_ASIA', 'Western Pacific': 'EAST_ASIA', 'South China Sea': 'EAST_ASIA',
  // AMERICAS
  'United States': 'AMERICAS', 'Brazil': 'AMERICAS', 'Mexico': 'AMERICAS', 'Cuba': 'AMERICAS',
  'Canada': 'AMERICAS', 'Colombia': 'AMERICAS', 'Venezuela': 'AMERICAS', 'Argentina': 'AMERICAS',
  'Peru': 'AMERICAS', 'Chile': 'AMERICAS',
  // EUROPE
  'Russia': 'EUROPE', 'Ukraine': 'EUROPE', 'Germany': 'EUROPE', 'France': 'EUROPE',
  'United Kingdom': 'EUROPE', 'Poland': 'EUROPE', 'Estonia': 'EUROPE', 'Latvia': 'EUROPE',
  'Lithuania': 'EUROPE', 'Baltic Sea': 'EUROPE', 'Black Sea': 'EUROPE',
  'Kerch Strait': 'EUROPE', 'Sweden': 'EUROPE', 'Finland': 'EUROPE', 'Norway': 'EUROPE',
  'Romania': 'EUROPE', 'Bulgaria': 'EUROPE',
  // SOUTH_ASIA
  'India': 'SOUTH_ASIA', 'Pakistan': 'SOUTH_ASIA', 'Afghanistan': 'SOUTH_ASIA',
  'Bangladesh': 'SOUTH_ASIA', 'Myanmar': 'SOUTH_ASIA',
  // AFRICA
  'Congo': 'AFRICA', 'Sudan': 'AFRICA', 'Ethiopia': 'AFRICA', 'Nigeria': 'AFRICA',
  'Somalia': 'AFRICA', 'Mali': 'AFRICA', 'Mozambique': 'AFRICA', 'Sahel': 'AFRICA',
};

/**
 * Map a free-text Forecast.region string to its macro region id, or null
 * if the region is unknown.
 * @param {string | null | undefined} region
 * @returns {'MENA' | 'EAST_ASIA' | 'EUROPE' | 'AMERICAS' | 'SOUTH_ASIA' | 'AFRICA' | null}
 */
export function getForecastMacroRegion(region) {
  if (!region) return null;
  return FORECAST_MACRO_REGION_MAP[region] ?? null;
}
