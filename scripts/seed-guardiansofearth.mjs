#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:guardiansofearth:v1';
const CACHE_TTL=60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:guardiansofearth',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://api.guardiansofearth.io/stories?offset=0&limit=200';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25000)});
    if(!res.ok) throw new Error(`guardians HTTP ${res.status}`);
    const d=await res.json();
    const arr=Array.isArray(d)?d:[];
    const payload={source:'api.guardiansofearth.io',count:arr.length,sample:arr.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
