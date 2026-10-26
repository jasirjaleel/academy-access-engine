import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { entitlements, subscriptions, users } from "@/db/schema";
import type { Database } from "@/db/types";
import { PRODUCTS, type ProductKey } from "@/lib/catalogue";
import { enqueueEvent } from "@/lib/events";
import { syncBundle } from "./bundle";
import { grantEntitlement, revokeEntitlements } from "./entitlements";
import type { BillingDeps } from "./types";

const REVOKED_STATUSES = new Set<Stripe.Subscription.Status>(["canceled", "unpaid", "incomplete_expired"]);

async function resolveUserId(tx: Database, sub: Stripe.Subscription): Promise<string> {
  const fromMetadata = sub.metadata?.userId;
  if (fromMetadata) {
    const u = await tx.query.users.findFirst({ where: eq(users.id, fromMetadata) });
    if (u) return u.id;
  }
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const byCustomer = await tx.query.users.findFirst({ where: eq(users.stripeCustomerId, customerId) });
  if (byCustomer) return byCustomer.id;
  throw new Error(`No user for subscription ${sub.id}`);
}

/**
 * Mirrors a subscription that was RE-FETCHED from Stripe (D3) and updates access.
 * Reused by checkout (M4), payment recovery and cancellation (M5/M6).
 */
export async function applySubscriptionState(
  tx: Database,
  sub: Stripe.Subscription,
  deps: BillingDeps,
): Promise<{ userId: string; productKey: ProductKey }> {
  const item = sub.items.data[0];
  if (!item) throw new Error(`Subscription ${sub.id} has no items`);
  const productKey = deps.productKeyFromPriceId(item.price.id);
  if (!productKey) throw new Error(`Unknown price ${item.price.id} on ${sub.id}`);

  const userId = await resolveUserId(tx, sub);
  const now = deps.now();
  // In current Stripe API versions the period lives on the subscription item.
  const currentPeriodEnd = new Date(item.current_period_end * 1000);
  const resumesAt = sub.pause_collection?.resumes_at;
  const pausedUntil = resumesAt ? new Date(resumesAt * 1000) : null;
  const previous = await tx.query.subscriptions.findFirst({ where: eq(subscriptions.id, sub.id) });

  await tx
    .insert(subscriptions)
    .values({
      id: sub.id,
      userId,
      productKey,
      status: sub.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      pausedUntil,
    })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: {
        status: sub.status,
        productKey,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        pausedUntil,
        updatedAt: sql`now()`,
      },
    });

  const [slug] = PRODUCTS[productKey].programmes;

  if (sub.status === "active" || sub.status === "trialing") {
    await grantEntitlement(tx, { userId, slug, source: "subscription", sourceRef: sub.id });
  } else if (REVOKED_STATUSES.has(sub.status)) {
    // If it ended while in grace, it ended because payment failed.
    const inGrace = await tx.query.entitlements.findFirst({
      where: and(
        eq(entitlements.userId, userId),
        eq(entitlements.source, "subscription"),
        eq(entitlements.sourceRef, sub.id),
        eq(entitlements.status, "grace"),
      ),
    });
    await revokeEntitlements(
      tx,
      { userId, source: "subscription", sourceRef: sub.id },
      inGrace ? "payment_failed" : "canceled",
    );
    if (sub.status === "canceled") {
      await enqueueEvent(tx, {
        type: "subscription.ended",
        userId,
        payload: { subscriptionId: sub.id, productKey, reason: inGrace ? "payment_failed" : "canceled" },
        dedupeKey: `ended:${sub.id}`,
      });
    }
  }
  // Cancellation newly scheduled (the student keeps access until the period ends).
  if (sub.cancel_at_period_end && !previous?.cancelAtPeriodEnd && !REVOKED_STATUSES.has(sub.status)) {
    await enqueueEvent(tx, {
      type: "subscription.cancel_scheduled",
      userId,
      payload: { subscriptionId: sub.id, productKey, endsAt: currentPeriodEnd.toISOString() },
      // One notice per billing period, even if the student cancels, resumes and cancels again.
      dedupeKey: `cancelsched:${sub.id}:${sub.cancel_at ?? item.current_period_end}`,
    });
  }

  // past_due: handled by invoice.payment_failed (grace period, M5).
  // incomplete / paused: no access change.

  await syncBundle(tx, userId, now);
  return { userId, productKey };
}
