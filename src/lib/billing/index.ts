import type Stripe from "stripe";
import type { Database } from "@/db/types";
import { handleCheckoutCompleted } from "./checkout";
import { applySubscriptionState } from "./subscription-state";
import type { BillingDeps, HandlerResult } from "./types";

export async function handleStripeEvent(
  tx: Database,
  event: Stripe.Event,
  deps: BillingDeps,
): Promise<HandlerResult> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(tx, event.data.object, deps);

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Re-fetch so a late, out-of-order event can't overwrite newer state (D3).
      const sub = await deps.retrieveSubscription(event.data.object.id);
      await applySubscriptionState(tx, sub, deps);
      return "applied";
    }

    default:
      return "ignored";
  }
}
