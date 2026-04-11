export type ForecastMacroRegion = 'MENA' | 'EAST_ASIA' | 'EUROPE' | 'AMERICAS' | 'SOUTH_ASIA' | 'AFRICA';
export const FORECAST_MACRO_REGION_MAP: Record<string, ForecastMacroRegion>;
export function getForecastMacroRegion(region: string | null | undefined): ForecastMacroRegion | null;
