import type Stripe from "stripe";
import type { ProductKey } from "@/lib/catalogue";

export type { HandlerResult } from "@/lib/webhooks";

/** Everything a handler needs from the outside world. Tests pass fakes. */
export type BillingDeps = {
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>;
  productKeyFromPriceId: (priceId: string) => ProductKey | null;
  now: () => Date;
};
