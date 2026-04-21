#!/usr/bin/env node
/**
 * seed-worms-marine-species.mjs
 * WoRMS marine species taxonomy snapshots (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:worms-marine-species:v1';
const CACHE_TTL=24*60*60;
const QUERIES=['Chelonia','Delphinus','Thunnus','Scomber'];

async function fetchQuery(name){
  const url=`https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(name)}?like=true&marine_only=true&offset=1`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
  if(!res.ok) throw new Error(`WoRMS ${name} HTTP ${res.status}`);
  const d=await res.json();
  const arr=Array.isArray(d)?d:[];
  return {
    query:name,
    count:arr.length,
    sample:arr.slice(0,50).map((x)=>({
      AphiaID:x?.AphiaID ?? null,
      scientificname:x?.scientificname ?? null,
      status:x?.status ?? null,
      rank:x?.rank ?? null,
      kingdom:x?.kingdom ?? null,
      phylum:x?.phylum ?? null,
      class:x?.class ?? null,
      order:x?.order ?? null,
      family:x?.family ?? null,
      genus:x?.genus ?? null,
    })),
  };
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:worms-marine-species',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const queries=[];
    for(const q of QUERIES){ try{ queries.push(await fetchQuery(q)); }catch{} }
    const payload={ source:'www.marinespecies.org', queries, total:queries.length, fetchedAt:new Date().toISOString() };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
