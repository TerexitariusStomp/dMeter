#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:surftruths-tide-stations:v1';
const CACHE_TTL=24*60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:surftruths-tide-stations',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const res=await fetch('https://surftruths.com/api/tide/stations.json',{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(30_000)});
    if(!res.ok) throw new Error(`surftruths tide stations HTTP ${res.status}`);
    const rows=await res.json();
    const list=Array.isArray(rows)?rows:[];
    const payload={
      source:'surftruths.com',
      endpoint:'/api/tide/stations.json',
      total:list.length,
      sample:list.slice(0,1000),
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
