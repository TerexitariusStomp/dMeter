#!/usr/bin/env node
/**
 * 7Timer weather forecast snapshots (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:7timer-forecast:v1';
const CACHE_TTL=3*60*60;
const C=[['nyc',40.71427,-74.00597],['london',51.5074,-0.1278],['dubai',25.2048,55.2708],['singapore',1.3521,103.8198],['sydney',-33.8688,151.2093]];
async function one(name,lat,lon){
  const u=`https://www.7timer.info/bin/civil.php?lon=${lon}&lat=${lat}&ac=0&unit=metric&output=json`;
  const r=await fetch(u,{headers:{Accept:'application/json, text/html','User-Agent':CHROME_UA},signal:AbortSignal.timeout(20_000)});
  if(!r.ok) throw new Error(`7Timer ${name} HTTP ${r.status}`);
  const t=await r.text();
  let d={};
  try{d=JSON.parse(t);}catch{d={raw:t.slice(0,500)}}
  return {city:name,product:d?.product??null,init:d?.init??null,next:Array.isArray(d?.dataseries)?d.dataseries.slice(0,8):[]};
}
await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:7timer-forecast',
  cacheTtl: CACHE_TTL,
  async fetch(){
    const out=[];
    for(const [n,lat,lon] of C){ try{ out.push(await one(n,lat,lon)); }catch{} }
    const payload={source:'7timer.info',cities:out,total:out.length,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
