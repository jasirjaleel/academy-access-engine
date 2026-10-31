import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { entitlements, invoices, outboundEvents } from "@/db/schema";
import type { Database } from "@/db/types";
import { handleStripeEvent } from "@/lib/billing";
import { expireGrace } from "@/lib/billing/grace";
import { GRACE_DAYS } from "@/lib/billing/invoices";
import type { BillingDeps } from "@/lib/billing/types";
import { withIdempotency } from "@/lib/webhooks";
import { createTestDb } from "./helpers/db";
import { checkoutSession, fakeDeps, invoice, NOW, seedBasics, stripeEvent, subscription } from "./helpers/fixtures";

const DAY = 86_400_000;

function process(db: Database, event: Stripe.Event, deps: BillingDeps) {
  return withIdempotency(db, { id: event.id, provider: "stripe", type: event.type }, (tx) =>
    handleStripeEvent(tx, event, deps),
  );
}

const arabic = (db: Database) =>
  db.query.entitlements.findFirst({ where: eq(entitlements.source, "subscription") });
const bundle = (db: Database) => db.query.entitlements.findFirst({ where: eq(entitlements.source, "bundle") });
const eventTypes = async (db: Database) => (await db.select().from(outboundEvents)).map((e) => e.type).sort();

describe("failed payment → grace → recovery / expiry", () => {
  let db: Database;
  let subs: Record<string, Stripe.Subscription>;
  let deps: BillingDeps;

  beforeEach(async () => {
    db = await createTestDb();
    await seedBasics(db);
    subs = { sub_1: subscription({ status: "active" }) };
    deps = fakeDeps(subs);
    await process(db, stripeEvent("evt_checkout", "checkout.session.completed", checkoutSession()), deps);
  });

  async function fail(attempt = 1, at = NOW) {
    subs.sub_1 = subscription({ status: "past_due" });
    await process(db, stripeEvent(`evt_fail_${attempt}`, "invoice.payment_failed", invoice({ attempt })), {
      ...fakeDeps(subs),
      now: () => at,
    });
  }

  it("moves access into a 7-day grace period and keeps the free bundle", async () => {
    await fail();
    const e = await arabic(db);
    expect(e?.status).toBe("grace");
    expect(e?.graceUntil?.getTime()).toBe(NOW.getTime() + GRACE_DAYS * DAY);
    expect((await bundle(db))?.status).toBe("active");
    expect(await eventTypes(db)).toEqual(["payment.failed", "student.enrolled"]);
  });

  it("counts grace from the FIRST failure, even after Stripe retries", async () => {
    await fail(1, NOW);
    await fail(2, new Date(NOW.getTime() + 3 * DAY));
    const e = await arabic(db);
    expect(e?.graceUntil?.getTime()).toBe(NOW.getTime() + GRACE_DAYS * DAY);
    // one reminder per attempt
    expect((await eventTypes(db)).filter((t) => t === "payment.failed")).toHaveLength(2);
  });

  it("recovers: paying the invoice restores access and queues payment.recovered", async () => {
    await fail();
    subs.sub_1 = subscription({ status: "active" });
    await process(db, stripeEvent("evt_paid", "invoice.paid", invoice({ status: "paid" })), fakeDeps(subs));

    const e = await arabic(db);
    expect(e).toMatchObject({ status: "active", graceUntil: null });
    const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, "in_1") });
    expect(inv).toMatchObject({ status: "paid" });
    expect(inv?.firstFailedAt).not.toBeNull();
    expect(await eventTypes(db)).toEqual(["payment.failed", "payment.recovered", "student.enrolled"]);
  });

  it("a normal renewal (no failure) does not send payment.recovered", async () => {
    await process(db, stripeEvent("evt_paid", "invoice.paid", invoice({ status: "paid" })), fakeDeps(subs));
    expect(await eventTypes(db)).toEqual(["student.enrolled"]);
  });

  it("ignores a late failure event for an invoice that is already paid", async () => {
    await process(db, stripeEvent("evt_paid", "invoice.paid", invoice({ status: "paid" })), fakeDeps(subs));
    await fail();
    expect((await arabic(db))?.status).toBe("active");
  });

  it("expiry job revokes access after the grace period, removes the bundle, and is idempotent", async () => {
    await fail();
    const later = new Date(NOW.getTime() + (GRACE_DAYS + 1) * DAY);
    expect(await expireGrace(db, new Date(NOW.getTime() + DAY))).toBe(0); // still in grace
    expect(await expireGrace(db, later)).toBe(1);
    expect(await expireGrace(db, later)).toBe(0);

    expect(await arabic(db)).toMatchObject({ status: "revoked", revokedReason: "payment_failed" });
    expect(await bundle(db)).toMatchObject({ status: "revoked", revokedReason: "no_paid_access" });
    expect((await eventTypes(db)).filter((t) => t === "access.revoked")).toHaveLength(1);
  });

  it("subscription deleted while in grace is recorded as payment_failed", async () => {
    await fail();
    subs.sub_1 = subscription({ status: "canceled" });
    await process(db, stripeEvent("evt_del", "customer.subscription.deleted", subs.sub_1), fakeDeps(subs));
    expect(await arabic(db)).toMatchObject({ status: "revoked", revokedReason: "payment_failed" });
  });

  it("a duplicate payment_failed delivery changes nothing", async () => {
    await fail();
    await fail(); // same event id evt_fail_1
    expect((await eventTypes(db)).filter((t) => t === "payment.failed")).toHaveLength(1);
  });
});

describe("events delivered after the renewal already failed", () => {
  it("starts access in grace instead of locking the student out", async () => {
    const db = await createTestDb();
    await seedBasics(db);
    // Every re-fetch already sees past_due, so checkout/subscription events grant nothing.
    const subs = { sub_1: subscription({ status: "past_due" }) };
    const deps = fakeDeps(subs);
    await process(db, stripeEvent("evt_checkout", "checkout.session.completed", checkoutSession()), deps);
    expect(await arabic(db)).toBeUndefined();

    await process(db, stripeEvent("evt_fail_1", "invoice.payment_failed", invoice({ attempt: 1 })), deps);
    const e = await arabic(db);
    expect(e?.status).toBe("grace");
    expect(e?.graceUntil?.getTime()).toBe(NOW.getTime() + GRACE_DAYS * DAY);
  });

  it("does not bring back access that was already revoked", async () => {
    const db = await createTestDb();
    await seedBasics(db);
    const subs = { sub_1: subscription({ status: "active" }) };
    await process(db, stripeEvent("evt_checkout", "checkout.session.completed", checkoutSession()), fakeDeps(subs));
    subs.sub_1 = subscription({ status: "canceled" });
    await process(db, stripeEvent("evt_del", "customer.subscription.deleted", subs.sub_1), fakeDeps(subs));

    await process(db, stripeEvent("evt_fail_1", "invoice.payment_failed", invoice({ attempt: 1 })), fakeDeps(subs));
    expect((await arabic(db))?.status).toBe("revoked");
  });
});
