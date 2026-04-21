#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:surftruths-gfs-locations:v1';
const CACHE_TTL=6*60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:surftruths-gfs-locations',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const res=await fetch('https://surftruths.com/api/gfs/locations.json',{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
    if(!res.ok) throw new Error(`surftruths gfs locations HTTP ${res.status}`);
    const rows=await res.json();
    const list=Array.isArray(rows)?rows:[];
    const payload={
      source:'surftruths.com',
      endpoint:'/api/gfs/locations.json',
      total:list.length,
      sample:list,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
