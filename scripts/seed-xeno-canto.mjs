#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:xeno-canto:v1';
const CACHE_TTL=6*60*60;
const API_KEY=(process.env.XENO_CANTO_API_KEY||'').trim();

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:xeno-canto',
  cacheTtl:CACHE_TTL,
  async fetch(){
    if(!API_KEY){
      const payload={source:'xeno-canto.org',api_key_configured:false,note:'Set XENO_CANTO_API_KEY to fetch recordings (API v3 requires key).',fetchedAt:new Date().toISOString()};
      await verifySeedKey(CANONICAL_KEY,'fetchedAt');
      return payload;
    }
    const q=encodeURIComponent('cnt:australia');
    const url=`https://xeno-canto.org/api/3/recordings?query=${q}&key=${encodeURIComponent(API_KEY)}&page=1`;
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25000)});
    if(!res.ok) throw new Error(`xeno-canto HTTP ${res.status}`);
    const d=await res.json();
    const recs=Array.isArray(d?.recordings)?d.recordings:[];
    const payload={source:'xeno-canto.org',api_key_configured:true,numRecordings:d?.numRecordings??null,numPages:d?.numPages??null,sample:recs.slice(0,100),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
