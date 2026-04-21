#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:citsci:v1';
const CACHE_TTL=6*60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:citsci',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://api.citsci.org/projects?page=1';
    const res=await fetch(url,{headers:{Accept:'application/ld+json,application/json,*/*','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25000)});
    if(!res.ok) throw new Error(`citsci HTTP ${res.status}`);
    const d=await res.json();
    const items=Array.isArray(d?.['hydra:member'])?d['hydra:member']:[];
    const payload={source:'api.citsci.org',totalItems:d?.['hydra:totalItems']??null,count:items.length,sample:items.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
