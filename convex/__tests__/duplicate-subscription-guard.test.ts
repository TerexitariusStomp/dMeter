import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { ConvexError } from "convex/values";

const modules = import.meta.glob("../**/*.ts");

const USER_ID = "user_guard_test_001";
const NOW = Date.now();
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const PRO_MONTHLY_PRODUCT = "pdt_0Nbtt71uObulf7fGXhQup";
const PRO_ANNUAL_PRODUCT = "pdt_0NbttMIfjLWC10jHQWYgJ";
const API_STARTER_PRODUCT = "pdt_0NbttVmG1SERrxhygbbUq";

async function seedSub(
  t: ReturnType<typeof convexTest>,
  opts: {
    status: "active" | "on_hold" | "cancelled" | "expired";
    planKey: string;
    dodoProductId: string;
    periodEnd?: number;
  },
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("subscriptions", {
      userId: USER_ID,
      dodoSubscriptionId: `sub_guard_${opts.planKey}_${opts.status}`,
      dodoProductId: opts.dodoProductId,
      planKey: opts.planKey,
      status: opts.status,
      currentPeriodStart: NOW,
      currentPeriodEnd: opts.periodEnd ?? NOW + MONTH_MS,
      rawPayload: {},
      updatedAt: NOW,
    });
  });
}

// ---------------------------------------------------------------------------
// getBlockingSubscription
// ---------------------------------------------------------------------------

describe("getBlockingSubscription", () => {
  test("returns null when user has no subscriptions", async () => {
    const t = convexTest(schema, modules);
    const sub = await t.query(
      internal.payments.billing.getBlockingSubscription,
      { userId: USER_ID },
    );
    expect(sub).toBeNull();
  });

  test("returns the active subscription", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "active", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    const sub = await t.query(
      internal.payments.billing.getBlockingSubscription,
      { userId: USER_ID },
    );
    expect(sub?.status).toBe("active");
    expect(sub?.planKey).toBe("pro_monthly");
  });

  test("returns on_hold when no active subscription exists", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "on_hold", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "cancelled", planKey: "pro_annual", dodoProductId: PRO_ANNUAL_PRODUCT });
    const sub = await t.query(
      internal.payments.billing.getBlockingSubscription,
      { userId: USER_ID },
    );
    expect(sub?.status).toBe("on_hold");
  });

  test("prefers active over on_hold when both exist", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "on_hold", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "active", planKey: "pro_annual", dodoProductId: PRO_ANNUAL_PRODUCT });
    const sub = await t.query(
      internal.payments.billing.getBlockingSubscription,
      { userId: USER_ID },
    );
    expect(sub?.status).toBe("active");
    expect(sub?.planKey).toBe("pro_annual");
  });

  test("ignores cancelled and expired subscriptions", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "cancelled", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "expired", planKey: "pro_annual", dodoProductId: PRO_ANNUAL_PRODUCT });
    const sub = await t.query(
      internal.payments.billing.getBlockingSubscription,
      { userId: USER_ID },
    );
    expect(sub).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// internalCreateCheckout guard
// ---------------------------------------------------------------------------
//
// We can't let the guard pass without hitting the Dodo SDK (which requires
// live credentials), so the "allow" cases assert the error is NOT
// already_subscribed — some other Dodo/env error is expected and acceptable
// for our purposes. The block cases assert the specific ConvexError payload.

async function runCheckoutAndCaptureError(
  t: ReturnType<typeof convexTest>,
  productId: string,
): Promise<unknown> {
  try {
    await t.action(internal.payments.checkout.internalCreateCheckout, {
      userId: USER_ID,
      productId,
    });
    return null;
  } catch (err) {
    return err;
  }
}

function parseErrorData(err: unknown): Record<string, unknown> | null {
  const raw = (err as { data?: unknown })?.data;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return null;
}

function isAlreadySubscribedError(err: unknown): boolean {
  const data = parseErrorData(err);
  return !!data && data.code === "already_subscribed";
}

describe("internalCreateCheckout duplicate-subscription guard", () => {
  test("blocks a second pro_monthly when user already has active pro_monthly", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "active", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    const err = await runCheckoutAndCaptureError(t, PRO_MONTHLY_PRODUCT);
    expect(err).not.toBeNull();
    expect(isAlreadySubscribedError(err)).toBe(true);
    const data = parseErrorData(err)!;
    expect(data.existingStatus).toBe("active");
    expect(data.existingPlanKey).toBe("pro_monthly");
    expect(typeof data.currentPeriodEnd).toBe("number");
    expect(typeof data.message).toBe("string");
  });

  test("blocks pro_annual when user already has active pro_monthly (same tier group)", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "active", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    const err = await runCheckoutAndCaptureError(t, PRO_ANNUAL_PRODUCT);
    expect(isAlreadySubscribedError(err)).toBe(true);
  });

  test("blocks any new checkout when user has an on_hold subscription", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "on_hold", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    const err = await runCheckoutAndCaptureError(t, PRO_MONTHLY_PRODUCT);
    expect(isAlreadySubscribedError(err)).toBe(true);
    const data = parseErrorData(err)!;
    expect(data.existingStatus).toBe("on_hold");
    expect(String(data.message).toLowerCase()).toContain("payment");
  });

  test("allows api_starter when user has active pro_monthly (tier upgrade)", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "active", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    // pro_monthly = tier 1; api_starter = tier 2. Upgrade path must not be blocked.
    const err = await runCheckoutAndCaptureError(t, API_STARTER_PRODUCT);
    expect(isAlreadySubscribedError(err)).toBe(false);
  });

  test("allows a new checkout when the only prior sub is cancelled", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "cancelled", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    const err = await runCheckoutAndCaptureError(t, PRO_MONTHLY_PRODUCT);
    expect(isAlreadySubscribedError(err)).toBe(false);
  });

  test("allows a new checkout when the only prior sub is expired", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "expired", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    const err = await runCheckoutAndCaptureError(t, PRO_MONTHLY_PRODUCT);
    expect(isAlreadySubscribedError(err)).toBe(false);
  });
});
