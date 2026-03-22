/**
 * RPC: getGdeltTopicTimeline -- reads pre-seeded GDELT tone/vol timeline data.
 * All GDELT API calls happen in scripts/seed-gdelt-intel.mjs on Railway.
 * Per-topic keys: gdelt:intel:tone:{topic} and gdelt:intel:vol:{topic}
 */
import type {
  ServerContext,
  GetGdeltTopicTimelineRequest,
  GetGdeltTopicTimelineResponse,
  GdeltTimelinePoint,
} from '../../../../src/generated/server/worldmonitor/intelligence/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';

// Only topics seeded by seed-gdelt-intel.mjs. Prevents unbounded Redis key enumeration.
const KNOWN_TOPICS = new Set([
  'military',
  'cyber',
  'nuclear',
  'sanctions',
  'intelligence',
  'maritime',
]);

export async function getGdeltTopicTimeline(
  _ctx: ServerContext,
  req: GetGdeltTopicTimelineRequest,
): Promise<GetGdeltTopicTimelineResponse> {
  if (!req.topic) return { topic: '', tone: [], vol: [], fetchedAt: '', error: 'topic required' };
  if (!KNOWN_TOPICS.has(req.topic)) return { topic: req.topic, tone: [], vol: [], fetchedAt: '', error: 'unknown topic' };

  try {
    const [toneRaw, volRaw] = await Promise.all([
      getCachedJson(`gdelt:intel:tone:${req.topic}`, true) as Promise<GdeltTimelinePoint[] | null>,
      getCachedJson(`gdelt:intel:vol:${req.topic}`, true) as Promise<GdeltTimelinePoint[] | null>,
    ]);

    return {
      topic: req.topic,
      tone: Array.isArray(toneRaw) ? toneRaw : [],
      vol: Array.isArray(volRaw) ? volRaw : [],
      fetchedAt: new Date().toISOString(),
      error: '',
    };
  } catch {
    return { topic: req.topic, tone: [], vol: [], fetchedAt: '', error: '' };
  }
}
