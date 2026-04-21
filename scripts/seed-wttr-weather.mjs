#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:wttr-weather:v1';
const CACHE_TTL=60*60;
const CITIES=['Berlin','London','New York','Singapore','Dubai'];

async function fetchCity(city){
  const url=`https://wttr.in/${encodeURIComponent(city)}?format=j1`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25_000)});
  if(!res.ok) throw new Error(`wttr HTTP ${res.status}`);
  const d=await res.json();
  return {city,current:d?.current_condition?.[0]??null,weather:Array.isArray(d?.weather)?d.weather.slice(0,3):[]};
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:wttr-weather',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const cities=[];
    for(const c of CITIES){ try{ cities.push(await fetchCity(c)); }catch{} }
    const payload={source:'wttr.in',cities,total:cities.length,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
