#!/usr/bin/env node
/**
 * OpenTopoData elevation snapshots for key cities (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:opentopodata:v1';
const CACHE_TTL=24*60*60;
const P=[['nyc',40.71427,-74.00597],['la',34.0522,-118.2437],['london',51.5074,-0.1278],['tokyo',35.6762,139.6503],['dubai',25.2048,55.2708],['singapore',1.3521,103.8198],['sydney',-33.8688,151.2093]];
await runSeed({
  canonicalKey: CANONICAL_KEY,
  metaKey: 'seed-meta:dmrv:opentopodata',
  cacheTtl: CACHE_TTL,
  async fetch(){
    const loc=P.map(([,a,b])=>`${a},${b}`).join('|');
    const url=`https://api.opentopodata.org/v1/etopo1?locations=${encodeURIComponent(loc)}`;
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(20_000)});
    if(!res.ok) throw new Error(`OpenTopoData HTTP ${res.status}`);
    const d=await res.json();
    const rows=Array.isArray(d?.results)?d.results:[];
    const points=rows.map((r,i)=>({id:P[i]?.[0]??`p${i}`,lat:r?.location?.lat??null,lon:r?.location?.lng??null,elevation_m:r?.elevation??null,dataset:r?.dataset??null}));
    const payload={source:'opentopodata.org',points,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
