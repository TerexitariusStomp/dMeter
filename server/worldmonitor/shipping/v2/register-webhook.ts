import type {
  ServerContext,
  RegisterWebhookRequest,
  RegisterWebhookResponse,
} from '../../../../src/generated/server/worldmonitor/shipping/v2/service_server';
import {
  ApiError,
  ValidationError,
} from '../../../../src/generated/server/worldmonitor/shipping/v2/service_server';

import { isCallerPremium } from '../../../_shared/premium-check';
import { runRedisPipeline } from '../../../_shared/redis';
import {
  WEBHOOK_TTL,
  VALID_CHOKEPOINT_IDS,
  isBlockedCallbackUrl,
  generateSecret,
  generateSubscriberId,
  webhookKey,
  ownerIndexKey,
  callerFingerprint,
  type WebhookRecord,
} from './webhook-shared';

export async function registerWebhook(
  ctx: ServerContext,
  req: RegisterWebhookRequest,
): Promise<RegisterWebhookResponse> {
  const isPro = await isCallerPremium(ctx.request);
  if (!isPro) {
    throw new ApiError(403, 'PRO subscription required', '');
  }

  const callbackUrl = (req.callbackUrl ?? '').trim();
  if (!callbackUrl) {
    throw new ValidationError([{ field: 'callbackUrl', description: 'callbackUrl is required' }]);
  }

  const ssrfError = isBlockedCallbackUrl(callbackUrl);
  if (ssrfError) {
    throw new ValidationError([{ field: 'callbackUrl', description: ssrfError }]);
  }

  const chokepointIds = Array.isArray(req.chokepointIds) ? req.chokepointIds : [];
  const invalidCp = chokepointIds.find(id => !VALID_CHOKEPOINT_IDS.has(id));
  if (invalidCp) {
    throw new ValidationError([
      { field: 'chokepointIds', description: `Unknown chokepoint ID: ${invalidCp}` },
    ]);
  }

  // Proto default int32 is 0 — treat 0 as "unset" to preserve the legacy
  // default of 50 when the caller omits alertThreshold.
  const alertThreshold = req.alertThreshold > 0 ? req.alertThreshold : 50;
  if (alertThreshold < 0 || alertThreshold > 100) {
    throw new ValidationError([
      { field: 'alertThreshold', description: 'alertThreshold must be a number between 0 and 100' },
    ]);
  }

  const ownerTag = await callerFingerprint(ctx.request);
  const newSubscriberId = generateSubscriberId();
  const secret = await generateSecret();

  const record: WebhookRecord = {
    subscriberId: newSubscriberId,
    ownerTag,
    callbackUrl,
    chokepointIds: chokepointIds.length ? chokepointIds : [...VALID_CHOKEPOINT_IDS],
    alertThreshold,
    createdAt: new Date().toISOString(),
    active: true,
    secret,
  };

  await runRedisPipeline([
    ['SET', webhookKey(newSubscriberId), JSON.stringify(record), 'EX', String(WEBHOOK_TTL)],
    ['SADD', ownerIndexKey(ownerTag), newSubscriberId],
    ['EXPIRE', ownerIndexKey(ownerTag), String(WEBHOOK_TTL)],
  ]);

  return { subscriberId: newSubscriberId, secret };
}
