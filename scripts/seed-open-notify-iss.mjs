#!/usr/bin/env node
/**
 * seed-open-notify-iss.mjs
 * Open Notify ISS position + crew snapshot (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:open-notify-iss:v1';
const CACHE_TTL=5*60;

async function getJson(url){
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(20_000)});
  if(!res.ok) throw new Error(`Open Notify HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:open-notify-iss',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const now=await getJson('http://api.open-notify.org/iss-now.json');
    const astros=await getJson('http://api.open-notify.org/astros.json');
    const payload={
      source:'api.open-notify.org',
      iss_position: now?.iss_position ?? null,
      iss_timestamp: now?.timestamp ?? null,
      astronauts_total: astros?.number ?? null,
      astronauts: Array.isArray(astros?.people) ? astros.people : [],
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
