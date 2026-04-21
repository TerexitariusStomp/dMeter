#!/usr/bin/env node
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

loadEnvFile(import.meta.url);
const CANONICAL_KEY='dmrv:restor-eco:v1';
const CACHE_TTL=24*60*60;

function loadLocalSummary(){
  try{
    const base='/root/workspace/restor-map-api/output';
    const dirs=readdirSync(base,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name.startsWith('global_z6_')).map(d=>d.name).sort().reverse();
    if(!dirs.length) return null;
    const p=join(base,dirs[0],'summary.json');
    return JSON.parse(readFileSync(p,'utf8'));
  }catch{return null;}
}

async function fetchTile(){
  const url='https://restor2-prod-1-api.restor.eco/sites/6/tiles/6/0/0?visibility=PUBLIC&radius=12&tileContent=CENTER_POINTS&tileContent=POLYGONS';
  const res=await fetch(url,{headers:{Accept:'application/vnd.mapbox-vector-tile,*/*','User-Agent':CHROME_UA},signal:AbortSignal.timeout(25000)});
  return {status:res.status, ok:res.ok, bytes:Number(res.headers.get('content-length')||0), content_type:res.headers.get('content-type')||null};
}

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:restor-eco',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const tile=await fetchTile();
    const local_summary=loadLocalSummary();
    const payload={source:'restor.eco',tile_probe:tile,local_summary,fetchedAt:new Date().toISOString()};
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
