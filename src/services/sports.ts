import { toApiUrl } from '@/services/runtime';

export interface SportsLeague {
  id: string;
  sport: string;
  name: string;
  shortName: string;
  country?: string;
  tableSupported?: boolean;
}

export interface SportsLeagueOption {
  id: string;
  sport: string;
  name: string;
  shortName: string;
  alternateName?: string;
}

export interface SportsLeagueDetails extends SportsLeagueOption {
  country?: string;
  currentSeason?: string;
  formedYear?: string;
  badge?: string;
  description?: string;
  tableSupported?: boolean;
}

export interface SportsEvent {
  idEvent: string;
  idLeague?: string;
  strLeague?: string;
  strSeason?: string;
  strSport?: string;
  strEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strHomeBadge?: string;
  strAwayBadge?: string;
  strStatus?: string;
  strProgress?: string;
  strVenue?: string;
  strRound?: string;
  strTimestamp?: string;
  dateEvent?: string;
  strTime?: string;
  intHomeScore?: string;
  intAwayScore?: string;
}

export interface SportsFixtureGroup {
  league: SportsLeague;
  events: SportsEvent[];
}

export interface SportsStandingRow {
  rank: number;
  team: string;
  badge?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  points: number;
  form?: string;
  note?: string;
  season?: string;
}

export interface SportsTableGroup {
  league: SportsLeague;
  season?: string;
  updatedAt?: string;
  rows: SportsStandingRow[];
}

export interface SportsEventStat {
  label: string;
  homeValue?: string;
  awayValue?: string;
}

export interface SportsStatSnapshot {
  league: SportsLeague;
  event: SportsEvent;
  stats: SportsEventStat[];
}

export interface SportsLeagueCenterData {
  league: SportsLeagueDetails;
  seasons: string[];
  selectedSeason?: string;
  table: SportsTableGroup | null;
  tableAvailable: boolean;
  recentEvents: SportsEvent[];
  upcomingEvents: SportsEvent[];
  statSnapshot: SportsStatSnapshot | null;
}

export interface NbaStandingRow {
  rank: number;
  seed: number;
  team: string;
  abbreviation: string;
  badge?: string;
  wins: number;
  losses: number;
  winPercent: string;
  gamesBehind: string;
  homeRecord: string;
  awayRecord: string;
  pointsFor: string;
  pointsAgainst: string;
  differential: string;
  streak: string;
  lastTen: string;
  clincher?: string;
  conference: string;
}

export interface NbaStandingsGroup {
  name: string;
  rows: NbaStandingRow[];
}

export interface NbaStandingsData {
  leagueName: string;
  seasonDisplay: string;
  updatedAt: string;
  groups: NbaStandingsGroup[];
}

export interface MotorsportStandingRow {
  rank: number;
  name: string;
  code?: string;
  team?: string;
  badge?: string;
  teamBadge?: string;
  teamColor?: string;
  driverNumber?: string;
  points: number;
  wins: number;
  nationality?: string;
}

export interface MotorsportRaceSummary {
  raceName: string;
  round: string;
  date: string;
  time?: string;
  circuitName?: string;
  locality?: string;
  country?: string;
  winner?: string;
  podium: string[];
  fastestLap?: string;
}

export interface FormulaOneStandingsData {
  leagueName: string;
  season: string;
  round: string;
  updatedAt: string;
  driverStandings: MotorsportStandingRow[];
  constructorStandings: MotorsportStandingRow[];
  lastRace: MotorsportRaceSummary | null;
  nextRace: MotorsportRaceSummary | null;
}

export interface SportsPlayerSearchResult {
  id: string;
  name: string;
  alternateName?: string;
  sport?: string;
  team?: string;
  secondaryTeam?: string;
  nationality?: string;
  position?: string;
  status?: string;
  number?: string;
  thumb?: string;
  cutout?: string;
}

export interface SportsPlayerDetails extends SportsPlayerSearchResult {
  banner?: string;
  fanart?: string;
  birthDate?: string;
  birthLocation?: string;
  description?: string;
  height?: string;
  weight?: string;
  gender?: string;
  handedness?: string;
  signedDate?: string;
  signing?: string;
  agent?: string;
  outfitter?: string;
  kit?: string;
  website?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
}

const REQUEST_TIMEOUT_MS = 12_000;

const FEATURED_TABLE_LEAGUES: SportsLeague[] = [
  { id: '4328', sport: 'Soccer', name: 'English Premier League', shortName: 'EPL', country: 'England', tableSupported: true },
  { id: '4335', sport: 'Soccer', name: 'Spanish La Liga', shortName: 'La Liga', country: 'Spain', tableSupported: true },
  { id: '4331', sport: 'Soccer', name: 'German Bundesliga', shortName: 'Bundesliga', country: 'Germany', tableSupported: true },
];

type FeaturedLeagueSpec = {
  label: string;
  sport?: string;
  aliases: string[];
};

const MOTORSPORT_SPECS: FeaturedLeagueSpec[] = [
  { label: 'Formula 1', sport: 'Motorsport', aliases: ['formula 1', 'f1'] },
  { label: 'MotoGP', sport: 'Motorsport', aliases: ['motogp'] },
  { label: 'IndyCar', sport: 'Motorsport', aliases: ['indycar'] },
  { label: 'NASCAR Cup Series', sport: 'Motorsport', aliases: ['nascar cup series', 'nascar'] },
];

export const NBA_LEAGUE_ID = '4387';

type EspnCompetitionSpec = {
  id: string;
  sport: SportsLeague['sport'];
  sportPath: 'soccer' | 'basketball';
  leaguePath: string;
  name: string;
  shortName: string;
  country?: string;
};

const ESPN_FIXTURE_COMPETITIONS: EspnCompetitionSpec[] = [
  { id: 'eng.1', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'eng.1', name: 'English Premier League', shortName: 'EPL', country: 'England' },
  { id: 'uefa.champions', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'uefa.champions', name: 'UEFA Champions League', shortName: 'UCL', country: 'Europe' },
  { id: 'fifa.world', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'fifa.world', name: 'FIFA World Cup', shortName: 'World Cup', country: 'International' },
  { id: 'uefa.euro', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'uefa.euro', name: 'UEFA European Championship', shortName: 'Euro', country: 'Europe' },
  { id: 'nba', sport: 'Basketball', sportPath: 'basketball', leaguePath: 'nba', name: 'NBA', shortName: 'NBA', country: 'United States' },
];

const ESPN_STATS_COMPETITIONS: EspnCompetitionSpec[] = [
  { id: 'eng.1', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'eng.1', name: 'English Premier League', shortName: 'EPL', country: 'England' },
  { id: 'uefa.champions', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'uefa.champions', name: 'UEFA Champions League', shortName: 'UCL', country: 'Europe' },
  { id: 'nba', sport: 'Basketball', sportPath: 'basketball', leaguePath: 'nba', name: 'NBA', shortName: 'NBA', country: 'United States' },
];

const ESPN_MAJOR_TOURNAMENTS: EspnCompetitionSpec[] = [
  { id: 'uefa.champions', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'uefa.champions', name: 'UEFA Champions League', shortName: 'UCL', country: 'Europe' },
  { id: 'fifa.world', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'fifa.world', name: 'FIFA World Cup', shortName: 'World Cup', country: 'International' },
  { id: 'uefa.euro', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'uefa.euro', name: 'UEFA European Championship', shortName: 'Euro', country: 'Europe' },
  { id: 'conmebol.america', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'conmebol.america', name: 'Copa America', shortName: 'Copa America', country: 'South America' },
  { id: 'conmebol.libertadores', sport: 'Soccer', sportPath: 'soccer', leaguePath: 'conmebol.libertadores', name: 'CONMEBOL Libertadores', shortName: 'Libertadores', country: 'South America' },
];

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type SportsDataProvider = 'thesportsdb' | 'espn' | 'espnsite' | 'jolpica' | 'openf1';

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
}

function toInteger(value: unknown): number {
  const numeric = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildLeagueShortName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'League';
  if (trimmed.length <= 14) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 10) || trimmed.slice(0, 10);
}

function normalizeLeagueLookup(value: string | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreFeaturedLeagueMatch(league: SportsLeagueOption, spec: FeaturedLeagueSpec): number {
  if (spec.sport && league.sport !== spec.sport) return -1;

  const haystacks = [
    normalizeLeagueLookup(league.name),
    normalizeLeagueLookup(league.shortName),
    normalizeLeagueLookup(league.alternateName),
  ].filter(Boolean);

  const aliases = spec.aliases.map((alias) => normalizeLeagueLookup(alias)).filter(Boolean);
  let best = -1;

  for (const alias of aliases) {
    for (const haystack of haystacks) {
      if (!haystack) continue;
      if (haystack === alias) {
        best = Math.max(best, 100);
        continue;
      }
      if (haystack.startsWith(alias)) {
        best = Math.max(best, 90);
        continue;
      }
      if (haystack.includes(alias)) {
        best = Math.max(best, 80);
        continue;
      }
      if (alias.includes(haystack) && haystack.length >= 4) {
        best = Math.max(best, 60);
      }
    }
  }

  return best;
}

async function resolveFeaturedLeagueOptions(specs: FeaturedLeagueSpec[]): Promise<SportsLeagueOption[]> {
  const leagues = await fetchAllSportsLeagues();
  const seen = new Set<string>();
  const resolved: SportsLeagueOption[] = [];

  for (const spec of specs) {
    let bestMatch: SportsLeagueOption | null = null;
    let bestScore = -1;

    for (const league of leagues) {
      const score = scoreFeaturedLeagueMatch(league, spec);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = league;
      }
    }

    if (!bestMatch || bestScore < 0 || seen.has(bestMatch.id)) continue;
    seen.add(bestMatch.id);
    resolved.push(bestMatch);
  }

  return resolved;
}

function getCached<T>(key: string): T | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return cached.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number): T {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

async function fetchSportsApiJson<T>(provider: SportsDataProvider, path: string, ttlMs: number): Promise<T> {
  const cacheKey = `json:${provider}:${path}`;
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const existing = inFlight.get(cacheKey) as Promise<T> | undefined;
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(
      toApiUrl(`/api/sports-data?provider=${provider}&path=${encodeURIComponent(path)}`),
      {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Sports data request failed (${response.status})`);
    }
    const json = await response.json() as T;
    return setCached(cacheKey, json, ttlMs);
  })();

  inFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function fetchSportsApiText(provider: SportsDataProvider, path: string, ttlMs: number): Promise<string> {
  const cacheKey = `text:${provider}:${path}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  const existing = inFlight.get(cacheKey) as Promise<string> | undefined;
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(
      toApiUrl(`/api/sports-data?provider=${provider}&path=${encodeURIComponent(path)}`),
      {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Sports data request failed (${response.status})`);
    }
    const text = await response.text();
    return setCached(cacheKey, text, ttlMs);
  })();

  inFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function fetchSportsDbJson<T>(path: string, ttlMs: number): Promise<T> {
  return fetchSportsApiJson<T>('thesportsdb', path, ttlMs);
}

async function fetchEspnText(path: string, ttlMs: number): Promise<string> {
  return fetchSportsApiText('espn', path, ttlMs);
}

async function fetchEspnSiteJson<T>(path: string, ttlMs: number): Promise<T> {
  return fetchSportsApiJson<T>('espnsite', path, ttlMs);
}

async function fetchJolpicaJson<T>(path: string, ttlMs: number): Promise<T> {
  return fetchSportsApiJson<T>('jolpica', path, ttlMs);
}

async function fetchOpenF1Json<T>(path: string, ttlMs: number): Promise<T> {
  return fetchSportsApiJson<T>('openf1', path, ttlMs);
}

function sortEventsAscending(events: SportsEvent[]): SportsEvent[] {
  return [...events].sort((a, b) => {
    const aTime = parseEventTimestamp(a);
    const bTime = parseEventTimestamp(b);
    return aTime - bTime;
  });
}

export function parseEventTimestamp(event: Pick<SportsEvent, 'strTimestamp' | 'dateEvent' | 'strTime'>): number {
  if (event.strTimestamp) {
    const ts = Date.parse(event.strTimestamp);
    if (!Number.isNaN(ts)) return ts;
  }
  if (event.dateEvent && event.strTime) {
    const combined = Date.parse(`${event.dateEvent}T${event.strTime}`);
    if (!Number.isNaN(combined)) return combined;
  }
  if (event.dateEvent) {
    const dateOnly = Date.parse(`${event.dateEvent}T00:00:00`);
    if (!Number.isNaN(dateOnly)) return dateOnly;
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortEventsDescending(events: SportsEvent[]): SportsEvent[] {
  return [...events].sort((a, b) => parseEventTimestamp(b) - parseEventTimestamp(a));
}

function mapLeagueOption(raw: Record<string, unknown>): SportsLeagueOption | null {
  const id = toOptionalString(raw.idLeague);
  const name = toOptionalString(raw.strLeague);
  const sport = toOptionalString(raw.strSport);
  if (!id || !name || !sport) return null;

  return {
    id,
    name,
    sport,
    shortName: buildLeagueShortName(name),
    alternateName: toOptionalString(raw.strLeagueAlternate),
  };
}

function mapLeagueDetails(raw: Record<string, unknown>): SportsLeagueDetails | null {
  const base = mapLeagueOption(raw);
  if (!base) return null;

  return {
    ...base,
    country: toOptionalString(raw.strCountry),
    currentSeason: toOptionalString(raw.strCurrentSeason),
    formedYear: toOptionalString(raw.intFormedYear),
    badge: toOptionalString(raw.strBadge),
    description: toOptionalString(raw.strDescriptionEN),
  };
}

function seasonSortScore(value: string): number {
  const matches = value.match(/\d{4}/g);
  if (!matches?.length) return Number.MIN_SAFE_INTEGER;
  const years = matches
    .map((part) => Number.parseInt(part, 10))
    .filter((year) => Number.isFinite(year));
  if (!years.length) return Number.MIN_SAFE_INTEGER;
  return Math.max(...years) * 10_000 + Math.min(...years);
}

function sortSeasonsDescending(seasons: string[]): string[] {
  return [...seasons].sort((a, b) => {
    const scoreDiff = seasonSortScore(b) - seasonSortScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return b.localeCompare(a);
  });
}

function resolveSelectedSeason(requestedSeason: string | undefined, seasons: string[], currentSeason?: string): string | undefined {
  if (requestedSeason && seasons.includes(requestedSeason)) return requestedSeason;
  if (requestedSeason && !seasons.length) return requestedSeason;
  if (currentSeason) return currentSeason;
  return seasons[0];
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function mapEvent(raw: Record<string, unknown>): SportsEvent {
  return {
    idEvent: String(raw.idEvent ?? ''),
    idLeague: raw.idLeague ? String(raw.idLeague) : undefined,
    strLeague: raw.strLeague ? String(raw.strLeague) : undefined,
    strSeason: raw.strSeason ? String(raw.strSeason) : undefined,
    strSport: raw.strSport ? String(raw.strSport) : undefined,
    strEvent: raw.strEvent ? String(raw.strEvent) : undefined,
    strHomeTeam: raw.strHomeTeam ? String(raw.strHomeTeam) : undefined,
    strAwayTeam: raw.strAwayTeam ? String(raw.strAwayTeam) : undefined,
    strHomeBadge: toOptionalString(raw.strHomeBadge) || toOptionalString(raw.strHomeTeamBadge),
    strAwayBadge: toOptionalString(raw.strAwayBadge) || toOptionalString(raw.strAwayTeamBadge),
    strStatus: raw.strStatus ? String(raw.strStatus) : undefined,
    strProgress: raw.strProgress ? String(raw.strProgress) : undefined,
    strVenue: raw.strVenue ? String(raw.strVenue) : undefined,
    strRound: raw.intRound ? String(raw.intRound) : raw.strRound ? String(raw.strRound) : undefined,
    strTimestamp: raw.strTimestamp ? String(raw.strTimestamp) : undefined,
    dateEvent: raw.dateEvent ? String(raw.dateEvent) : undefined,
    strTime: raw.strTime ? String(raw.strTime) : undefined,
    intHomeScore: raw.intHomeScore ? String(raw.intHomeScore) : undefined,
    intAwayScore: raw.intAwayScore ? String(raw.intAwayScore) : undefined,
  };
}

function mapStandingRow(row: Record<string, unknown>): SportsStandingRow {
  return {
    rank: toNumber(row.intRank),
    team: String(row.strTeam ?? 'Unknown'),
    badge: row.strBadge ? String(row.strBadge) : undefined,
    played: toNumber(row.intPlayed),
    wins: toNumber(row.intWin),
    draws: toNumber(row.intDraw),
    losses: toNumber(row.intLoss),
    goalDifference: toNumber(row.intGoalDifference),
    points: toNumber(row.intPoints),
    form: row.strForm ? String(row.strForm) : undefined,
    note: row.strDescription ? String(row.strDescription) : undefined,
    season: row.strSeason ? String(row.strSeason) : undefined,
  };
}

function mapEspnCompetitionOption(spec: EspnCompetitionSpec): SportsLeagueOption {
  return {
    id: spec.id,
    sport: spec.sport,
    name: spec.name,
    shortName: spec.shortName,
  };
}

function mapEspnCompetitionDetails(spec: EspnCompetitionSpec, seasonLabel?: string): SportsLeagueDetails {
  return {
    ...mapEspnCompetitionOption(spec),
    country: spec.country,
    currentSeason: seasonLabel,
  };
}

function mapEspnCompetitionLeague(spec: EspnCompetitionSpec): SportsLeague {
  return {
    id: spec.id,
    sport: spec.sport,
    name: spec.name,
    shortName: spec.shortName,
    country: spec.country,
  };
}

function buildEspnSiteScoreboardPath(spec: EspnCompetitionSpec): string {
  return `/${spec.sportPath}/${spec.leaguePath}/scoreboard`;
}

function buildEspnSiteSummaryPath(spec: EspnCompetitionSpec, eventId: string): string {
  return `/${spec.sportPath}/${spec.leaguePath}/summary?event=${encodeURIComponent(eventId)}`;
}

function extractEspnTeamLogo(team: Record<string, unknown> | null): string | undefined {
  if (!team) return undefined;
  const direct = toOptionalString(team.logo);
  if (direct) return direct;
  const logos = asArray(team.logos);
  return toOptionalString(logos[0]?.href);
}

function pickEspnCompetitor(
  competitors: Record<string, unknown>[],
  homeAway: 'home' | 'away',
  fallbackIndex: number,
): Record<string, unknown> | null {
  return competitors.find((competitor) => toOptionalString(competitor.homeAway) === homeAway)
    || competitors[fallbackIndex]
    || null;
}

function mapEspnScoreboardEvent(spec: EspnCompetitionSpec, raw: Record<string, unknown>): SportsEvent | null {
  const competition = asArray(raw.competitions)[0];
  if (!competition) return null;

  const competitors = asArray(competition.competitors);
  const home = pickEspnCompetitor(competitors, 'home', 0);
  const away = pickEspnCompetitor(competitors, 'away', 1);
  const homeTeam = home && isRecord(home.team) ? home.team : null;
  const awayTeam = away && isRecord(away.team) ? away.team : null;
  const status = isRecord(competition.status) ? competition.status : null;
  const statusType = status && isRecord(status.type) ? status.type : null;
  const venue = isRecord(competition.venue)
    ? competition.venue
    : asArray(competition.venues)[0];
  const week = isRecord(raw.week) ? raw.week : null;
  const seasonType = isRecord(raw.seasonType) ? raw.seasonType : null;
  const timestamp = toOptionalString(competition.date) || toOptionalString(raw.date);
  const eventId = toOptionalString(raw.id);
  if (!eventId || !timestamp) return null;

  return {
    idEvent: eventId,
    idLeague: spec.id,
    strLeague: spec.name,
    strSeason: toOptionalString(raw.seasonDisplay),
    strSport: spec.sport,
    strEvent: toOptionalString(raw.name),
    strHomeTeam: toOptionalString(homeTeam?.displayName) || toOptionalString(homeTeam?.shortDisplayName),
    strAwayTeam: toOptionalString(awayTeam?.displayName) || toOptionalString(awayTeam?.shortDisplayName),
    strHomeBadge: extractEspnTeamLogo(homeTeam),
    strAwayBadge: extractEspnTeamLogo(awayTeam),
    strStatus: toOptionalString(statusType?.description),
    strProgress: toOptionalString(statusType?.detail) || toOptionalString(statusType?.shortDetail),
    strVenue: toOptionalString(venue?.fullName),
    strRound: toOptionalString(week?.text) || toOptionalString(seasonType?.name),
    strTimestamp: timestamp,
    dateEvent: timestamp.slice(0, 10),
    strTime: timestamp.includes('T') ? timestamp.split('T')[1] : undefined,
    intHomeScore: toOptionalString(home?.score),
    intAwayScore: toOptionalString(away?.score),
  };
}

function pickEspnRecentOrLiveEvent(events: SportsEvent[]): SportsEvent | null {
  return pickEspnRecentEvents(events, 1)[0] ?? null;
}

function pickEspnRecentEvents(events: SportsEvent[], limit = 3): SportsEvent[] {
  const active = events.filter((event) => {
    const status = (event.strStatus || '').toLowerCase();
    return status.includes('final') || status.includes('live') || status.includes('extra') || status.includes('full time');
  });
  return sortEventsDescending(active).slice(0, limit);
}

function pickEspnUpcomingEvents(events: SportsEvent[], limit = 3): SportsEvent[] {
  const upcoming = events.filter((event) => {
    const status = (event.strStatus || '').toLowerCase();
    return !status || status.includes('scheduled') || status.includes('not started') || status.includes('time tbd');
  });
  return sortEventsAscending(upcoming).slice(0, limit);
}

async function fetchEspnCompetitionEvents(spec: EspnCompetitionSpec): Promise<SportsEvent[]> {
  const payload = await fetchEspnSiteJson<Record<string, unknown>>(buildEspnSiteScoreboardPath(spec), 5 * 60 * 1000);
  const leagues = asArray(payload.leagues);
  const season = isRecord(leagues[0]?.season) ? leagues[0]?.season : null;
  const seasonLabel = toOptionalString(season?.displayName) || toOptionalString(season?.year);
  return asArray(payload.events)
    .map((event) => mapEspnScoreboardEvent(spec, { ...event, seasonDisplay: seasonLabel }))
    .filter((event): event is SportsEvent => !!event);
}

async function fetchEspnEventStats(spec: EspnCompetitionSpec, event: SportsEvent): Promise<SportsEventStat[]> {
  const payload = await fetchEspnSiteJson<Record<string, unknown>>(buildEspnSiteSummaryPath(spec, event.idEvent), 2 * 60 * 1000);
  const boxscore = isRecord(payload.boxscore) ? payload.boxscore : null;
  const teams = boxscore ? asArray(boxscore.teams) : [];
  const home = teams.find((team) => toOptionalString(team.homeAway) === 'home') || teams[0];
  const away = teams.find((team) => toOptionalString(team.homeAway) === 'away') || teams[1];
  const homeStats = asArray(home?.statistics);
  const awayStats = asArray(away?.statistics);

  if (!homeStats.length || !awayStats.length) {
    return buildFallbackStats(event);
  }

  const byName = new Map<string, Record<string, unknown>>();
  for (const stat of awayStats) {
    const name = toOptionalString(stat.name);
    if (name) byName.set(name, stat);
  }

  const stats: SportsEventStat[] = [];
  for (const homeStat of homeStats) {
    const name = toOptionalString(homeStat.name);
    if (!name) continue;
    const awayStat = byName.get(name);
    if (!awayStat) continue;
    const homeValue = toOptionalString(homeStat.displayValue);
    const awayValue = toOptionalString(awayStat.displayValue);
    if (!homeValue && !awayValue) continue;
    stats.push({
      label: toOptionalString(homeStat.label) || toOptionalString(homeStat.abbreviation) || name,
      homeValue,
      awayValue,
    });
    if (stats.length >= 6) break;
  }

  return stats.length ? stats : buildFallbackStats(event);
}

export async function fetchAllSportsLeagues(): Promise<SportsLeagueOption[]> {
  const payload = await fetchSportsDbJson<{ leagues?: unknown }>('/all_leagues.php', 6 * 60 * 60 * 1000);
  return asArray(payload.leagues)
    .map(mapLeagueOption)
    .filter((league): league is SportsLeagueOption => !!league)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchMajorTournamentLeagueOptions(): Promise<SportsLeagueOption[]> {
  return ESPN_MAJOR_TOURNAMENTS.map(mapEspnCompetitionOption);
}

export async function fetchMotorsportLeagueOptions(): Promise<SportsLeagueOption[]> {
  return resolveFeaturedLeagueOptions(MOTORSPORT_SPECS);
}

export async function fetchSportsLeagueDetails(leagueId: string): Promise<SportsLeagueDetails | null> {
  const payload = await fetchSportsDbJson<{ leagues?: unknown }>(`/lookupleague.php?id=${leagueId}`, 60 * 60 * 1000);
  return asArray(payload.leagues)
    .map(mapLeagueDetails)
    .find((league): league is SportsLeagueDetails => !!league) || null;
}

export async function fetchSportsLeagueSeasons(leagueId: string): Promise<string[]> {
  const payload = await fetchSportsDbJson<{ seasons?: unknown }>(`/search_all_seasons.php?id=${leagueId}`, 60 * 60 * 1000);
  const seasons = asArray(payload.seasons)
    .map((season) => toOptionalString(season.strSeason))
    .filter((season): season is string => !!season);
  return sortSeasonsDescending(uniqueStrings(seasons));
}

async function fetchLeagueTableData(league: SportsLeague, season?: string): Promise<SportsTableGroup | null> {
  const seasonQuery = season ? `&s=${encodeURIComponent(season)}` : '';
  const payload = await fetchSportsDbJson<{ table?: unknown }>(`/lookuptable.php?l=${league.id}${seasonQuery}`, 10 * 60 * 1000);
  const rawRows = asArray(payload.table);
  const rows = rawRows
    .map(mapStandingRow)
    .filter((row) => row.rank > 0)
    .sort((a, b) => a.rank - b.rank);

  if (!rows.length) return null;

  return {
    league,
    season: rows[0]?.season || season,
    updatedAt: toOptionalString(rawRows[0]?.dateUpdated),
    rows,
  };
}

async function fetchLeagueRecentEvents(leagueId: string, limit = 5): Promise<SportsEvent[]> {
  const payload = await fetchSportsDbJson<{ results?: unknown }>(`/eventslast.php?id=${leagueId}`, 10 * 60 * 1000);
  return sortEventsDescending(asArray(payload.results).map(mapEvent))
    .filter((event) => event.idEvent)
    .slice(0, limit);
}

async function fetchLeagueUpcomingEvents(leagueId: string, limit = 5): Promise<SportsEvent[]> {
  const payload = await fetchSportsDbJson<{ events?: unknown; results?: unknown }>(`/eventsnext.php?id=${leagueId}`, 5 * 60 * 1000);
  const rawEvents = asArray(payload.events).length ? asArray(payload.events) : asArray(payload.results);
  return sortEventsAscending(rawEvents.map(mapEvent))
    .filter((event) => event.idEvent)
    .slice(0, limit);
}

export async function fetchFeaturedSportsFixtures(): Promise<SportsFixtureGroup[]> {
  const responses = await Promise.all(
    ESPN_FIXTURE_COMPETITIONS.map(async (spec) => {
      const league = mapEspnCompetitionLeague(spec);
      const events = pickEspnUpcomingEvents(await fetchEspnCompetitionEvents(spec).catch(() => []), 3);
      return {
        league,
        events,
      };
    }),
  );

  return responses.filter((group) => group.events.length > 0);
}

export async function fetchFeaturedSportsTables(): Promise<SportsTableGroup[]> {
  const responses = await Promise.all(
    FEATURED_TABLE_LEAGUES.map(async (league) => {
      const table = await fetchLeagueTableData(league);
      if (!table) return null;
      return {
        ...table,
        rows: table.rows.slice(0, 5),
      };
    }),
  );

  return responses.filter((group): group is SportsTableGroup => !!group && group.rows.length > 0);
}

async function fetchEventStats(eventId: string): Promise<SportsEventStat[]> {
  const payload = await fetchSportsDbJson<{ eventstats?: unknown }>(`/lookupeventstats.php?id=${eventId}`, 10 * 60 * 1000);
  return asArray(payload.eventstats)
    .map((stat) => ({
      label: String(stat.strStat ?? ''),
      homeValue: stat.intHome ? String(stat.intHome) : undefined,
      awayValue: stat.intAway ? String(stat.intAway) : undefined,
    }))
    .filter((stat) => stat.label && (stat.homeValue || stat.awayValue))
    .slice(0, 4);
}

function buildFallbackStats(event: SportsEvent): SportsEventStat[] {
  const stats: SportsEventStat[] = [];
  if (event.intHomeScore || event.intAwayScore) {
    stats.push({
      label: 'Score',
      homeValue: event.intHomeScore ?? '-',
      awayValue: event.intAwayScore ?? '-',
    });
  }
  if (event.strRound) {
    stats.push({
      label: 'Round',
      homeValue: event.strRound,
      awayValue: event.strSeason ?? '',
    });
  }
  if (event.strStatus || event.strProgress) {
    stats.push({
      label: 'Status',
      homeValue: event.strStatus ?? 'Final',
      awayValue: event.strProgress ?? '',
    });
  }
  return stats;
}

export async function fetchFeaturedSportsStats(): Promise<SportsStatSnapshot[]> {
  const snapshots = await Promise.all(
    ESPN_STATS_COMPETITIONS.map(async (spec) => {
      const league = mapEspnCompetitionLeague(spec);
      const event = pickEspnRecentOrLiveEvent(await fetchEspnCompetitionEvents(spec).catch(() => []));
      if (!event) return null;

      const stats = await fetchEspnEventStats(spec, event).catch(() => buildFallbackStats(event));

      return {
        league,
        event,
        stats,
      } satisfies SportsStatSnapshot;
    }),
  );

  return snapshots.filter((snapshot): snapshot is SportsStatSnapshot => !!snapshot && snapshot.stats.length > 0);
}

export async function fetchMajorTournamentCenterData(tournamentId: string): Promise<SportsLeagueCenterData | null> {
  const spec = ESPN_MAJOR_TOURNAMENTS.find((entry) => entry.id === tournamentId);
  if (!spec) return null;

  const rawPayload = await fetchEspnSiteJson<Record<string, unknown>>(buildEspnSiteScoreboardPath(spec), 5 * 60 * 1000);
  const events = await fetchEspnCompetitionEvents(spec);
  const recentEvents = pickEspnRecentEvents(events, 5);
  const recentEvent = recentEvents[0] || null;
  const upcomingEvents = pickEspnUpcomingEvents(events, 5);
  const leagues = asArray(rawPayload.leagues);
  const season = isRecord(leagues[0]?.season) ? leagues[0]?.season : null;
  const seasonLabel = toOptionalString(season?.displayName) || toOptionalString(season?.year);
  const statSnapshot = recentEvent
    ? {
      league: mapEspnCompetitionLeague(spec),
      event: recentEvent,
      stats: await fetchEspnEventStats(spec, recentEvent).catch(() => buildFallbackStats(recentEvent)),
    } satisfies SportsStatSnapshot
    : null;

  return {
    league: mapEspnCompetitionDetails(spec, seasonLabel),
    seasons: seasonLabel ? [seasonLabel] : [],
    selectedSeason: seasonLabel,
    table: null,
    tableAvailable: false,
    recentEvents,
    upcomingEvents,
    statSnapshot: statSnapshot && statSnapshot.stats.length > 0 ? statSnapshot : null,
  };
}

function mapSportsPlayerSearchResult(raw: Record<string, unknown>): SportsPlayerSearchResult | null {
  const id = toOptionalString(raw.idPlayer);
  const name = toOptionalString(raw.strPlayer);
  if (!id || !name) return null;

  return {
    id,
    name,
    alternateName: toOptionalString(raw.strPlayerAlternate),
    sport: toOptionalString(raw.strSport),
    team: toOptionalString(raw.strTeam),
    secondaryTeam: toOptionalString(raw.strTeam2),
    nationality: toOptionalString(raw.strNationality),
    position: toOptionalString(raw.strPosition),
    status: toOptionalString(raw.strStatus),
    number: toOptionalString(raw.strNumber),
    thumb: toOptionalString(raw.strThumb),
    cutout: toOptionalString(raw.strCutout),
  };
}

function mapSportsPlayerDetails(raw: Record<string, unknown>): SportsPlayerDetails | null {
  const base = mapSportsPlayerSearchResult(raw);
  if (!base) return null;

  return {
    ...base,
    banner: toOptionalString(raw.strBanner),
    fanart: uniqueStrings([
      toOptionalString(raw.strFanart1),
      toOptionalString(raw.strFanart2),
      toOptionalString(raw.strFanart3),
      toOptionalString(raw.strFanart4),
    ])[0],
    birthDate: toOptionalString(raw.dateBorn),
    birthLocation: toOptionalString(raw.strBirthLocation),
    description: toOptionalString(raw.strDescriptionEN),
    height: toOptionalString(raw.strHeight),
    weight: toOptionalString(raw.strWeight),
    gender: toOptionalString(raw.strGender),
    handedness: toOptionalString(raw.strSide),
    signedDate: toOptionalString(raw.dateSigned),
    signing: toOptionalString(raw.strSigning),
    agent: toOptionalString(raw.strAgent),
    outfitter: toOptionalString(raw.strOutfitter),
    kit: toOptionalString(raw.strKit),
    website: toOptionalString(raw.strWebsite),
    facebook: toOptionalString(raw.strFacebook),
    twitter: toOptionalString(raw.strTwitter),
    instagram: toOptionalString(raw.strInstagram),
    youtube: toOptionalString(raw.strYoutube),
  };
}

function scoreSportsPlayerSearchResult(player: SportsPlayerSearchResult, query: string): number {
  const normalizedQuery = normalizeLeagueLookup(query);
  const exactName = normalizeLeagueLookup(player.name);
  const alternateName = normalizeLeagueLookup(player.alternateName);
  const team = normalizeLeagueLookup(player.team);
  let score = 0;

  if (exactName === normalizedQuery || alternateName === normalizedQuery) score += 120;
  else if (exactName.startsWith(normalizedQuery) || alternateName.startsWith(normalizedQuery)) score += 80;
  else if (exactName.includes(normalizedQuery) || alternateName.includes(normalizedQuery)) score += 60;

  if (team && normalizedQuery && team.includes(normalizedQuery)) score += 20;
  if ((player.status || '').toLowerCase() === 'active') score += 15;
  if (player.team) score += 5;
  if (player.thumb || player.cutout) score += 3;
  return score;
}

export async function fetchSportsPlayerSearch(query: string): Promise<SportsPlayerSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const payload = await fetchSportsDbJson<{ player?: unknown; player_contracts?: unknown; player_honours?: unknown; players?: unknown }>(
    `/searchplayers.php?p=${encodeURIComponent(trimmedQuery)}`,
    30 * 60 * 1000,
  );
  const rawPlayers = asArray(payload.player).length
    ? asArray(payload.player)
    : asArray(payload.players);

  return rawPlayers
    .map(mapSportsPlayerSearchResult)
    .filter((player): player is SportsPlayerSearchResult => !!player)
    .sort((a, b) => scoreSportsPlayerSearchResult(b, trimmedQuery) - scoreSportsPlayerSearchResult(a, trimmedQuery) || a.name.localeCompare(b.name))
    .slice(0, 8);
}

export async function fetchSportsPlayerDetails(playerId: string): Promise<SportsPlayerDetails | null> {
  const trimmedId = playerId.trim();
  if (!trimmedId) return null;

  const payload = await fetchSportsDbJson<{ players?: unknown }>(`/lookupplayer.php?id=${encodeURIComponent(trimmedId)}`, 60 * 60 * 1000);
  return asArray(payload.players)
    .map(mapSportsPlayerDetails)
    .find((player): player is SportsPlayerDetails => !!player) || null;
}

export async function fetchLeagueCenterData(leagueId: string, season?: string): Promise<SportsLeagueCenterData | null> {
  const details = await fetchSportsLeagueDetails(leagueId);
  if (!details) return null;

  const [seasons, recentEvents, upcomingEvents] = await Promise.all([
    fetchSportsLeagueSeasons(leagueId).catch(() => []),
    fetchLeagueRecentEvents(leagueId, 5).catch(() => []),
    fetchLeagueUpcomingEvents(leagueId, 5).catch(() => []),
  ]);

  const selectedSeason = resolveSelectedSeason(season, seasons, details.currentSeason);

  let table: SportsTableGroup | null = null;
  try {
    table = await fetchLeagueTableData(details, selectedSeason);
  } catch {
    table = null;
  }

  if (!table && seasons.length > 0) {
    const fallbackSeason = seasons[0];
    if (fallbackSeason && fallbackSeason !== selectedSeason) {
      try {
        table = await fetchLeagueTableData(details, fallbackSeason);
      } catch {
        table = null;
      }
    }
  }

  if (!table && selectedSeason) {
    try {
      table = await fetchLeagueTableData(details);
    } catch {
      table = null;
    }
  }

  let statSnapshot: SportsStatSnapshot | null = null;
  const recentEvent = recentEvents[0];
  if (recentEvent) {
    let stats: SportsEventStat[] = [];
    try {
      stats = await fetchEventStats(recentEvent.idEvent);
    } catch {
      stats = [];
    }
    if (stats.length === 0) {
      stats = buildFallbackStats(recentEvent);
    }
    if (stats.length > 0) {
      statSnapshot = {
        league: details,
        event: recentEvent,
        stats,
      };
    }
  }

  return {
    league: {
      ...details,
      tableSupported: table ? true : details.tableSupported,
    },
    seasons,
    selectedSeason,
    table,
    tableAvailable: !!table,
    recentEvents,
    upcomingEvents,
    statSnapshot,
  };
}

function getEspnPageStandingValue(
  stats: unknown[],
  headers: Record<string, unknown>,
  type: string,
  fallback = '—',
): string {
  const matchingHeaders = Object.values(headers)
    .filter(isRecord)
    .filter((header) => toOptionalString(header.t) === type)
    .sort((a, b) => toInteger(a.i) - toInteger(b.i));

  for (const header of matchingHeaders) {
    const index = toInteger(header.i);
    const value = toOptionalString(stats[index]);
    if (value) return value;
  }

  return fallback;
}

function extractEspnFittState(html: string): Record<string, unknown> | null {
  const match = html.match(/window\['__espnfitt__'\]=(\{.*?\});<\/script>/s);
  if (!match?.[1]) return null;

  try {
    const parsed = JSON.parse(match[1]);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mapNbaStandingEntryFromEspnPage(
  entry: Record<string, unknown>,
  headers: Record<string, unknown>,
  conference: string,
  rank: number,
): NbaStandingRow | null {
  const team = isRecord(entry.team) ? entry.team : null;
  if (!team) return null;

  const teamName = toOptionalString(team.displayName) || toOptionalString(team.shortDisplayName) || toOptionalString(team.name);
  if (!teamName) return null;

  const stats = Array.isArray(entry.stats) ? entry.stats : [];
  const clincher = getEspnPageStandingValue(stats, headers, 'clincher', '');

  return {
    rank,
    seed: toInteger(getEspnPageStandingValue(stats, headers, 'playoffseed', String(rank))) || rank,
    team: teamName,
    abbreviation: toOptionalString(team.abbrev) || toOptionalString(team.abbreviation) || '',
    badge: toOptionalString(team.logo),
    wins: toInteger(getEspnPageStandingValue(stats, headers, 'wins', '0')),
    losses: toInteger(getEspnPageStandingValue(stats, headers, 'losses', '0')),
    winPercent: getEspnPageStandingValue(stats, headers, 'winpercent'),
    gamesBehind: getEspnPageStandingValue(stats, headers, 'gamesbehind'),
    homeRecord: getEspnPageStandingValue(stats, headers, 'home'),
    awayRecord: getEspnPageStandingValue(stats, headers, 'road'),
    pointsFor: getEspnPageStandingValue(stats, headers, 'avgpointsfor'),
    pointsAgainst: getEspnPageStandingValue(stats, headers, 'avgpointsagainst'),
    differential: getEspnPageStandingValue(stats, headers, 'differential'),
    streak: getEspnPageStandingValue(stats, headers, 'streak'),
    lastTen: getEspnPageStandingValue(stats, headers, 'lasttengames'),
    clincher: clincher || undefined,
    conference,
  };
}

export async function fetchNbaStandingsData(): Promise<NbaStandingsData | null> {
  const html = await fetchEspnText('/nba/standings', 5 * 60 * 1000);
  const state = extractEspnFittState(html);
  if (!state) return null;

  const page = isRecord(state.page) ? state.page : null;
  const content = page && isRecord(page.content) ? page.content : null;
  const standings = content && isRecord(content.standings) ? content.standings : null;
  const groupedStandings = standings && isRecord(standings.groups) ? standings.groups : null;
  const groups = groupedStandings ? asArray(groupedStandings.groups) : [];
  const headers = groupedStandings && isRecord(groupedStandings.headers) ? groupedStandings.headers : {};
  const currentSeason = standings && isRecord(standings.currentSeason) ? standings.currentSeason : null;
  const md = standings && isRecord(standings.md) ? standings.md : null;

  const mappedGroups = groups
    .map((group) => {
      const rows = asArray(group.standings)
        .map((entry, index) => mapNbaStandingEntryFromEspnPage(entry, headers, toOptionalString(group.name) || 'Conference', index + 1))
        .filter((row): row is NbaStandingRow => !!row);

      return {
        name: toOptionalString(group.name) || 'Conference',
        rows,
      } satisfies NbaStandingsGroup;
    })
    .filter((group) => group.rows.length > 0);

  if (!mappedGroups.length) return null;

  return {
    leagueName: toOptionalString(standings?.leagueNameApi) || toOptionalString(md?.nm) || 'NBA',
    seasonDisplay: toOptionalString(currentSeason?.displayName) || toOptionalString(md?.ssn) || '',
    updatedAt: new Date().toISOString(),
    groups: mappedGroups,
  };
}

function mapMotorsportStandingRow(raw: Record<string, unknown>): MotorsportStandingRow | null {
  const driver = isRecord(raw.Driver) ? raw.Driver : null;
  const constructor = isRecord(raw.Constructor) ? raw.Constructor : null;
  const constructors = Array.isArray(raw.Constructors) ? raw.Constructors.filter(isRecord) : [];

  const position = toInteger(raw.position);
  const name = driver
    ? [toOptionalString(driver.givenName), toOptionalString(driver.familyName)].filter(Boolean).join(' ')
    : toOptionalString(constructor?.name);
  if (!position || !name) return null;

  return {
    rank: position,
    name,
    code: toOptionalString(driver?.code),
    team: driver ? (toOptionalString(constructor?.name) || toOptionalString(constructors[0]?.name)) : undefined,
    driverNumber: toOptionalString(driver?.permanentNumber),
    points: toInteger(raw.points),
    wins: toInteger(raw.wins),
    nationality: toOptionalString(driver?.nationality) || toOptionalString(constructor?.nationality),
  };
}

type OpenF1DriverRecord = {
  driverNumber?: string;
  fullName?: string;
  headshotUrl?: string;
};

const F1_TEAM_ASSETS: Array<{ aliases: string[]; path: string; color: string }> = [
  { aliases: ['mclaren'], path: '/sports/f1/teams/mclaren.svg', color: 'FF8000' },
  { aliases: ['ferrari', 'scuderia ferrari'], path: '/sports/f1/teams/ferrari.svg', color: 'DC0000' },
  { aliases: ['mercedes', 'mercedes-amg', 'mercedes amg petronas'], path: '/sports/f1/teams/mercedes.svg', color: '27F4D2' },
  { aliases: ['red bull', 'red bull racing'], path: '/sports/f1/teams/red-bull.svg', color: '3671C6' },
  { aliases: ['williams', 'williams racing'], path: '/sports/f1/teams/williams.svg', color: '64C4FF' },
  { aliases: ['aston martin', 'aston martin aramco'], path: '/sports/f1/teams/aston-martin.svg', color: '229971' },
  { aliases: ['alpine', 'bwt alpine'], path: '/sports/f1/teams/alpine.svg', color: '0093CC' },
  { aliases: ['haas', 'haas f1 team'], path: '/sports/f1/teams/haas.svg', color: 'B6BABD' },
  { aliases: ['sauber', 'kick sauber', 'stake f1 team kick sauber'], path: '/sports/f1/teams/sauber.svg', color: '52E252' },
  { aliases: ['racing bulls', 'rb f1 team', 'visa cash app rb', 'visa cash app racing bulls'], path: '/sports/f1/teams/racing-bulls.svg', color: '6692FF' },
];

function normalizeMotorsportLookup(value: string | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveF1TeamAsset(teamName: string | undefined): { badge?: string; color?: string } | null {
  const normalized = normalizeMotorsportLookup(teamName);
  if (!normalized) return null;

  for (const team of F1_TEAM_ASSETS) {
    if (team.aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return {
        badge: team.path,
        color: team.color,
      };
    }
  }

  return null;
}

function mapOpenF1DriverRecord(raw: Record<string, unknown>): OpenF1DriverRecord | null {
  const driverNumber = toOptionalString(raw.driver_number);
  const fullName = toOptionalString(raw.full_name);
  if (!driverNumber && !fullName) return null;

  return {
    driverNumber,
    fullName,
    headshotUrl: toOptionalString(raw.headshot_url),
  };
}

async function fetchOpenF1DriverAssets(): Promise<OpenF1DriverRecord[]> {
  const payload = await fetchOpenF1Json<unknown[]>('/v1/drivers?session_key=latest', 6 * 60 * 60 * 1000);
  return asArray(payload)
    .map(mapOpenF1DriverRecord)
    .filter((record): record is OpenF1DriverRecord => !!record);
}

function enrichMotorsportRowsWithAssets(
  rows: MotorsportStandingRow[],
  driverAssets: OpenF1DriverRecord[],
): MotorsportStandingRow[] {
  const byNumber = new Map<string, OpenF1DriverRecord>();
  const byName = new Map<string, OpenF1DriverRecord>();

  for (const asset of driverAssets) {
    if (asset.driverNumber) byNumber.set(asset.driverNumber, asset);
    const normalizedName = normalizeMotorsportLookup(asset.fullName);
    if (normalizedName) byName.set(normalizedName, asset);
  }

  return rows.map((row) => {
    const driverAsset = row.driverNumber
      ? byNumber.get(row.driverNumber)
      : byName.get(normalizeMotorsportLookup(row.name));
    const baseTeamName = row.team || row.name;
    const teamAsset = resolveF1TeamAsset(baseTeamName);
    const isDriverRow = !!row.driverNumber;

    return {
      ...row,
      badge: driverAsset?.headshotUrl || (!isDriverRow ? teamAsset?.badge : undefined),
      team: baseTeamName,
      teamBadge: teamAsset?.badge,
      teamColor: teamAsset?.color,
    };
  });
}

function formatRaceDriverName(raw: Record<string, unknown>): string {
  const driver = isRecord(raw.Driver) ? raw.Driver : null;
  if (!driver) return 'Unknown';
  return [toOptionalString(driver.givenName), toOptionalString(driver.familyName)].filter(Boolean).join(' ') || 'Unknown';
}

function mapMotorsportRaceSummary(raw: Record<string, unknown>): MotorsportRaceSummary | null {
  const circuit = isRecord(raw.Circuit) ? raw.Circuit : null;
  const location = circuit && isRecord(circuit.Location) ? circuit.Location : null;
  const results = asArray(raw.Results);
  const podium = results.slice(0, 3).map((result) => {
    const position = toOptionalString(result.position) || '';
    return `${position}. ${formatRaceDriverName(result)}`.trim();
  }).filter(Boolean);
  const fastestLapResult = results.find((result) => {
    const lap = isRecord(result.FastestLap) ? result.FastestLap : null;
    return toOptionalString(lap?.rank) === '1';
  });

  const raceName = toOptionalString(raw.raceName);
  const round = toOptionalString(raw.round);
  const date = toOptionalString(raw.date);
  if (!raceName || !round || !date) return null;

  return {
    raceName,
    round,
    date,
    time: toOptionalString(raw.time),
    circuitName: toOptionalString(circuit?.circuitName),
    locality: toOptionalString(location?.locality),
    country: toOptionalString(location?.country),
    winner: podium[0]?.replace(/^\d+\.\s*/, ''),
    podium,
    fastestLap: fastestLapResult ? formatRaceDriverName(fastestLapResult) : undefined,
  };
}

export async function fetchFormulaOneStandingsData(): Promise<FormulaOneStandingsData | null> {
  const [driverPayload, constructorPayload, lastRacePayload, nextRacePayload, openF1Drivers] = await Promise.all([
    fetchJolpicaJson<Record<string, unknown>>('/ergast/f1/current/driverStandings.json', 5 * 60 * 1000).catch(() => null),
    fetchJolpicaJson<Record<string, unknown>>('/ergast/f1/current/constructorStandings.json', 5 * 60 * 1000).catch(() => null),
    fetchJolpicaJson<Record<string, unknown>>('/ergast/f1/current/last/results.json', 5 * 60 * 1000).catch(() => null),
    fetchJolpicaJson<Record<string, unknown>>('/ergast/f1/current/next.json', 30 * 60 * 1000).catch(() => null),
    fetchOpenF1DriverAssets().catch(() => []),
  ]);

  const driverMrData = driverPayload && isRecord(driverPayload.MRData) ? driverPayload.MRData : null;
  const constructorMrData = constructorPayload && isRecord(constructorPayload.MRData) ? constructorPayload.MRData : null;
  const lastMrData = lastRacePayload && isRecord(lastRacePayload.MRData) ? lastRacePayload.MRData : null;
  const nextMrData = nextRacePayload && isRecord(nextRacePayload.MRData) ? nextRacePayload.MRData : null;

  const driverTable = driverMrData && isRecord(driverMrData.StandingsTable) ? driverMrData.StandingsTable : null;
  const constructorTable = constructorMrData && isRecord(constructorMrData.StandingsTable) ? constructorMrData.StandingsTable : null;
  const driverList = driverTable ? asArray(driverTable.StandingsLists) : [];
  const constructorList = constructorTable ? asArray(constructorTable.StandingsLists) : [];
  const driverStandings = enrichMotorsportRowsWithAssets(
    asArray(driverList[0]?.DriverStandings)
    .map(mapMotorsportStandingRow)
    .filter((row): row is MotorsportStandingRow => !!row),
    openF1Drivers,
  );
  const constructorStandings = enrichMotorsportRowsWithAssets(
    asArray(constructorList[0]?.ConstructorStandings)
    .map(mapMotorsportStandingRow)
    .filter((row): row is MotorsportStandingRow => !!row),
    openF1Drivers,
  );

  if (!driverStandings.length && !constructorStandings.length) return null;

  const lastRaceTable = lastMrData && isRecord(lastMrData.RaceTable) ? lastMrData.RaceTable : null;
  const nextRaceTable = nextMrData && isRecord(nextMrData.RaceTable) ? nextMrData.RaceTable : null;
  const lastRace = mapMotorsportRaceSummary(asArray(lastRaceTable?.Races)[0] || {});
  const nextRace = mapMotorsportRaceSummary(asArray(nextRaceTable?.Races)[0] || {});

  return {
    leagueName: 'Formula 1',
    season: toOptionalString(driverTable?.season) || toOptionalString(constructorTable?.season) || '',
    round: toOptionalString(driverTable?.round) || toOptionalString(lastRaceTable?.round) || '',
    updatedAt: new Date().toISOString(),
    driverStandings,
    constructorStandings,
    lastRace,
    nextRace,
  };
}
