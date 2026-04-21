#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:sg-weather:v1';
const CACHE_TTL=10*60;
const BASE='https://api-open.data.gov.sg/v2/real-time/api';

async function fetchApi(path){
  const res=await fetch(`${BASE}/${path}`,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(20_000)});
  if(!res.ok) throw new Error(`sg-weather ${path} HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:sg-weather',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const [airTemperature,twoHrForecast,rainfall]=await Promise.all([
      fetchApi('air-temperature').catch(()=>null),
      fetchApi('two-hr-forecast').catch(()=>null),
      fetchApi('rainfall').catch(()=>null),
    ]);
    const payload={
      source:'api-open.data.gov.sg',
      airTemperature,
      twoHrForecast,
      rainfall,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
