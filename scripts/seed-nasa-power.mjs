#!/usr/bin/env node
/**
 * seed-nasa-power.mjs
 * NASA POWER daily meteorology snapshots (no auth).
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:nasa-power:v1';
const CACHE_TTL=6*60*60;
const POINTS=[
  { id:'oslo', lat:59.9139, lon:10.7522 },
  { id:'london', lat:51.5074, lon:-0.1278 },
  { id:'dubai', lat:25.2048, lon:55.2708 },
  { id:'singapore', lat:1.3521, lon:103.8198 },
  { id:'newyork', lat:40.7128, lon:-74.0060 },
];

function ymd(d){ return d.toISOString().slice(0,10).replaceAll('-',''); }

async function fetchPoint(p,start,end){
  const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=RE&longitude=${p.lon}&latitude=${p.lat}&start=${start}&end=${end}&format=JSON`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':`dMeter/1.0 (${CHROME_UA})`},signal:AbortSignal.timeout(25_000)});
  if(!res.ok) throw new Error(`NASA POWER ${p.id} HTTP ${res.status}`);
  const d=await res.json();
  const param=d?.properties?.parameter||{};
  return {
    id:p.id,
    lat:p.lat,
    lon:p.lon,
    t2m:param?.T2M??null,
    precip:param?.PRECTOTCORR??null,
    solar:param?.ALLSKY_SFC_SW_DWN??null,
  };
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:nasa-power',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const endDate=new Date();
    const startDate=new Date(Date.now()-6*24*60*60*1000);
    const start=ymd(startDate);
    const end=ymd(endDate);

    const points=[];
    for(const p of POINTS){
      try { points.push(await fetchPoint(p,start,end)); } catch {}
    }

    const payload={
      source:'power.larc.nasa.gov',
      period:{start,end},
      parameters:['T2M','PRECTOTCORR','ALLSKY_SFC_SW_DWN'],
      points,
      total:points.length,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
