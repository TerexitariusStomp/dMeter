#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:inaturalist:v1';
const CACHE_TTL=60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:inaturalist',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://api.inaturalist.org/v1/observations?per_page=200&order=desc&order_by=created_at';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25000)});
    if(!res.ok) throw new Error(`inaturalist HTTP ${res.status}`);
    const d=await res.json();
    const arr=Array.isArray(d?.results)?d.results:[];
    const payload={source:'api.inaturalist.org',total_results:d?.total_results??null,count:arr.length,sample:arr.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
