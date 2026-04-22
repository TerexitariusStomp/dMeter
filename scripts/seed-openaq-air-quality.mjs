#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';
import { extractCountryCode } from './shared/geo-extract.mjs';

loadEnvFile(import.meta.url);

const OPENAQ_API = 'https://api.openaq.org/v2/measurements';
const CANONICAL_KEY = 'environment:openaq:v1';
const CACHE_TTL = 7200; // 2 hours

interface OpenAQMeasurement {
  locationId: string;
  location: string;
  parameter: string;
  value: number;
  unit: string;
  date: {
    utc: string;
    local: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  country: string;
  city: string;
}

interface OpenAQResponse {
  results: OpenAQMeasurement[];
  meta: {
    found: number;
    limit: number;
    page: number;
  };
}

const POLLUTANTS = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co', 'bc'];
const CITIES = [
  'Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan', 'Nanjing',
  'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Milan', 'Barcelona', 'Athens',
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego',
  'Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Kobe', 'Kyoto', 'Fukuoka',
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra',
  'Dubai', 'Riyadh', 'Doha', 'Kuwait City', 'Manama', 'Muscat', 'Abu Dhabi', 'Dammam',
  'Moscow', 'St Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Chelyabinsk', 'Omsk',
  'Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Torreón',
  'São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba',
  'Cairo', 'Alexandria', 'Giza', 'Shubra El Kheima', 'Port Said', 'Suez', 'Luxor', 'Aswan',
  'Lagos', 'Kano', 'Ibadan', 'Kaduna', 'Port Harcourt', 'Benin City', 'Maiduguri', 'Zaria',
  'Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'East London', 'Pietermaritzburg',
];

function mapMeasurement(measurement: OpenAQMeasurement) {
  return {
    id: `${measurement.locationId}-${measurement.parameter}-${new Date(measurement.date.utc).getTime()}`,
    locationId: measurement.locationId,
    location: measurement.location,
    parameter: measurement.parameter,
    value: measurement.value,
    unit: measurement.unit,
    timestamp: new Date(measurement.date.utc).getTime(),
    country: measurement.country,
    city: measurement.city,
    latitude: measurement.coordinates.latitude,
    longitude: measurement.coordinates.longitude,
  };
}

function filterRecentMeasurements(measurements: OpenAQMeasurement[], hours: number = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return measurements.filter(m => new Date(m.date.utc).getTime() > cutoff);
}

async function fetchOpenAQData() {
  const allMeasurements = [];
  const seenLocations = new Set();
  
  for (const city of CITIES) {
    try {
      const countryCode = extractCountryCode(city) || '';
      
      const params = new URLSearchParams({
        city: city,
        parameter: POLLUTANTS.join(','),
        date_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        date_to: new Date().toISOString().split('T')[0],
        limit: 1000,
      });
      
      if (countryCode) {
        params.set('country', countryCode);
      }
      
      const resp = await fetch(`${OPENAQ_API}?${params}`, {
        headers: { 
          'Accept': 'application/json', 
          'User-Agent': CHROME_UA,
          'X-API-Key': process.env.OPENAQ_API_KEY || '',
        },
        signal: AbortSignal.timeout(20000),
      });
      
      if (!resp.ok) {
        console.warn(`[OpenAQ] ${city} HTTP ${resp.status}`);
        continue;
      }
      
      const data: OpenAQResponse = await resp.json();
      const measurements = data.results || [];
      
      const recent = filterRecentMeasurements(measurements);
      
      for (const measurement of recent) {
        const key = `${measurement.locationId}-${measurement.parameter}`;
        if (!seenLocations.has(key)) {
          seenLocations.add(key);
          allMeasurements.push(measurement);
        }
      }
      
      console.log(`[OpenAQ] ${city}: ${recent.length} recent measurements`);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (e) {
      console.warn(`[OpenAQ] ${city} fetch error:`, e?.message || e);
    }
  }
  
  const mappedMeasurements = allMeasurements.map(mapMeasurement);
  
  console.log(`[OpenAQ] Total: ${mappedMeasurements.length} measurements from ${seenLocations.size} locations`);
  
  return { 
    measurements: mappedMeasurements,
    fetchedAt: Date.now(),
    locationsCount: seenLocations.size,
    pollutants: [...new Set(allMeasurements.map(m => m.parameter))],
  };
}

function validate(data) {
  return Array.isArray(data?.measurements) && data.measurements.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.measurements) ? data.measurements.length : 0;
}

runSeed('environment', 'openaq', CANONICAL_KEY, fetchOpenAQData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'openaq-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 60,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});