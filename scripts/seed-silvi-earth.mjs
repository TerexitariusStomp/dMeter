#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:silvi-earth:v1';
const CACHE_TTL=6*60*60;
const BEARER=(process.env.SILVI_BEARER||'').trim();

async function getJson(url,auth=false){
  const headers={Accept:'application/json','User-Agent':CHROME_UA};
  if(auth&&BEARER) headers.Authorization=`Bearer ${BEARER}`;
  const res=await fetch(url,{headers,signal:AbortSignal.timeout(25000)});
  if(!res.ok) throw new Error(`silvi HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:silvi-earth',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const species=await getJson('https://api.silvi.earth/core/species/');
    let tree_list_preview=null;
    if(BEARER){
      try{
        const trees=await getJson('https://api.silvi.earth/core/tree_list/',true);
        tree_list_preview={feature_count:Array.isArray(trees?.features)?trees.features.length:null};
      }catch{}
    }
    const payload={source:'api.silvi.earth',bearer_configured:Boolean(BEARER),species_count:Array.isArray(species)?species.length:null,species_sample:Array.isArray(species)?species.slice(0,50):null,tree_list_preview,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
