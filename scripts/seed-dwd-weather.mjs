#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:dwd-weather:v1';
const CACHE_TTL=30*60;
const BASE='https://app-prod-ws.warnwetter.de/v30';
const STATIONS=['10865','G005','10488','10513','01028'];

async function fetchStation(stationId){
  const url=`${BASE}/stationOverviewExtended?stationIds=${encodeURIComponent(stationId)}`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
  if(!res.ok) throw new Error(`dwd station ${stationId} HTTP ${res.status}`);
  const d=await res.json();
  const row=d?.[stationId]??null;
  return {stationId,data:row};
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:dwd-weather',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const stations=[];
    for(const s of STATIONS){
      try{ stations.push(await fetchStation(s)); }catch{}
    }
    const payload={
      source:'app-prod-ws.warnwetter.de',
      endpoint:'/v30/stationOverviewExtended',
      stations,
      total:stations.length,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
