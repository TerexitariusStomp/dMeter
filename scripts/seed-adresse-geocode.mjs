#!/usr/bin/env node
/**
 * seed-adresse-geocode.mjs
 * France adresse.data.gouv.fr geocoding snapshots (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:adresse-geocode:v1';
const CACHE_TTL=24*60*60;
const QUERIES=['8 bd du port','10 avenue des champs-elysees','1 rue de rivoli paris'];

async function geocode(q){
  const url=`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(15_000)});
  if(!res.ok) throw new Error(`adresse API HTTP ${res.status}`);
  const d=await res.json();
  const f=d?.features?.[0] ?? null;
  return {query:q,label:f?.properties?.label??null,score:f?.properties?.score??null,coordinates:f?.geometry?.coordinates??null};
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:adresse-geocode',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const results=[];
    for(const q of QUERIES){ try{ results.push(await geocode(q)); }catch{} }
    const payload={source:'api-adresse.data.gouv.fr',results,total:results.length,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
