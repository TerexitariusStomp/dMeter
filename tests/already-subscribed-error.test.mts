/**
 * Unit tests for isAlreadySubscribedError.
 *
 * This discriminator decides whether a 409 response from /api/create-checkout
 * should open the "Manage subscription" modal or fall through to the generic
 * error path. Getting it wrong means either (a) silently letting the user
 * open a duplicate Dodo checkout (what hit cus_0NcmwcAWw0jhVBHVOK58C on
 * 2026-04-17/18) or (b) showing the modal on unrelated errors.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAlreadySubscribedError } from '@/services/checkout-errors';

describe('isAlreadySubscribedError', () => {
  it('accepts the exact structured payload produced by the Convex guard', () => {
    const payload = {
      code: 'already_subscribed',
      existingStatus: 'active',
      existingPlanKey: 'pro_monthly',
      currentPeriodEnd: 1779061911916,
      message: 'You already have an active subscription. Manage it in the billing portal.',
    };
    assert.equal(isAlreadySubscribedError(payload), true);
  });

  it('accepts the on_hold variant', () => {
    const payload = {
      code: 'already_subscribed',
      existingStatus: 'on_hold',
      existingPlanKey: 'pro_monthly',
      currentPeriodEnd: 1779061911916,
      message: 'Your subscription is on hold due to a payment issue.',
    };
    assert.equal(isAlreadySubscribedError(payload), true);
  });

  it('rejects null and undefined', () => {
    assert.equal(isAlreadySubscribedError(null), false);
    assert.equal(isAlreadySubscribedError(undefined), false);
  });

  it('rejects primitives', () => {
    assert.equal(isAlreadySubscribedError('already_subscribed'), false);
    assert.equal(isAlreadySubscribedError(409), false);
    assert.equal(isAlreadySubscribedError(true), false);
  });

  it('rejects objects with the wrong code', () => {
    assert.equal(isAlreadySubscribedError({ code: 'not_found' }), false);
    assert.equal(isAlreadySubscribedError({ code: 'internal_error' }), false);
  });

  it('rejects objects missing the code field', () => {
    assert.equal(isAlreadySubscribedError({}), false);
    assert.equal(isAlreadySubscribedError({ message: 'something' }), false);
  });

  it('rejects objects where code is not the string "already_subscribed"', () => {
    assert.equal(isAlreadySubscribedError({ code: 1 }), false);
    assert.equal(isAlreadySubscribedError({ code: true }), false);
    assert.equal(isAlreadySubscribedError({ code: {} }), false);
  });

  it('accepts extra fields (forward-compatible)', () => {
    const payload = {
      code: 'already_subscribed',
      existingStatus: 'active',
      existingPlanKey: 'pro_monthly',
      currentPeriodEnd: 1779061911916,
      message: 'x',
      newFutureField: 'ignore me',
    };
    assert.equal(isAlreadySubscribedError(payload), true);
  });
});
