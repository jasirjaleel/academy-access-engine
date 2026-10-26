import { and, eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { entitlements } from "@/db/schema";
import type { Database } from "@/db/types";
import { enqueueEvent } from "@/lib/events";
import { syncBundle } from "./bundle";
import type { BillingDeps, HandlerResult } from "./types";

/**
 * A FULL refund of a one-time (lifetime) payment revokes the access it bought (D14).
 * Partial refunds are goodwill and change nothing. Subscription refunds are handled by
 * cancelling the subscription in Stripe, which arrives as customer.subscription.deleted.
 */
export async function handleChargeRefunded(
  tx: Database,
  charge: Stripe.Charge,
  deps: BillingDeps,
): Promise<HandlerResult> {
  const fullyRefunded = charge.refunded && charge.amount_refunded >= charge.amount;
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!fullyRefunded || !paymentIntentId) return "ignored";

  const revoked = await tx
    .update(entitlements)
    .set({ status: "revoked", revokedReason: "refunded", graceUntil: null, updatedAt: sql`now()` })
    .where(
      and(
        eq(entitlements.source, "lifetime"),
        eq(entitlements.sourceRef, paymentIntentId),
        inArray(entitlements.status, ["active", "grace"]),
      ),
    )
    .returning({ userId: entitlements.userId });
  if (revoked.length === 0) return "ignored";

  const userId = revoked[0].userId;
  await syncBundle(tx, userId, deps.now());
  await enqueueEvent(tx, {
    type: "access.revoked",
    userId,
    payload: { reason: "refunded", paymentIntentId },
    dedupeKey: `refund:${paymentIntentId}`,
  });
  return "applied";
}
