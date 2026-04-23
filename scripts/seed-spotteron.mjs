#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:spotteron:v1';
const CACHE_TTL=60*60;

async function getPage(topicId=32,page=1,limit=200){
  const url=`https://www.spotteron.com/api/v2.6/spots?filter%5Btopic_id%5D=${topicId}&order%5B%5D=id%20DESC&limit=${limit}&page=${page}`;
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25000)});
  if(!res.ok) throw new Error(`spotteron HTTP ${res.status}`);
  return res.json();
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:spotteron',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const d=await getPage();
    const items=Array.isArray(d?.data)?d.data:[];
    const payload={source:'www.spotteron.com',topic_id:32,count:items.length,sample:items.slice(0,200),fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
