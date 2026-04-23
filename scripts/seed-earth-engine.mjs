#!/usr/bin/env node
/**
 * seed-earth-engine.mjs
 * Earth Engine public catalog snapshot (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:earth-engine:v1';
const CACHE_TTL=24*60*60;
const CATALOG_URL='https://earthengine-stac.storage.googleapis.com/catalog/catalog.json';

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:earth-engine',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const res=await fetch(CATALOG_URL,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(30_000)});
    if(!res.ok) throw new Error(`Earth Engine catalog HTTP ${res.status}`);
    const d=await res.json();

    const links=Array.isArray(d?.links)?d.links:[];
    const childLinks=links.filter((l)=>l && (l.rel==='child' || l.type==='application/json'));

    const payload={
      source:'earthengine-stac.storage.googleapis.com',
      title:d?.title ?? null,
      description:d?.description ?? null,
      id:d?.id ?? null,
      stac_version:d?.stac_version ?? null,
      child_link_count:childLinks.length,
      links_sample:childLinks.slice(0,300).map((l)=>(
        {
          rel:l?.rel ?? null,
          title:l?.title ?? null,
          href:l?.href ?? null,
          type:l?.type ?? null,
        }
      )),
      fetchedAt:new Date().toISOString(),
    };

    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
