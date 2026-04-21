#!/usr/bin/env node
/**
 * seed-open-meteo-marine.mjs
 * Open-Meteo marine snapshots (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:open-meteo-marine:v1';
const CACHE_TTL=60*60;
const POINTS=[
  { id:'santacruz', lat:36.96, lon:-122.02 },
  { id:'lisbon_coast', lat:38.72, lon:-9.30 },
  { id:'singapore_strait', lat:1.15, lon:103.85 },
  { id:'dubai_gulf', lat:25.30, lon:55.20 },
];

async function fetchPoint(p){
  const url=`https://marine-api.open-meteo.com/v1/marine?latitude=${p.lat}&longitude=${p.lon}&hourly=wave_height,wave_direction,wave_period,sea_surface_temperature&timezone=UTC`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
  if(!res.ok) throw new Error(`Open-Meteo Marine ${p.id} HTTP ${res.status}`);
  const d=await res.json();
  const t=Array.isArray(d?.hourly?.time)?d.hourly.time:[];
  const row=(arr,i)=>Array.isArray(arr)?arr[i]??null:null;
  const series=t.slice(0,24).map((ts,i)=>({
    time:ts,
    wave_height:row(d?.hourly?.wave_height,i),
    wave_direction:row(d?.hourly?.wave_direction,i),
    wave_period:row(d?.hourly?.wave_period,i),
    sea_surface_temperature:row(d?.hourly?.sea_surface_temperature,i),
  }));
  return { id:p.id, lat:p.lat, lon:p.lon, series };
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:open-meteo-marine',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const points=[];
    for(const p of POINTS){ try{ points.push(await fetchPoint(p)); }catch{} }
    const payload={ source:'marine-api.open-meteo.com', points, total:points.length, fetchedAt:new Date().toISOString() };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
