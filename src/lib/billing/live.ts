import "server-only";
import { getStripe, productKeyFromPriceId } from "@/lib/stripe";
import type { BillingDeps } from "./types";

export const liveDeps: BillingDeps = {
  retrieveSubscription: (id) => getStripe().subscriptions.retrieve(id),
  productKeyFromPriceId,
  now: () => new Date(),
};
