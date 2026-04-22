#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const WORLD_BANK_API = 'https://api.worldbank.org/v2';
const CANONICAL_KEY = 'economic:worldbank-indicators:v1';
const CACHE_TTL = 86400; // 24 hours

interface WorldBankIndicator {
  id: string;
  value: string;
  date: string;
}

interface WorldBankCountry {
  id: string;
  iso2Code: string;
  name: string;
  region: {
    id: string;
    value: string;
  };
  incomeLevel: {
    id: string;
    value: string;
  };
}

interface WorldBankResponse {
  [key: string]: WorldBankIndicator[];
}

const ECONOMIC_INDICATORS = [
  'NY.GDP.MKTP.CD',      // GDP (current US$)
  'NY.GDP.PCAP.CD',     // GDP per capita (current US$)
  'NY.GDP.DEFL.KD.ZG',  // Inflation, GDP deflator (annual %)
  'FP.CPI.TOTL.ZG',     // Inflation, consumer prices (annual %)
  'SL.UEM.TOTL.ZS',     // Unemployment, total (% of total labor force)
  'NE.GNF.TOTL.ZS',     // Net income from abroad (% of GDP)
  'BX.GRT.TOTL.CD',     // Imports of goods and services (current US$)
  'BX.GSR.TOTL.CD',     // Exports of goods and services (current US$)
  'DT.TDS.DECT.CD',     // Total debt service (% of exports of goods, services and primary income)
  'GC.REV.TOTL.GD.ZS',  // Tax revenue (% of GDP)
  'GC.XTOT.TOTL.GD.ZS', // Total expenditure (% of GDP)
  'NY.ADJ.NNTY.CD',     // Adjusted net national income (current US$)
  'NY.ADJ.ANESS.CD',    // Adjusted savings: gross savings (% of GNI)
  'EG.USE.COMM.FO.ZS',  // Fossil fuel energy consumption (% of total)
  'EG.FEC.RNEW.ZS',     // Renewable energy consumption (% of total final energy consumption)
  'EN.ATM.CO2E.KD.GD',  // CO2 emissions (kg per 2015 US$ of GDP)
  'SP.POP.TOTL',        // Population, total
  'SP.URB.TOTL.IN.ZS',  // Urban population (% of total)
  'SP.DYN.LE00.IN',     // Life expectancy at birth, total (years)
  'SE.ADT.LITR.ZS',     // Literacy rate, adult total (% of people ages 15 and above)
  'UIS.X.4.PTRP',       // School enrollment, primary (% net)
  'NY.GDP.MKTP.KD.ZG',  // GDP growth (annual %)
  'BN.CAB.XOKA.CD',     // Current account balance (BoP, current US$)
  'BN.KLT.DINV.CD',     // Foreign direct investment, net inflows (BoP, current US$)
];

const MAJOR_ECONOMIES = [
  'US', 'CN', 'JP', 'DE', 'IN', 'GB', 'FR', 'IT', 'BR', 'CA',
  'KR', 'RU', 'AU', 'ES', 'MX', 'ID', 'NL', 'SA', 'CH', 'TW',
  'BE', 'SE', 'PL', 'TH', 'NG', 'AT', 'EG', 'DK', 'SG', 'IR',
  'NO', 'MY', 'PH', 'PK', 'VN', 'BD', 'CO', 'FI', 'RO', 'IL',
  'NZ', 'GR', 'CZ', 'PT', 'HU', 'CL', 'NG', 'KE', 'UA', 'AR',
];

function mapIndicatorValue(indicator: WorldBankIndicator): {
  date: string;
  value: number;
} {
  const value = parseFloat(indicator.value);
  return {
    date: indicator.date,
    value: isNaN(value) ? 0 : value,
  };
}

function aggregateLatestValues(data: WorldBankResponse[]): Record<string, number> {
  const result: Record<string, number> = {};
  
  for (const indicatorData of data) {
    for (const [indicator, values] of Object.entries(indicatorData)) {
      if (values.length > 0) {
        const latest = values.reduce((latest, current) => 
          parseInt(current.date) > parseInt(latest.date) ? current : latest
        );
        result[indicator] = parseFloat(latest.value) || 0;
      }
    }
  }
  
  return result;
}

async function fetchWorldBankData() {
  const allData: WorldBankResponse[] = [];
  const countryMap = new Map<string, WorldBankCountry>();
  
  // First, fetch country data
  try {
    const countryResp = await fetch(`${WORLD_BANK_API}/countries?format=json&per_page=300`, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (countryResp.ok) {
      const countryData = await countryResp.json();
      const countries = countryData[1] || [];
      
      for (const country of countries) {
        if (country.iso2Code && MAJOR_ECONOMIES.includes(country.iso2Code)) {
          countryMap.set(country.iso2Code, country);
        }
      }
    }
  } catch (e) {
    console.warn('[WorldBank] Country fetch error:', e?.message || e);
  }
  
  // Fetch indicators for each country
  for (const countryCode of MAJOR_ECONOMIES) {
    const country = countryMap.get(countryCode);
    if (!country) continue;
    
    const countryData: WorldBankResponse = {};
    
    for (const indicator of ECONOMIC_INDICATORS) {
      try {
        const resp = await fetch(
          `${WORLD_BANK_API}/country/${countryCode}/indicator/${indicator}?format=json&date=2022:2023&per_page=3`,
          {
            headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
            signal: AbortSignal.timeout(10000),
          }
        );
        
        if (resp.ok) {
          const data = await resp.json();
          const values = data[1] || [];
          
          if (values.length > 0) {
            countryData[indicator] = values;
          }
        }
      } catch (e) {
        // Continue with other indicators if one fails
      }
    }
    
    if (Object.keys(countryData).length > 0) {
      allData.push({
        [countryCode]: countryData,
      });
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Aggregate latest values
  const latestValues = aggregateLatestValues(allData);
  
  // Prepare structured data
  const countries = Array.from(countryMap.values()).map(country => ({
    id: country.id,
    iso2Code: country.iso2Code,
    name: country.name,
    region: country.region.value,
    incomeLevel: country.incomeLevel.value,
    indicators: latestValues,
  }));
  
  console.log(`[WorldBank] Fetched data for ${countries.length} countries`);
  
  return {
    countries,
    indicators: ECONOMIC_INDICATORS,
    fetchedAt: Date.now(),
  };
}

function validate(data) {
  return Array.isArray(data?.countries) && data.countries.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.countries) ? data.countries.length : 0;
}

runSeed('economic', 'worldbank-indicators', CANONICAL_KEY, fetchWorldBankData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'worldbank-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 1440,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});