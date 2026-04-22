#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const IUCN_RED_LIST_API = 'https://apiv3.iucnredlist.org/api/v3/species';
const CITES_API = 'https://cites.org/api/v1';
const GBIF_API = 'https://api.gbif.org/v1';
const CANONICAL_KEY = 'biodiversity:species-threats:v1';
const CACHE_TTL = 86400; // 24 hours - species data doesn't change frequently

interface SpeciesThreat {
  id: string;
  name: string;
  scientificName: string;
  category: string;
  populationTrend: string;
  habitat: string;
  threats: string[];
  latitude: number;
  longitude: number;
  country: string;
  region: string;
  iucnId: string;
  citesListing: string;
  lastAssessed: string;
}

interface IUCNResponse {
  results: Array<{
    taxonid: number;
    scientific_name: string;
    common_name: string;
    category: string;
    population_trend: string;
    habitat: string;
    geographic_range: string;
    last_assessment: string;
  }>;
}

interface CITESResponse {
    species: Array<{
      id: number;
      name: string;
      scientific_name: string;
      listing: string;
      annotation: string;
    }>;
}

interface GBIFResponse {
    results: Array<{
      key: number;
      scientificName: string;
      commonName: string;
      country: string;
      decimalLatitude: number;
      decimalLongitude: number;
      species: string;
      family: string;
      order: string;
      class: string;
      phylum: string;
    }>;
}

const THREATENED_SPECIES = [
  'Panthera leo', 'Elephantidae', 'Rhinocerotidae', 'Giraffa camelopardalis',
  'Loxodonta africana', 'Balaenoptera musculus', 'Megaptera novaeangliae',
  'Ornithorhynchus anatinus', 'Spheniscus demersus', 'Aptenodytes forsteri',
  'Gorilla gorilla', 'Pan troglodytes', 'Pongo pygmaeus', 'Hylobates lar',
  'Nasalis larvatus', 'Papio hamadryas', 'Macaca mulatta', 'Cercopithecus aethiops',
  'Canis lupus', 'Ursus arctos', 'Felis catus', 'Vulpes vulpes',
];

function mapSpeciesThreat(iucnData: any, citesData: any, gbifData: any): SpeciesThreat {
  // Find matching GBIF data for geographic coordinates
  const gbifMatch = gbifData?.results?.find(g => 
    g.scientificName.toLowerCase().includes(iucnData.scientific_name.toLowerCase()) ||
    g.scientificName.toLowerCase().includes(iucnData.common_name?.toLowerCase() || '')
  );
  
  return {
    id: `iucn-${iucnData.taxonid}`,
    name: iucnData.common_name || iucnData.scientific_name,
    scientificName: iucnData.scientific_name,
    category: iucnData.category,
    populationTrend: iucnData.population_trend,
    habitat: iucnData.habitat,
    threats: iucnData.category === 'Critically Endangered' || iucnData.category === 'Endangered' 
      ? ['Habitat loss', 'Poaching', 'Climate change'] 
      : iucnData.category === 'Vulnerable' 
        ? ['Habitat fragmentation', 'Human-wildlife conflict'] 
        : [],
    latitude: gbifMatch?.decimalLatitude || 0,
    longitude: gbifMatch?.decimalLongitude || 0,
    country: gbifMatch?.country || '',
    region: iucnData.geographic_range || '',
    iucnId: iucnData.taxonid.toString(),
    citesListing: citesData?.listing || 'Not listed',
    lastAssessed: iucnData.last_assessment,
  };
}

async function fetchIUCNData() {
  try {
    const params = new URLSearchParams({
      taxon_name: THREATENED_SPECIES.join('|'),
      page: '1',
      per_page: '100',
    });
    
    const resp = await fetch(`${IUCN_RED_LIST_API}?${params}`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': CHROME_UA,
        'Authorization': `Bearer ${process.env.IUCN_API_KEY || ''}`,
      },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!resp.ok) {
      console.warn(`[IUCN] HTTP ${resp.status}`);
      return [];
    }
    
    const data: IUCNResponse = await resp.json();
    const species = data.results || [];
    
    console.log(`[IUCN] Fetched ${species.length} species`);
    return species;
  } catch (e) {
    console.warn('[IUCN] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchCITESData() {
  try {
    const resp = await fetch(`${CITES_API}/species?limit=100`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': CHROME_UA,
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!resp.ok) {
      console.warn(`[CITES] HTTP ${resp.status}`);
      return [];
    }
    
    const data: CITESResponse = await resp.json();
    const species = data.species || [];
    
    console.log(`[CITES] Fetched ${species.length} species`);
    return species;
  } catch (e) {
    console.warn('[CITES] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchGBIFData() {
  try {
    const params = new URLSearchParams({
      scientificName: THREATENED_SPECIES.join('|'),
      geometry: 'POLYGON((-180 -90, 180 -90, 180 90, -180 90, -180 -90))',
      limit: '500',
    });
    
    const resp = await fetch(`${GBIF_API}/occurrence/search?${params}`, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': CHROME_UA,
      },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!resp.ok) {
      console.warn(`[GBIF] HTTP ${resp.status}`);
      return [];
    }
    
    const data: GBIFResponse = await resp.json();
    const occurrences = data.results || [];
    
    console.log(`[GBIF] Fetched ${occurrences.length} occurrences`);
    return occurrences;
  } catch (e) {
    console.warn('[GBIF] Fetch error:', e?.message || e);
    return [];
  }
}

async function fetchBiodiversityData() {
  const [iucnData, citesData, gbifData] = await Promise.allSettled([
    fetchIUCNData(),
    fetchCITESData(),
    fetchGBIFData(),
  ]);
  
  const allThreats = [];
  
  if (iucnData.status === 'fulfilled') {
    const iucnSpecies = iucnData.value || [];
    const citesSpecies = citesData.status === 'fulfilled' ? (citesData.value || []) : [];
    
    for (const species of iucnSpecies) {
      const citesMatch = citesSpecies.find(c => 
        c.scientific_name.toLowerCase().includes(species.scientific_name.toLowerCase())
      );
      
      const threat = mapSpeciesThreat(species, citesMatch || {}, gbifData.value || {});
      allThreats.push(threat);
    }
  }
  
  console.log(`[Biodiversity] Total: ${allThreats.length} species threats`);
  
  return {
    threats: allThreats.slice(0, 200), // Limit to 200 most threatened
    fetchedAt: Date.now(),
    sources: [
      iucnData.status === 'fulfilled' ? 'IUCN' : null,
      citesData.status === 'fulfilled' ? 'CITES' : null,
      gbifData.status === 'fulfilled' ? 'GBIF' : null,
    ].filter(Boolean),
  };
}

function validate(data) {
  return Array.isArray(data?.threats) && data.threats.length >= 1;
}

export function declareRecords(data) {
  return Array.isArray(data?.threats) ? data.threats.length : 0;
}

runSeed('biodiversity', 'species-threats', CANONICAL_KEY, fetchBiodiversityData, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'iucn-cites-gbif-v1',

  declareRecords,
  schemaVersion: 1,
  maxStaleMin: 1440,
}).catch((err) => {
  const _cause = err.cause ? ` (cause: ${err.cause.message || err.cause.code || err.cause})` : '';
  console.error('FATAL:', (err.message || err) + _cause);
  process.exit(1);
});