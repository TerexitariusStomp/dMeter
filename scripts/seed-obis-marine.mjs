#!/usr/bin/env node
/**
 * OBIS marine biodiversity occurrence sample (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:obis-marine:v1';
const CACHE_TTL=6*60*60;
await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:obis-marine',
  cacheTtl: CACHE_TTL,
  async fetch(){
    const url='https://api.obis.org/v3/occurrence?size=200';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
    if(!res.ok) throw new Error(`OBIS HTTP ${res.status}`);
    const d=await res.json();
    const rows=Array.isArray(d?.results)?d.results:[];
    const byClass={};
    for(const r of rows){const c=r?.class||'Unknown';byClass[c]=(byClass[c]||0)+1;}
    const top_classes=Object.entries(byClass).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([klass,count])=>({class:klass,count}));
    const payload={source:'api.obis.org',total_available:d?.total??null,sample_size:rows.length,top_classes,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
