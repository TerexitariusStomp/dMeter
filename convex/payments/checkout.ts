/**
 * Checkout session creation for Dodo Payments.
 *
 * Two entry points:
 *   - createCheckout (public action): authenticated via Convex/Clerk auth
 *   - internalCreateCheckout (internal action): called by /relay/create-checkout
 *     with trusted userId from the edge gateway
 *
 * Both share the same core logic via _createCheckoutSession().
 */

import { v, ConvexError } from "convex/values";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { checkout } from "../lib/dodo";
import { requireUserId, resolveUserIdentity } from "../lib/auth";
import { signUserId } from "../lib/identitySigning";
import {
  PRODUCT_CATALOG,
  resolveProductToPlan,
} from "../config/productCatalog";

// ---------------------------------------------------------------------------
// Shared checkout session creation logic
// ---------------------------------------------------------------------------

interface CheckoutArgs {
  productId: string;
  returnUrl?: string;
  discountCode?: string;
  referralCode?: string;
}

interface UserInfo {
  userId: string;
  email?: string;
  name?: string;
}

async function _createCheckoutSession(
  ctx: ActionCtx,
  args: CheckoutArgs,
  user: UserInfo,
) {
  // Validate returnUrl to prevent open-redirect attacks.
  const siteUrl = process.env.SITE_URL ?? "https://worldmonitor.app";
  let returnUrl = siteUrl;
  if (args.returnUrl) {
    let parsedReturnUrl: URL;
    try {
      parsedReturnUrl = new URL(args.returnUrl);
    } catch {
      throw new ConvexError("Invalid returnUrl: must be a valid absolute URL");
    }

    const allowedOrigins = new Set([
      "https://worldmonitor.app",
      "https://www.worldmonitor.app",
      "https://app.worldmonitor.app",
      "https://tech.worldmonitor.app",
      "https://finance.worldmonitor.app",
      "https://commodity.worldmonitor.app",
      "https://happy.worldmonitor.app",
      new URL(siteUrl).origin,
    ]);
    if (!allowedOrigins.has(parsedReturnUrl.origin)) {
      throw new ConvexError(
        "Invalid returnUrl: must use a trusted worldmonitor.app origin",
      );
    }
    returnUrl = parsedReturnUrl.toString();
  }

  // Duplicate-subscription guard. Prevents the case where a user clicks
  // "Subscribe" twice during a slow webhook activation and ends up with two
  // parallel Dodo subscriptions + two charges (incident 2026-04-17/18:
  // customer cus_0NcmwcAWw0jhVBHVOK58C paid Pro Monthly twice within 32 min).
  //
  // Block:
  //   - Any on_hold row (payment failed — must update payment method)
  //   - Any active row at the same or higher tier as the requested product
  //     (duplicate same-tier purchase, or attempted downgrade)
  //
  // Allow:
  //   - No subscription, or only cancelled/expired rows (resubscribe)
  //   - Upgrade: every active row is strictly lower tier than requested
  //
  // We must evaluate ALL active rows, not just one: a user may have a stale
  // active sub at one tier and a current active sub at another, and picking
  // the wrong row as the baseline lets a same-tier duplicate slip through.
  const requestedPlanKey = resolveProductToPlan(args.productId);
  if (!requestedPlanKey) {
    throw new ConvexError(
      `Unknown productId ${args.productId}. Add it to PRODUCT_CATALOG or seed the alias.`,
    );
  }
  const requestedCatalog = PRODUCT_CATALOG[requestedPlanKey];
  if (!requestedCatalog) {
    throw new ConvexError(
      `Resolved plan ${requestedPlanKey} is not in PRODUCT_CATALOG.`,
    );
  }
  const requestedTier = requestedCatalog.features.tier;
  const existingSubs = await ctx.runQuery(
    internal.payments.billing.getBlockingSubscriptions,
    { userId: user.userId },
  );

  // on_hold takes priority — no new checkouts while a payment is unresolved.
  const onHold = existingSubs.find((s) => s.status === "on_hold");
  if (onHold) {
    throw new ConvexError({
      code: "already_subscribed",
      existingStatus: "on_hold",
      existingPlanKey: onHold.planKey,
      currentPeriodEnd: onHold.currentPeriodEnd,
      message:
        "Your subscription is on hold due to a payment issue. Update your payment method in the billing portal instead of starting a new subscription.",
    });
  }

  // Find the highest-tier active row across all active subs. Block if any
  // active row has tier >= requested — only true upgrades (every active row
  // strictly lower) are allowed through.
  let highestActive: (typeof existingSubs)[number] | null = null;
  let highestActiveTier = -1;
  for (const sub of existingSubs) {
    if (sub.status !== "active") continue;
    const tier = PRODUCT_CATALOG[sub.planKey]?.features.tier ?? 0;
    if (tier > highestActiveTier) {
      highestActiveTier = tier;
      highestActive = sub;
    }
  }
  if (highestActive && highestActiveTier >= requestedTier) {
    throw new ConvexError({
      code: "already_subscribed",
      existingStatus: "active",
      existingPlanKey: highestActive.planKey,
      currentPeriodEnd: highestActive.currentPeriodEnd,
      message:
        "You already have an active subscription. Manage it in the billing portal.",
    });
  }

  // Build metadata: HMAC-signed userId for the webhook identity bridge.
  const metadata: Record<string, string> = {};
  metadata.wm_user_id = user.userId;
  metadata.wm_user_id_sig = await signUserId(user.userId);
  if (args.referralCode) {
    metadata.affonso_referral = args.referralCode;
  }

  try {
    const result = await checkout(ctx, {
      payload: {
        product_cart: [{ product_id: args.productId, quantity: 1 }],
        return_url: returnUrl,
        // Note: deliberately not passing `customer` block — Dodo locks
        // those fields as read-only. User identity is tracked via
        // metadata.wm_user_id + HMAC signature instead.
        ...(args.discountCode ? { discount_code: args.discountCode } : {}),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        feature_flags: {
          allow_discount_code: true,
        },
        customization: {
          theme: "dark",
        },
      },
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[checkout] createCheckout failed for user=${user.userId} product=${args.productId}: ${msg}`,
    );
    throw new ConvexError(`Checkout failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Public action: authenticated via Convex/Clerk auth
// ---------------------------------------------------------------------------

export const createCheckout = action({
  args: {
    productId: v.string(),
    returnUrl: v.optional(v.string()),
    discountCode: v.optional(v.string()),
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const identity = await resolveUserIdentity(ctx);

    const customerName = identity
      ? [identity.givenName, identity.familyName].filter(Boolean).join(" ") ||
        identity.name
      : undefined;

    return _createCheckoutSession(ctx, args, {
      userId,
      email: identity?.email,
      name: customerName,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal action: called by /relay/create-checkout with trusted userId
// ---------------------------------------------------------------------------

export const internalCreateCheckout = internalAction({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    productId: v.string(),
    returnUrl: v.optional(v.string()),
    discountCode: v.optional(v.string()),
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      throw new ConvexError("userId is required");
    }
    return _createCheckoutSession(
      ctx,
      {
        productId: args.productId,
        returnUrl: args.returnUrl,
        discountCode: args.discountCode,
        referralCode: args.referralCode,
      },
      {
        userId: args.userId,
        email: args.email,
        name: args.name,
      },
    );
  },
});
