#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:websitecarbon-data:v1';
const CACHE_TTL=24*60*60;
const PROFILES=[
  {name:'light-page-500kb', bytes:500_000, green:1},
  {name:'avg-page-2mb', bytes:2_000_000, green:0},
  {name:'heavy-page-8mb', bytes:8_000_000, green:0},
  {name:'cdn-green-2mb', bytes:2_000_000, green:1},
];

async function fetchProfile(p){
  const u=`https://api.websitecarbon.com/data?bytes=${encodeURIComponent(String(p.bytes))}&green=${encodeURIComponent(String(p.green))}`;
  const res=await fetch(u,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(20_000)});
  if(!res.ok) throw new Error(`websitecarbon HTTP ${res.status}`);
  const d=await res.json();
  return {name:p.name,bytes:p.bytes,green:Boolean(p.green),data:d};
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:websitecarbon-data',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const profiles=[];
    for(const p of PROFILES){ try{ profiles.push(await fetchProfile(p)); }catch{} }
    const payload={source:'api.websitecarbon.com',profiles,total:profiles.length,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
