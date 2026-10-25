import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";
import { entitlements, outboundEvents, programmes, subscriptions } from "@/db/schema";
import type { Database } from "@/db/types";
import { handleStripeEvent } from "@/lib/billing";
import { withIdempotency } from "@/lib/webhooks";
import { createTestDb } from "./helpers/db";
import { checkoutSession, fakeDeps, seedBasics, stripeEvent, subscription } from "./helpers/fixtures";

/** Process an event exactly the way the webhook route does. */
function process(db: Database, event: Stripe.Event, subs: Record<string, Stripe.Subscription> = {}) {
  return withIdempotency(db, { id: event.id, provider: "stripe", type: event.type }, (tx) =>
    handleStripeEvent(tx, event, fakeDeps(subs)),
  );
}

async function accessBySlug(db: Database) {
  const rows = await db
    .select({ slug: programmes.slug, source: entitlements.source, status: entitlements.status })
    .from(entitlements)
    .innerJoin(programmes, eq(programmes.id, entitlements.programmeId));
  return rows.map((r) => `${r.slug}:${r.source}:${r.status}`).sort();
}

describe("checkout.session.completed", () => {
  let db: Database;
  beforeEach(async () => {
    db = await createTestDb();
    await seedBasics(db);
  });

  it("lifetime grants arabic + precision + the free usool bundle", async () => {
    await process(db, stripeEvent("evt_1", "checkout.session.completed", checkoutSession({ mode: "payment" })));
    expect(await accessBySlug(db)).toEqual([
      "arabic:lifetime:active",
      "precision:lifetime:active",
      "usool:bundle:active",
    ]);
  });

  it("arabic subscription grants arabic + usool, not precision, and mirrors the subscription", async () => {
    const subs = { sub_1: subscription({ status: "active" }) };
    await process(db, stripeEvent("evt_1", "checkout.session.completed", checkoutSession()), subs);

    expect(await accessBySlug(db)).toEqual(["arabic:subscription:active", "usool:bundle:active"]);
    const [mirror] = await db.select().from(subscriptions);
    expect(mirror).toMatchObject({ id: "sub_1", userId: "user_1", productKey: "arabic_monthly", status: "active" });
  });

  it("a duplicate delivery changes nothing", async () => {
    const event = stripeEvent("evt_1", "checkout.session.completed", checkoutSession({ mode: "payment" }));
    const first = await process(db, event);
    const second = await process(db, event);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await db.select().from(entitlements)).toHaveLength(3);
    expect(await db.select().from(outboundEvents)).toHaveLength(1);
  });

  it("enqueues exactly one student.enrolled event", async () => {
    await process(db, stripeEvent("evt_1", "checkout.session.completed", checkoutSession({ mode: "payment" })));
    const events = await db.select().from(outboundEvents);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "student.enrolled",
      userId: "user_1",
      dedupeKey: "enrolled:user_1:lifetime",
      status: "pending",
    });
    expect(JSON.stringify(events[0].payload)).not.toContain("@"); // no emails in payloads
  });

  it("ignores an unpaid checkout", async () => {
    const res = await process(
      db,
      stripeEvent("evt_1", "checkout.session.completed", checkoutSession({ mode: "payment", paymentStatus: "unpaid" })),
    );
    expect(res.result).toBe("ignored");
    expect(await db.select().from(entitlements)).toHaveLength(0);
  });

  it("trusts Stripe's current state over a stale payload (D3)", async () => {
    // The event payload says active, but Stripe now says canceled.
    await process(db, stripeEvent("evt_1", "checkout.session.completed", checkoutSession()), {
      sub_1: subscription({ status: "active" }),
    });
    await process(db, stripeEvent("evt_2", "customer.subscription.updated", subscription({ status: "active" })), {
      sub_1: subscription({ status: "canceled" }),
    });
    expect(await accessBySlug(db)).toEqual(["arabic:subscription:revoked", "usool:bundle:revoked"]);
  });

  it("removes the free bundle when the last paid access ends", async () => {
    const subs = { sub_1: subscription({ status: "active" }) };
    await process(db, stripeEvent("evt_1", "checkout.session.completed", checkoutSession()), subs);
    subs.sub_1 = subscription({ status: "canceled" });
    await process(db, stripeEvent("evt_2", "customer.subscription.deleted", subs.sub_1), subs);

    const bundle = await db.query.entitlements.findFirst({ where: eq(entitlements.source, "bundle") });
    expect(bundle).toMatchObject({ status: "revoked", revokedReason: "no_paid_access" });
  });

  it("keeps the bundle while another paid programme is still active", async () => {
    const subs = {
      sub_1: subscription({ id: "sub_1", status: "active" }),
      sub_2: subscription({ id: "sub_2", status: "active", productKey: "precision_monthly" }),
    };
    await process(db, stripeEvent("evt_1", "checkout.session.completed", checkoutSession({ subscriptionId: "sub_1" })), subs);
    await process(db, stripeEvent("evt_2", "checkout.session.completed", checkoutSession({ subscriptionId: "sub_2", productKey: "precision_monthly" })), subs);
    subs.sub_1 = subscription({ id: "sub_1", status: "canceled" });
    await process(db, stripeEvent("evt_3", "customer.subscription.deleted", subs.sub_1), subs);

    expect(await accessBySlug(db)).toEqual([
      "arabic:subscription:revoked",
      "precision:subscription:active",
      "usool:bundle:active",
    ]);
  });

  it("fails loudly (and can retry) when the price is unknown", async () => {
    const bad = subscription();
    (bad.items.data[0].price as { id: string }).id = "price_unknown";
    await expect(
      process(db, stripeEvent("evt_1", "checkout.session.completed", checkoutSession()), { sub_1: bad }),
    ).rejects.toThrow(/Unknown price/);
    expect(await db.select().from(entitlements)).toHaveLength(0);
  });
});
