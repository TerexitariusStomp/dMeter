#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:ebird:v1';
const CACHE_TTL=6*60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:ebird',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://ebird.org/mapServices/genHsForWindow.do?maxY=85&maxX=180&minY=-85&minX=-180&yr=all&m=';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(30000)});
    if(!res.ok) throw new Error(`ebird HTTP ${res.status}`);
    const d=await res.json();
    const arr=Array.isArray(d)?d:[];
    const payload={source:'ebird.org',count:arr.length,sample:arr.slice(0,500),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
