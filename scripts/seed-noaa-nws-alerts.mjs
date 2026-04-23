#!/usr/bin/env node
/**
 * seed-noaa-nws-alerts.mjs
 * NOAA/NWS active alerts snapshot (no auth)
 */
import { loadEnvFile, runSeed, CHROME_UA, verifySeedKey } from './_seed-utils.mjs';
loadEnvFile(import.meta.url);

const CANONICAL_KEY='dmrv:noaa-nws-alerts:v1';
const CACHE_TTL=15*60;

await runSeed({
  canonicalKey:CANONICAL_KEY,
  metaKey:'seed-meta:dmrv:noaa-nws-alerts',
  cacheTtl:CACHE_TTL,
  async fetch(){
    const url='https://api.weather.gov/alerts/active?status=actual&message_type=alert';
    const res=await fetch(url,{headers:{Accept:'application/geo+json','User-Agent':`dMeter/1.0 (${CHROME_UA})`},signal:AbortSignal.timeout(25_000)});
    if(!res.ok) throw new Error(`NOAA NWS HTTP ${res.status}`);
    const d=await res.json();
    const features=Array.isArray(d?.features)?d.features:[];

    const bySeverity={};
    const byEvent={};
    for(const f of features){
      const p=f?.properties||{};
      const sev=p.severity||'Unknown';
      const evt=p.event||'Unknown';
      bySeverity[sev]=(bySeverity[sev]||0)+1;
      byEvent[evt]=(byEvent[evt]||0)+1;
    }

    const topEvents=Object.entries(byEvent)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,20)
      .map(([event,count])=>({event,count}));

    const sample=features.slice(0,200).map((f)=>({
      id:f?.id??null,
      event:f?.properties?.event??null,
      severity:f?.properties?.severity??null,
      urgency:f?.properties?.urgency??null,
      certainty:f?.properties?.certainty??null,
      areaDesc:f?.properties?.areaDesc??null,
      sent:f?.properties?.sent??null,
      expires:f?.properties?.expires??null,
    }));

    const payload={
      source:'api.weather.gov',
      total:features.length,
      title:d?.title??null,
      updated:d?.updated??null,
      bySeverity,
      topEvents,
      sample,
      fetchedAt:new Date().toISOString(),
    };
    await verifySeedKey(CANONICAL_KEY,'fetchedAt');
    return payload;
  }
});
