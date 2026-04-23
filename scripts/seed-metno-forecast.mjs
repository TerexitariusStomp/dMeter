#!/usr/bin/env node
/**
 * seed-metno-forecast.mjs
 * Meteorologisk institutt (api.met.no) compact forecast snapshots.
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:metno-forecast:v1';
const CACHE_TTL=60*60;
const POINTS=[
  {id:'oslo',lat:59.9139,lon:10.7522},
  {id:'london',lat:51.5074,lon:-0.1278},
  {id:'newyork',lat:40.7128,lon:-74.0060},
  {id:'singapore',lat:1.3521,lon:103.8198},
  {id:'dubai',lat:25.2048,lon:55.2708},
];

async function fetchPoint(p){
  const url=`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${p.lat}&lon=${p.lon}`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':`dMeter/1.0 (${CHROME_UA})`},signal:AbortSignal.timeout(20_000)});
  if(!res.ok) throw new Error(`met.no ${p.id} HTTP ${res.status}`);
  const d=await res.json();
  const ts=d?.properties?.timeseries?.[0] ?? null;
  return {
    id:p.id,lat:p.lat,lon:p.lon,updated_at:d?.properties?.meta?.updated_at??null,
    instant:ts?.data?.instant?.details??null,
    next_1h:ts?.data?.next_1_hours?.summary?.symbol_code??null,
    next_6h:ts?.data?.next_6_hours?.summary?.symbol_code??null,
  };
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:metno-forecast',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const out=[];
    for(const p of POINTS){ try{ out.push(await fetchPoint(p)); }catch{} }
    const payload={source:'api.met.no',points:out,total:out.length,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
