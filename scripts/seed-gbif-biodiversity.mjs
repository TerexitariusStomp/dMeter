#!/usr/bin/env node
/**
 * GBIF global biodiversity occurrence sample (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:gbif-biodiversity:v1';
const CACHE_TTL=6*60*60;
await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:gbif-biodiversity',
  cacheTtl: CACHE_TTL,
  async fetch(){
    const url='https://api.gbif.org/v1/occurrence/search?limit=200';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
    if(!res.ok) throw new Error(`GBIF HTTP ${res.status}`);
    const d=await res.json();
    const rows=Array.isArray(d?.results)?d.results:[];
    const speciesCount={};
    for(const r of rows){const s=r?.species||r?.scientificName||'unknown';speciesCount[s]=(speciesCount[s]||0)+1;}
    const top_species=Object.entries(speciesCount).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([species,count])=>({species,count}));
    const payload={source:'gbif.org',total_available:d?.count??null,sample_size:rows.length,top_species,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
