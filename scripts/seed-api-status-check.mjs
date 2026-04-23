#!/usr/bin/env node
/**
 * seed-api-status-check.mjs
 * APIStatusCheck operational status snapshot (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:api-status-check:v1';
const CACHE_TTL=30*60;
await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:api-status-check',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://apistatuscheck.com/api/status';
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(20_000)});
    if(!res.ok) throw new Error(`APIStatusCheck HTTP ${res.status}`);
    const d=await res.json();
    const apis=Array.isArray(d?.apis)?d.apis:[];
    const by_status={};
    for(const a of apis){const s=a?.status||'unknown';by_status[s]=(by_status[s]||0)+1;}
    const payload={source:'apistatuscheck.com',count:d?.count??apis.length,lastUpdated:d?.lastUpdated??null,by_status,sample:apis.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
