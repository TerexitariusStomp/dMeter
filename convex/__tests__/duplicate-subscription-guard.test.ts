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
const API_STARTER_ANNUAL_PRODUCT = "pdt_0Nbu2lawHYE3dv2THgSEV";
const ENTERPRISE_PRODUCT = "pdt_0Nbttnqrfh51cRqhMdVLx";

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
// getBlockingSubscriptions
// ---------------------------------------------------------------------------

describe("getBlockingSubscriptions", () => {
  test("returns [] when user has no subscriptions", async () => {
    const t = convexTest(schema, modules);
    const subs = await t.query(
      internal.payments.billing.getBlockingSubscriptions,
      { userId: USER_ID },
    );
    expect(subs).toEqual([]);
  });

  test("returns the active subscription", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "active", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    const subs = await t.query(
      internal.payments.billing.getBlockingSubscriptions,
      { userId: USER_ID },
    );
    expect(subs.length).toBe(1);
    expect(subs[0]?.status).toBe("active");
    expect(subs[0]?.planKey).toBe("pro_monthly");
  });

  test("returns on_hold plus cancelled-filtered-out", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "on_hold", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "cancelled", planKey: "pro_annual", dodoProductId: PRO_ANNUAL_PRODUCT });
    const subs = await t.query(
      internal.payments.billing.getBlockingSubscriptions,
      { userId: USER_ID },
    );
    expect(subs.length).toBe(1);
    expect(subs[0]?.status).toBe("on_hold");
  });

  test("returns both active and on_hold when both exist", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "on_hold", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "active", planKey: "pro_annual", dodoProductId: PRO_ANNUAL_PRODUCT });
    const subs = await t.query(
      internal.payments.billing.getBlockingSubscriptions,
      { userId: USER_ID },
    );
    expect(subs.length).toBe(2);
    const statuses = subs.map((s) => s.status).sort();
    expect(statuses).toEqual(["active", "on_hold"]);
  });

  test("ignores cancelled and expired subscriptions", async () => {
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "cancelled", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "expired", planKey: "pro_annual", dodoProductId: PRO_ANNUAL_PRODUCT });
    const subs = await t.query(
      internal.payments.billing.getBlockingSubscriptions,
      { userId: USER_ID },
    );
    expect(subs).toEqual([]);
  });

  test("returns every active row when multiple exist (stale + current)", async () => {
    // Real-world case: a user with a historical active pro_monthly that
    // never cancelled, plus a current active api_starter. The caller must
    // see both so tier comparison evaluates against the highest.
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "active", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "active", planKey: "api_starter", dodoProductId: API_STARTER_PRODUCT });
    const subs = await t.query(
      internal.payments.billing.getBlockingSubscriptions,
      { userId: USER_ID },
    );
    expect(subs.length).toBe(2);
    const planKeys = subs.map((s) => s.planKey).sort();
    expect(planKeys).toEqual(["api_starter", "pro_monthly"]);
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

  test("regression: stale pro_monthly + current api_starter blocks api_starter_annual (same tier)", async () => {
    // Before the multi-row fix, the guard picked the first active row it
    // saw. If the stale pro_monthly (tier 1) came back first, requestedTier
    // (api_starter_annual = 2) > existingTier (1), so it was mis-classified
    // as an upgrade and a duplicate API Starter checkout was allowed.
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "active", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "active", planKey: "api_starter", dodoProductId: API_STARTER_PRODUCT });
    const err = await runCheckoutAndCaptureError(t, API_STARTER_ANNUAL_PRODUCT);
    expect(isAlreadySubscribedError(err)).toBe(true);
    const data = parseErrorData(err)!;
    // The error should reference the highest-tier active row, not the stale one.
    expect(data.existingPlanKey).toBe("api_starter");
  });

  test("allows genuine upgrade above all active rows (pro_monthly + api_starter → enterprise)", async () => {
    // Enterprise is tier 3, strictly higher than both active rows (tier 1 + 2).
    // This must still flow through as an upgrade.
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "active", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "active", planKey: "api_starter", dodoProductId: API_STARTER_PRODUCT });
    const err = await runCheckoutAndCaptureError(t, ENTERPRISE_PRODUCT);
    expect(isAlreadySubscribedError(err)).toBe(false);
  });

  test("on_hold takes priority even when a higher-tier active row exists", async () => {
    // If ANY sub is on_hold we block regardless of tier, because the user
    // must fix the failed-payment sub before starting a parallel one.
    const t = convexTest(schema, modules);
    await seedSub(t, { status: "on_hold", planKey: "pro_monthly", dodoProductId: PRO_MONTHLY_PRODUCT });
    await seedSub(t, { status: "active", planKey: "api_starter", dodoProductId: API_STARTER_PRODUCT });
    const err = await runCheckoutAndCaptureError(t, ENTERPRISE_PRODUCT);
    expect(isAlreadySubscribedError(err)).toBe(true);
    const data = parseErrorData(err)!;
    expect(data.existingStatus).toBe("on_hold");
    expect(data.existingPlanKey).toBe("pro_monthly");
  });
});
