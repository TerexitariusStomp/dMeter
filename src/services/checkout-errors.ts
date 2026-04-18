/**
 * Pure types and discriminators for the checkout error surface.
 *
 * Split out of src/services/checkout.ts because that module imports
 * browser-only SDKs (`dodopayments-checkout`, Clerk) that can't be loaded in
 * node:test. Mirrors the repo convention of sibling `-errors`/`-utils` files
 * used where panels or services need pure helpers testable from node.
 */

export interface AlreadySubscribedError {
  code: 'already_subscribed';
  existingStatus: 'active' | 'on_hold';
  existingPlanKey: string;
  currentPeriodEnd: number;
  message: string;
}

/**
 * Discriminator for the structured 409 payload produced by
 * convex/payments/checkout.ts. A true return routes the caller to the
 * "Manage subscription" modal; false falls through to generic error handling.
 */
export function isAlreadySubscribedError(
  value: unknown,
): value is AlreadySubscribedError {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { code?: unknown }).code === 'already_subscribed'
  );
}
