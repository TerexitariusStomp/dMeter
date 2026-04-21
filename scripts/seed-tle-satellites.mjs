#!/usr/bin/env node
/**
 * seed-tle-satellites.mjs
 * Public TLE catalog snapshot (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:tle-satellites:v1';
const CACHE_TTL=6*60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:tle-satellites',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://tle.ivanstanojevic.me/api/tle';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(30_000)});
    if(!res.ok) throw new Error(`TLE API HTTP ${res.status}`);
    const d=await res.json();
    const members=Array.isArray(d?.member)?d.member:[];
    const payload={
      source:'tle.ivanstanojevic.me',
      totalItems:d?.totalItems ?? members.length,
      pageViewCount:members.length,
      sample:members.slice(0,200).map((m)=>(
        {
          satelliteId:m?.satelliteId ?? null,
          name:m?.name ?? null,
          date:m?.date ?? null,
          line1:m?.line1 ?? null,
          line2:m?.line2 ?? null,
        }
      )),
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
