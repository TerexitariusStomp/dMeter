import type {
  ServerContext,
  ListWebhooksRequest,
  ListWebhooksResponse,
  WebhookSummary,
} from '../../../../src/generated/server/worldmonitor/shipping/v2/service_server';
import { ApiError } from '../../../../src/generated/server/worldmonitor/shipping/v2/service_server';

import { isCallerPremium } from '../../../_shared/premium-check';
import { runRedisPipeline } from '../../../_shared/redis';
import {
  webhookKey,
  ownerIndexKey,
  callerFingerprint,
  type WebhookRecord,
} from './webhook-shared';

export async function listWebhooks(
  ctx: ServerContext,
  _req: ListWebhooksRequest,
): Promise<ListWebhooksResponse> {
  const isPro = await isCallerPremium(ctx.request);
  if (!isPro) {
    throw new ApiError(403, 'PRO subscription required', '');
  }

  const ownerHash = await callerFingerprint(ctx.request);
  const smembersResult = await runRedisPipeline([['SMEMBERS', ownerIndexKey(ownerHash)]]);
  const memberIds = (smembersResult[0]?.result as string[] | null) ?? [];

  if (memberIds.length === 0) {
    return { webhooks: [] };
  }

  const getResults = await runRedisPipeline(memberIds.map(id => ['GET', webhookKey(id)]));
  const webhooks: WebhookSummary[] = [];
  for (const r of getResults) {
    if (!r.result || typeof r.result !== 'string') continue;
    try {
      const record = JSON.parse(r.result) as WebhookRecord;
      if (record.ownerTag !== ownerHash) continue;
      webhooks.push({
        subscriberId: record.subscriberId,
        callbackUrl: record.callbackUrl,
        chokepointIds: record.chokepointIds,
        alertThreshold: record.alertThreshold,
        createdAt: record.createdAt,
        active: record.active,
      });
    } catch {
      // skip malformed
    }
  }

  return { webhooks };
}
