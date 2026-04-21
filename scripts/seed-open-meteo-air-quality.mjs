#!/usr/bin/env node
/**
 * seed-open-meteo-air-quality.mjs
 * Open-Meteo air-quality snapshots (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:open-meteo-air-quality:v1';
const CACHE_TTL=60*60;
const POINTS=[
  { id:'berlin', lat:52.52, lon:13.41 },
  { id:'london', lat:51.5074, lon:-0.1278 },
  { id:'newyork', lat:40.7128, lon:-74.0060 },
  { id:'dubai', lat:25.2048, lon:55.2708 },
  { id:'singapore', lat:1.3521, lon:103.8198 },
];

async function fetchPoint(p){
  const url=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.lat}&longitude=${p.lon}&hourly=pm10,pm2_5,ozone,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide&timezone=UTC`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
  if(!res.ok) throw new Error(`Open-Meteo Air ${p.id} HTTP ${res.status}`);
  const d=await res.json();
  const t=Array.isArray(d?.hourly?.time)?d.hourly.time:[];
  const row=(arr,i)=>Array.isArray(arr)?arr[i]??null:null;
  const series=t.slice(0,24).map((ts,i)=>({
    time:ts,
    pm10:row(d?.hourly?.pm10,i),
    pm2_5:row(d?.hourly?.pm2_5,i),
    ozone:row(d?.hourly?.ozone,i),
    carbon_monoxide:row(d?.hourly?.carbon_monoxide,i),
    nitrogen_dioxide:row(d?.hourly?.nitrogen_dioxide,i),
    sulphur_dioxide:row(d?.hourly?.sulphur_dioxide,i),
  }));
  return { id:p.id, lat:p.lat, lon:p.lon, series };
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:open-meteo-air-quality',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const points=[];
    for(const p of POINTS){ try{ points.push(await fetchPoint(p)); }catch{} }
    const payload={ source:'air-quality-api.open-meteo.com', points, total:points.length, fetchedAt:new Date().toISOString() };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
