/**
 * Convex component SDK (@dodopayments/convex) — for checkout session creation.
 *
 * This file uses the Convex-aware component SDK which threads `ctx` through
 * the Convex component graph. Use it for: checkout session creation.
 *
 * For admin operations the component SDK does not expose (customer portal
 * sessions, subscription plan changes), use the direct REST SDK in
 * payments/billing.ts (dodopayments package) instead.
 *
 * Both files read DODO_API_KEY exclusively — no other env var fallback.
 * Config is read lazily (on first use) rather than at module scope.
 */

import { DodoPayments } from "@dodopayments/convex";
import { components } from "../_generated/api";

let _instance: DodoPayments | null = null;

function getDodoInstance(): DodoPayments {
  if (_instance) return _instance;

  const apiKey = process.env.DODO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[dodo] DODO_API_KEY is not set. " +
        "Set it in the Convex dashboard environment variables.",
    );
  }

  _instance = new DodoPayments(components.dodopayments, {
    identify: async () => null, // Stub until real auth integration
    apiKey,
    environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode") as
      | "test_mode"
      | "live_mode",
  });

  return _instance;
}

/**
 * Lazily-initialized Dodo API accessors.
 * Throws immediately if DODO_API_KEY is missing, so callers get a clear
 * error at the action boundary rather than a cryptic SDK failure later.
 */
export function getDodoApi() {
  return getDodoInstance().api();
}

/** Shorthand for checkout API. */
export function checkout(...args: Parameters<ReturnType<DodoPayments['api']>['checkout']>) {
  return getDodoApi().checkout(...args);
}

/** Shorthand for customer portal API. */
export function customerPortal(...args: Parameters<ReturnType<DodoPayments['api']>['customerPortal']>) {
  return getDodoApi().customerPortal(...args);
}
