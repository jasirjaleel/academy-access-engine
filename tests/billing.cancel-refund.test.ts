import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { cancellationFeedback, entitlements, outboundEvents, subscriptions } from "@/db/schema";
import type { Database } from "@/db/types";
import { handleStripeEvent } from "@/lib/billing";
import type { BillingDeps } from "@/lib/billing/types";
import { offerFor } from "@/lib/cancellation";
import { withIdempotency } from "@/lib/webhooks";
import { createTestDb } from "./helpers/db";
import { charge, checkoutSession, fakeDeps, NOW, seedBasics, stripeEvent, subscription } from "./helpers/fixtures";

function process(db: Database, event: Stripe.Event, deps: BillingDeps) {
  return withIdempotency(db, { id: event.id, provider: "stripe", type: event.type }, (tx) =>
    handleStripeEvent(tx, event, deps),
  );
}
const outbox = async (db: Database) => (await db.select().from(outboundEvents)).map((e) => e.type).sort();

describe("cancellation (subscription mirror)", () => {
  let db: Database;
  let subs: Record<string, Stripe.Subscription>;
  beforeEach(async () => {
    db = await createTestDb();
    await seedBasics(db);
    subs = { sub_1: subscription({ status: "active" }) };
    await process(db, stripeEvent("evt_c", "checkout.session.completed", checkoutSession()), fakeDeps(subs));
  });

  it("scheduling a cancel keeps access, mirrors the flag and queues one notice", async () => {
    subs.sub_1 = subscription({ status: "active", cancelAtPeriodEnd: true });
    await process(db, stripeEvent("evt_u1", "customer.subscription.updated", subs.sub_1), fakeDeps(subs));
    await process(db, stripeEvent("evt_u2", "customer.subscription.updated", subs.sub_1), fakeDeps(subs));

    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, "sub_1") });
    expect(sub?.cancelAtPeriodEnd).toBe(true);
    const ent = await db.query.entitlements.findFirst({ where: eq(entitlements.source, "subscription") });
    expect(ent?.status).toBe("active");
    expect((await outbox(db)).filter((t) => t === "subscription.cancel_scheduled")).toHaveLength(1);
  });

  it("when the period ends, access is revoked and subscription.ended is queued once", async () => {
    subs.sub_1 = subscription({ status: "canceled" });
    await process(db, stripeEvent("evt_d", "customer.subscription.deleted", subs.sub_1), fakeDeps(subs));
    await process(db, stripeEvent("evt_d2", "customer.subscription.updated", subs.sub_1), fakeDeps(subs));
    expect((await outbox(db)).filter((t) => t === "subscription.ended")).toHaveLength(1);
  });

  it("mirrors a billing pause without touching access", async () => {
    const resumes = Math.floor(NOW.getTime() / 1000) + 30 * 86400;
    subs.sub_1 = subscription({ status: "active", pausedUntil: resumes });
    await process(db, stripeEvent("evt_p", "customer.subscription.updated", subs.sub_1), fakeDeps(subs));
    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, "sub_1") });
    expect(sub?.pausedUntil?.getTime()).toBe(resumes * 1000);
    expect((await db.query.entitlements.findFirst({ where: eq(entitlements.source, "subscription") }))?.status).toBe("active");
  });

  it("offers a discount for price, a pause for time, nothing otherwise, and each offer only once", async () => {
    expect(await offerFor(db, "user_1", "sub_1", "too_expensive")).toBe("discount");
    expect(await offerFor(db, "user_1", "sub_1", "taking_break")).toBe("pause");
    expect(await offerFor(db, "user_1", "sub_1", "not_what_expected")).toBeNull();

    await db.insert(cancellationFeedback).values({
      userId: "user_1",
      subscriptionId: "sub_1",
      reason: "too_expensive",
      offerShown: "discount",
      offerAccepted: true,
    });
    expect(await offerFor(db, "user_1", "sub_1", "too_expensive")).toBeNull();
  });
});

describe("refunds", () => {
  let db: Database;
  beforeEach(async () => {
    db = await createTestDb();
    await seedBasics(db);
    await process(db, stripeEvent("evt_l", "checkout.session.completed", checkoutSession({ mode: "payment" })), fakeDeps());
  });

  it("a full refund of lifetime revokes access and the bundle", async () => {
    await process(db, stripeEvent("evt_r", "charge.refunded", charge()), fakeDeps());
    const rows = await db.select().from(entitlements);
    expect(rows.every((r) => r.status === "revoked")).toBe(true);
    expect(rows.filter((r) => r.source === "lifetime").every((r) => r.revokedReason === "refunded")).toBe(true);
    expect((await outbox(db)).filter((t) => t === "access.revoked")).toHaveLength(1);
  });

  it("a partial refund changes nothing", async () => {
    const res = await process(db, stripeEvent("evt_r", "charge.refunded", charge({ refunded: 10000 })), fakeDeps());
    expect(res.result).toBe("ignored");
    expect((await db.select().from(entitlements)).every((r) => r.status === "active")).toBe(true);
  });

  it("a refund for an unrelated payment is ignored", async () => {
    const res = await process(db, stripeEvent("evt_r", "charge.refunded", charge({ paymentIntent: "pi_other" })), fakeDeps());
    expect(res.result).toBe("ignored");
  });
});
