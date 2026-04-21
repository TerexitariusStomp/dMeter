#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:plantnet:v1';
const CACHE_TTL=24*60*60;
const API_KEY=(process.env.PLANTNET_API_KEY||'').trim();

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:plantnet',
  cacheTtl:CACHE_TTL,
  async fetch(){
    if(!API_KEY){
      const payload={source:'my-api.plantnet.org',api_key_configured:false,note:'Set PLANTNET_API_KEY to enable PlantNet data.',fetchedAt:new Date().toISOString()};
      await verifySeedKey(CANONICAL_KEY,'fetchedAt');
      return payload;
    }
    const url=`https://my-api.plantnet.org/v2/species?lang=en&type=kt&api-key=${encodeURIComponent(API_KEY)}`;
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25000)});
    if(!res.ok) throw new Error(`plantnet HTTP ${res.status}`);
    const d=await res.json();
    const arr=Array.isArray(d)?d:[];
    const payload={source:'my-api.plantnet.org',api_key_configured:true,count:arr.length,sample:arr.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
