#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:nominatim-geocode:v1';
const CACHE_TTL=24*60*60;
const QUERIES=['Berlin','Singapore','New York','Sydney','Nairobi'];

async function search(q){
  const url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=20`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':`dMeter/1.0 (${CHROME_UA})`},signal:AbortSignal.timeout(25_000)});
  if(!res.ok) throw new Error(`nominatim HTTP ${res.status}`);
  const d=await res.json();
  const arr=Array.isArray(d)?d:[];
  return {query:q,count:arr.length,results:arr.slice(0,20)};
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:nominatim-geocode',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const searches=[];
    for(const q of QUERIES){ try{ searches.push(await search(q)); }catch{} }
    const payload={source:'nominatim.openstreetmap.org',searches,total:searches.length,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
