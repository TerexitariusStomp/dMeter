#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:naturespots:v1';
const CACHE_TTL=60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:naturespots',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://www.spotteron.com/api/v2.6/spots?filter%5Btopic_id%5D=32&order%5B%5D=id%20DESC&limit=200&page=1';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25000)});
    if(!res.ok) throw new Error(`naturespots HTTP ${res.status}`);
    const d=await res.json();
    const arr=Array.isArray(d?.data)?d.data:[];
    const payload={source:'www.spotteron.com (naturespots topic)',topic_id:32,count:arr.length,sample:arr.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
