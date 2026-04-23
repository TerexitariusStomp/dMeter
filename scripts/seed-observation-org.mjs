#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:observation-org:v1';
const CACHE_TTL=6*60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:observation-org',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://observation.org/fieldwork/observations/explore/?json=species_seen&point=POINT(5.1214%2052.0907)&distance=5&end_date='+new Date().toISOString().slice(0,10);
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA,'Referer':'https://observation.org/fieldwork/'},signal:AbortSignal.timeout(25000)});
    if(!res.ok) throw new Error(`observation HTTP ${res.status}`);
    const d=await res.json();
    const rows=Array.isArray(d?.data)?d.data:[];
    const features=Array.isArray(d?.geojson?.features)?d.geojson.features:[];
    const payload={source:'observation.org',species_rows:rows.length,feature_count:features.length,sample_features:features.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
