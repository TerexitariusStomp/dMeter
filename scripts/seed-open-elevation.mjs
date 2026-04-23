#!/usr/bin/env node
/**
 * seed-open-elevation.mjs
 * Open-Elevation snapshots for reference geolocations (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:open-elevation:v1';
const CACHE_TTL=24*60*60;
const POINTS=[
  { id:'porto', lat:41.161758, lon:-8.583933 },
  { id:'kansas', lat:39.7456, lon:-97.0892 },
  { id:'berlin', lat:52.52, lon:13.41 },
  { id:'dubai', lat:25.2048, lon:55.2708 },
  { id:'singapore', lat:1.3521, lon:103.8198 },
];

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:open-elevation',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const loc=POINTS.map((p)=>`${p.lat},${p.lon}`).join('|');
    const url=`https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(loc)}`;
    const res=await fetch(url,{headers:{Accept:'application/json','User-Agent':CHROME_UA},signal:AbortSignal.timeout(20_000)});
    if(!res.ok) throw new Error(`Open-Elevation HTTP ${res.status}`);
    const d=await res.json();
    const arr=Array.isArray(d?.results)?d.results:[];
    const points=arr.map((r,idx)=>({
      id: POINTS[idx]?.id ?? `p${idx+1}`,
      lat: r?.latitude ?? null,
      lon: r?.longitude ?? null,
      elevation_m: Number.isFinite(Number(r?.elevation)) ? Number(r.elevation) : null,
    }));
    const payload={
      source:'api.open-elevation.com',
      points,
      total:points.length,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
