#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:overpass-osm:v1';
const CACHE_TTL=6*60*60;
const QUERIES=[
  {id:'trees_bonn', q:'[out:json][timeout:25];node(50.6,7.0,50.8,7.3)["natural"="tree"];out body 500;'},
  {id:'waterways_berlin', q:'[out:json][timeout:25];way(52.45,13.25,52.6,13.55)["waterway"];out body 200;'},
];

async function fetchQuery(item){
  const url='https://overpass-api.de/api/interpreter?data='+encodeURIComponent(item.q);
  const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(35_000)});
  if(!res.ok) throw new Error(`overpass HTTP ${res.status}`);
  const d=await res.json();
  const elems=Array.isArray(d?.elements)?d.elements:[];
  return {id:item.id,count:elems.length,elements:elems.slice(0,500)};
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:overpass-osm',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const queries=[];
    for(const q of QUERIES){ try{ queries.push(await fetchQuery(q)); }catch{} }
    const payload={source:'overpass-api.de',queries,total:queries.length,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
