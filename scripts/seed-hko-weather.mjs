#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:hko-weather:v1';
const CACHE_TTL=15*60;

async function fetchJson(url){
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(20_000)});
  if(!res.ok) throw new Error(`hko HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:hko-weather',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const [rhrread,warnsum]=await Promise.all([
      fetchJson('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en').catch(()=>null),
      fetchJson('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en').catch(()=>null),
    ]);
    const payload={
      source:'data.weather.gov.hk',
      rhrread,
      warnsum,
      has_rhrread:!!rhrread,
      has_warnsum:!!warnsum,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
