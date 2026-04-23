#!/usr/bin/env node
/**
 * seed-global-flood-api.mjs
 * Open-Meteo Global Flood API snapshots (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:global-flood-api:v1';
const CACHE_TTL=60*60;
const POINTS=[
  { id:'berlin', lat:52.52, lon:13.41 },
  { id:'london', lat:51.5074, lon:-0.1278 },
  { id:'paris', lat:48.8566, lon:2.3522 },
  { id:'new-york', lat:40.7128, lon:-74.0060 },
  { id:'singapore', lat:1.3521, lon:103.8198 },
];

async function fetchPoint(p){
  const url=`https://flood-api.open-meteo.com/v1/flood?latitude=${p.lat}&longitude=${p.lon}&daily=river_discharge&timezone=UTC`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
  if(!res.ok) throw new Error(`GlobalFlood API ${p.id} HTTP ${res.status}`);
  const d=await res.json();
  const times=Array.isArray(d?.daily?.time)?d.daily.time:[];
  const dis=Array.isArray(d?.daily?.river_discharge)?d.daily.river_discharge:[];
  const series=times.slice(0,14).map((t,i)=>({date:t,river_discharge:dis[i] ?? null}));
  return { id:p.id, lat:p.lat, lon:p.lon, utc_offset_seconds:d?.utc_offset_seconds ?? null, series };
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:global-flood-api',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const points=[];
    for(const p of POINTS){ try{ points.push(await fetchPoint(p)); }catch{} }
    const payload={
      source:'flood-api.open-meteo.com',
      points,
      total:points.length,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
