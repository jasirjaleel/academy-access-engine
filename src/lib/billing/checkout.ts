import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { users } from "@/db/schema";
import type { Database } from "@/db/types";
import { PRODUCTS } from "@/lib/catalogue";
import { enqueueEvent } from "@/lib/events";
import { syncBundle } from "./bundle";
import { grantEntitlement } from "./entitlements";
import { applySubscriptionState } from "./subscription-state";
import type { BillingDeps, HandlerResult } from "./types";

const idOf = (v: string | { id: string } | null) => (typeof v === "string" ? v : (v?.id ?? null));

export async function handleCheckoutCompleted(
  tx: Database,
  session: Stripe.Checkout.Session,
  deps: BillingDeps,
): Promise<HandlerResult> {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return "ignored";
  }

  const userId = session.client_reference_id;
  if (!userId) throw new Error(`Checkout ${session.id} has no client_reference_id`);
  const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error(`Checkout ${session.id}: unknown user`);

  let productKey: string;

  if (session.mode === "subscription") {
    const subId = idOf(session.subscription);
    if (!subId) throw new Error(`Checkout ${session.id} has no subscription`);
    // Re-fetch: never trust the payload's copy of the subscription (D3).
    const sub = await deps.retrieveSubscription(subId);
    ({ productKey } = await applySubscriptionState(tx, sub, deps));
  } else if (session.mode === "payment") {
    // Lifetime is the only one-time product; verify instead of trusting metadata blindly.
    if (session.metadata?.productKey !== "lifetime") {
      throw new Error(`Checkout ${session.id}: unexpected one-time product`);
    }
    const paymentIntentId = idOf(session.payment_intent);
    if (!paymentIntentId) throw new Error(`Checkout ${session.id} has no payment_intent`);
    productKey = "lifetime";
    for (const slug of PRODUCTS.lifetime.programmes) {
      await grantEntitlement(tx, { userId, slug, source: "lifetime", sourceRef: paymentIntentId });
    }
    await syncBundle(tx, userId, deps.now());
  } else {
    return "ignored";
  }

  await enqueueEvent(tx, {
    type: "student.enrolled",
    userId,
    payload: { productKey },
    dedupeKey: `enrolled:${userId}:${productKey}`,
  });
  return "applied";
}
