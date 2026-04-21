#!/usr/bin/env node
/**
 * seed-aare-river.mjs
 * Aare.guru river temperature/current for Bern (no auth).
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:aare-river:v1';
const CACHE_TTL=30*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:aare-river',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://aareguru.existenz.ch/v2018/current?city=bern';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(15_000)});
    if(!res.ok) throw new Error(`Aare.guru HTTP ${res.status}`);
    const d=await res.json();
    const payload={source:'aareguru.existenz.ch',current:d?.aare??null,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
