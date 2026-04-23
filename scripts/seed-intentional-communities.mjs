#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:intentional-communities:v1';
const CACHE_TTL=6*60*60;
const BASE=(process.env.INTENTIONAL_API_BASE||'http://127.0.0.1:8020').replace(/\/$/, '');

async function fetchJson(path){
  const res=await fetch(`${BASE}${path}`,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(30_000)});
  if(!res.ok) throw new Error(`intentional-community API ${path} HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:intentional-communities',
  cacheTtl:CACHE_TTL,
  async fetch(){
    let reachable=false;
    let health=null;
    let summary=null;
    let sample=[];
    let geojsonMeta=null;
    let error=null;
    try{
      health=await fetchJson('/health');
      summary=await fetchJson('/communities/summary');
      const communities=await fetchJson('/communities?with_coordinates_only=true&limit=200&offset=0');
      const geojson=await fetchJson('/communities/geojson');
      reachable=true;
      sample=Array.isArray(communities?.items)?communities.items.slice(0,200):[];
      geojsonMeta=geojson?.metadata??null;
    }catch(e){
      error=String(e?.message||e);
    }

    const payload={
      source:'intentional-community-api',
      base_url:BASE,
      reachable,
      health,
      summary,
      sample,
      sample_count:Array.isArray(sample)?sample.length:0,
      geojson_meta:geojsonMeta,
      error,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
