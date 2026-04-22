#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';
const HISTORICAL_API = 'https://archive-api.open-meteo.com/v1/archive';
const CANONICAL_KEY = 'weather:open-meteo:v1';
const CACHE_TTL = 3600; // 1 hour

interface WeatherData {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    temperature_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
    visibility: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    uv_index_max: number[];
  };
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current: WeatherData['current'];
  daily: WeatherData['daily'];
}

interface WeatherLocation {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const MAJOR_CITIES: WeatherLocation[] = [
  { id: 'london', name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  { id: 'new-york', name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' },
  { id: 'beijing', name: 'Beijing', country: 'China', latitude: 39.9042, longitude: 116.4074, timezone: 'Asia/Shanghai' },
  { id: 'sydney', name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
  { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
  { id: 'moscow', name: 'Moscow', country: 'Russia', latitude: 55.7558, longitude: 37.6173, timezone: 'Europe/Moscow' },
  { id: 'saopaulo', name: 'São Paulo', country: 'Brazil', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo' },
  { id: 'mumbai', name: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata' },
  { id: 'cairo', name: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo' },
];

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Snow fall',
  73: 'Snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Heavy thunderstorm',
};

function mapWeatherData(city: WeatherLocation, data: OpenMeteoResponse) {
  const current = data.current;
  const daily = data.daily;
  
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone,
    current: {
      temperature: current.temperature_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      weatherCode: current.weather_code,
      weather: WEATHER_CODES[current.weather_code] || 'Unknown',
      visibility: current.visibility,
      timestamp: new Date(current.time).getTime(),
    },
    forecast: daily.time.map((time, index) => ({
      date: time,
      maxTemp: daily.temperature_2m_max[index],
      minTemp: daily.temperature_2m_min[index],
      precipitation: daily.precipitation_sum[index],
      precipitationProbability: daily.precipitation_probability_max[index],
      maxWindSpeed: daily.wind_speed_10m_max[index],
      uvIndex: daily.uv_index_max[index],
    })),
  };
}

async function fetchWeatherData(city: WeatherLocation) {
  try {
    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const params = new URLSearchParams({
      latitude: city.latitude.toString(),
      longitude: city.longitude.toString(),
      current_weather: 'true',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max',
      timezone: city.timezone,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });
    
    const resp = await fetch(`${OPEN_METEO_API}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[OpenMeteo] ${city.name} HTTP ${resp.status}`);
      return null;
    }
    
    const data: OpenMeteoResponse = await resp.json();
    return mapWeatherData(city, data);
  } catch (e) {
    console.warn(`[OpenMeteo] ${city.name} fetch error:`, e?.message || e);
    return null;
  }
}

async function fetchOpenMeteoWeather() {
  const weatherData = [];
  
  for (const city of MAJOR_CITIES) {
    const data = await fetchWeatherData(city);
    if (data) {
      weatherData.push(data);
    }
  }
  
  console.log(`[OpenMeteo] Fetched weather for ${weatherData.length}/${MAJOR_CITIES.length} cities`);
  return { weather: weatherData, fetchedAt: Date.now() };
}

function validate(data) {
  return Array.isArray(data?.weather) && data.weather.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.weather) ? data.weather.length : 0;
}

runSeed('weather', 'open-meteo', CANONICAL_KEY, fetchOpenMeteoWeather, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'open-meteo-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 30,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});