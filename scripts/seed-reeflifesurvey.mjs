#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:reeflifesurvey:v1';
const CACHE_TTL=24*60*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:reeflifesurvey',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://reeflifesurvey.com/explorer/json/map-data.php?initial=1&location_type=1&location=1&indicator=4&year=2026&years=%5B%222026%22,%222025%22,%222024%22%5D';
    const res=await fetch(url,{headers:{Accept:'application/json,*/*','User-Agent':CHROME_UA,'Referer':'https://reeflifesurvey.com/explorer/map'},signal:AbortSignal.timeout(30000)});
    if(!res.ok) throw new Error(`reeflifesurvey HTTP ${res.status}`);
    const d=await res.json();
    const survey=Array.isArray(d?.markers?.survey_markers)?d.markers.survey_markers:[];
    const perm=Array.isArray(d?.markers?.permanent_markers)?d.markers.permanent_markers:[];
    const payload={source:'reeflifesurvey.com',survey_markers:survey.length,permanent_markers:perm.length,survey_sample:survey.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
