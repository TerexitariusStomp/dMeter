#!/usr/bin/env node
/**
 * seed-nasa-open.mjs
 * NASA Open APIs snapshot (APOD + NEO feed) using DEMO_KEY fallback.
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:nasa-open:v1';
const CACHE_TTL=6*60*60;
const API_KEY=String(process.env.NASA_OPEN_API_KEY || process.env.NASA_API_KEY || 'DEMO_KEY').trim() || 'DEMO_KEY';

async function getJson(url){
  const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
  if(!r.ok) throw new Error(`NASA HTTP ${r.status}`);
  return r.json();
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:nasa-open',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const today=new Date();
    const prev=new Date(today.getTime()-24*3600*1000);
    const ds=(d)=>d.toISOString().slice(0,10);
    const apod=await getJson(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(API_KEY)}`);
    const neo=await getJson(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${ds(prev)}&end_date=${ds(today)}&api_key=${encodeURIComponent(API_KEY)}`);
    const count=neo?.element_count ?? null;
    const payload={
      source:'api.nasa.gov',
      api_key_mode: API_KEY==='DEMO_KEY'?'demo':'custom',
      apod: { date: apod?.date ?? null, title: apod?.title ?? null, url: apod?.url ?? null, media_type: apod?.media_type ?? null },
      neo: { element_count: count, links: neo?.links ?? null },
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
