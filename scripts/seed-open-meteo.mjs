#!/usr/bin/env node
/**
 * seed-open-meteo.mjs
 *
 * Global weather + air quality snapshot from Open-Meteo.
 * https://open-meteo.com — no API key required.
 *
 * Fetches current conditions + 24h forecast for 20 major global cities
 * covering all continents. Each city returns:
 *   temperature_2m, windspeed_10m, precipitation, weathercode,
 *   pm10, pm2_5, carbon_monoxide, nitrogen_dioxide, ozone, uv_index
 *
 * Stored at:  dmrv:open-meteo:v1
 * Meta key:   seed-meta:dmrv:open-meteo
 * TTL:        1800s (30min)
 */

import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'dmrv:open-meteo:v1';
const CACHE_TTL     = 1800;
const FETCH_TIMEOUT = 30_000;

// 20 globally representative cities
const CITIES = [
  { name: 'New York',      lat: 40.71,   lon: -74.01  },
  { name: 'London',        lat: 51.51,   lon: -0.13   },
  { name: 'Paris',         lat: 48.85,   lon: 2.35    },
  { name: 'Berlin',        lat: 52.52,   lon: 13.40   },
  { name: 'Moscow',        lat: 55.75,   lon: 37.62   },
  { name: 'Dubai',         lat: 25.20,   lon: 55.27   },
  { name: 'Mumbai',        lat: 19.08,   lon: 72.88   },
  { name: 'Delhi',         lat: 28.61,   lon: 77.21   },
  { name: 'Beijing',       lat: 39.91,   lon: 116.39  },
  { name: 'Shanghai',      lat: 31.23,   lon: 121.47  },
  { name: 'Tokyo',         lat: 35.69,   lon: 139.69  },
  { name: 'Seoul',         lat: 37.57,   lon: 126.98  },
  { name: 'Singapore',     lat: 1.35,    lon: 103.82  },
  { name: 'Jakarta',       lat: -6.21,   lon: 106.85  },
  { name: 'Sydney',        lat: -33.87,  lon: 151.21  },
  { name: 'São Paulo',     lat: -23.55,  lon: -46.63  },
  { name: 'Lagos',         lat: 6.52,    lon: 3.38    },
  { name: 'Cairo',         lat: 30.06,   lon: 31.25   },
  { name: 'Nairobi',       lat: -1.29,   lon: 36.82   },
  { name: 'Mexico City',   lat: 19.43,   lon: -99.13  },
];

async function fetchCity(city) {
  const url = [
    'https://api.open-meteo.com/v1/forecast',
    `?latitude=${city.lat}&longitude=${city.lon}`,
    '&current=temperature_2m,windspeed_10m,precipitation,weathercode,relativehumidity_2m',
    '&hourly=precipitation_probability,uv_index',
    '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max',
    '&forecast_days=2',
    '&timezone=auto',
  ].join('');

  const aqUrl = [
    'https://air-quality-api.open-meteo.com/v1/air-quality',
    `?latitude=${city.lat}&longitude=${city.lon}`,
    '&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,uv_index',
    '&timezone=auto',
  ].join('');

  const [wxRes, aqRes] = await Promise.all([
    fetch(url,   { headers: { 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT) }),
    fetch(aqUrl, { headers: { 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT) }),
  ]);

  if (!wxRes.ok) throw new Error(`Open-Meteo weather HTTP ${wxRes.status} for ${city.name}`);
  if (!aqRes.ok) throw new Error(`Open-Meteo AQ HTTP ${aqRes.status} for ${city.name}`);

  const wx = await wxRes.json();
  const aq = await aqRes.json();

  return {
    city:         city.name,
    lat:          city.lat,
    lon:          city.lon,
    timezone:     wx.timezone,
    current: {
      time:             wx.current?.time,
      temperature_c:    wx.current?.temperature_2m,
      humidity_pct:     wx.current?.relativehumidity_2m,
      windspeed_kmh:    wx.current?.windspeed_10m,
      precipitation_mm: wx.current?.precipitation,
      weathercode:      wx.current?.weathercode,
      pm2_5:            aq.current?.pm2_5,
      pm10:             aq.current?.pm10,
      no2:              aq.current?.nitrogen_dioxide,
      co:               aq.current?.carbon_monoxide,
      ozone:            aq.current?.ozone,
      uv_index:         aq.current?.uv_index,
    },
    daily_max_c:  wx.daily?.temperature_2m_max?.[0],
    daily_min_c:  wx.daily?.temperature_2m_min?.[0],
    precip_sum_mm: wx.daily?.precipitation_sum?.[0],
    uv_index_max: wx.daily?.uv_index_max?.[0],
  };
}

await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey:      'seed-meta:dmrv:open-meteo',
  cacheTtl:     CACHE_TTL,
  async fetch() {
    // Fetch all cities in parallel, tolerate individual failures
    const results = await Promise.allSettled(CITIES.map(fetchCity));
    const cities = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (cities.length < 5) throw new Error(`Too many failures: only ${cities.length} cities succeeded`);

    const failed = results.filter(r => r.status === 'rejected').map((r, i) => CITIES[i]?.name);

    await verifySeedKey(CANONICAL_KEY, 'cities');
    return {
      cities,
      summary: {
        total:   cities.length,
        failed,
        avg_temp_c: Math.round(cities.reduce((s, c) => s + (c.current.temperature_c ?? 0), 0) / cities.length * 10) / 10,
      },
      fetchedAt: new Date().toISOString(),
    };
  },
});
