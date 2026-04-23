#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:naturemapr:v1';
const CACHE_TTL=6*60*60;
const JWT=(process.env.NATUREMAPR_JWT||'').trim();

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:naturemapr',
  cacheTtl:CACHE_TTL,
  async fetch(){
    if(!JWT){
      const payload={source:'api.naturemapr.org',jwt_configured:false,note:'Set NATUREMAPR_JWT to fetch sightings.',fetchedAt:new Date().toISOString()};
      await verifySeedKey(CANONICAL_KEY,'fetchedAt');
      return payload;
    }
    const headers={Accept:'application/json','User-Agent':CHROME_UA,Authorization:`Bearer ${JWT}`};
    const countRes=await fetch('https://api.naturemapr.org/api/sightings/count',{headers,signal:AbortSignal.timeout(25000)});
    if(!countRes.ok) throw new Error(`naturemapr count HTTP ${countRes.status}`);
    const total=await countRes.json();
    const rowsRes=await fetch('https://api.naturemapr.org/api/sightings?pageNumber=1&pageSize=200',{headers,signal:AbortSignal.timeout(25000)});
    if(!rowsRes.ok) throw new Error(`naturemapr sightings HTTP ${rowsRes.status}`);
    const rows=await rowsRes.json();
    const payload={source:'api.naturemapr.org',jwt_configured:true,total_count:total??null,sample:Array.isArray(rows)?rows.slice(0,200):[],fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
