#!/usr/bin/env node
/**
 * seed-noaa-nws-forecast.mjs
 * NOAA/NWS point forecast snapshots for selected US locations (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:noaa-nws-forecast:v1';
const CACHE_TTL=30*60;
const POINTS=[
  { id:'kansas', lat:39.7456, lon:-97.0892 },
  { id:'new-york', lat:40.7128, lon:-74.0060 },
  { id:'los-angeles', lat:34.0522, lon:-118.2437 },
  { id:'miami', lat:25.7617, lon:-80.1918 },
  { id:'chicago', lat:41.8781, lon:-87.6298 },
];

async function getJson(url){
  const r=await fetch(url,{headers:{Accept:'application/geo+json','User-Agent':`dMeter/1.0 (${CHROME_UA})`},signal:AbortSignal.timeout(25_000)});
  if(!r.ok) throw new Error(`NWS HTTP ${r.status}`);
  return r.json();
}

async function fetchPoint(p){
  const point=await getJson(`https://api.weather.gov/points/${p.lat},${p.lon}`);
  const forecastUrl=point?.properties?.forecast;
  if(!forecastUrl) throw new Error(`NWS forecast URL missing for ${p.id}`);
  const forecast=await getJson(forecastUrl);
  const periods=Array.isArray(forecast?.properties?.periods)?forecast.properties.periods:[];
  return {
    id:p.id,
    lat:p.lat,
    lon:p.lon,
    office:point?.properties?.cwa ?? null,
    gridId:point?.properties?.gridId ?? null,
    periods: periods.slice(0,8).map((x)=>(
      {
        name:x?.name ?? null,
        startTime:x?.startTime ?? null,
        temperature:x?.temperature ?? null,
        temperatureUnit:x?.temperatureUnit ?? null,
        windSpeed:x?.windSpeed ?? null,
        windDirection:x?.windDirection ?? null,
        shortForecast:x?.shortForecast ?? null,
      }
    )),
  };
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:noaa-nws-forecast',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const out=[];
    for(const p of POINTS){ try{ out.push(await fetchPoint(p)); }catch{} }
    const payload={
      source:'api.weather.gov',
      points:out,
      total:out.length,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
