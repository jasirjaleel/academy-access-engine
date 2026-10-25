import "server-only";
import Stripe from "stripe";
import type { ProductKey } from "@/lib/catalogue";
import { env } from "@/lib/env";

let client: Stripe | undefined;

/** Lazily created so pages that don't touch billing work before Stripe keys are set. */
export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

const PRICE_ENV: Record<ProductKey, string | undefined> = {
  arabic_monthly: env.STRIPE_PRICE_ARABIC_MONTHLY,
  precision_monthly: env.STRIPE_PRICE_PRECISION_MONTHLY,
  lifetime: env.STRIPE_PRICE_LIFETIME,
};

export function priceIdFor(productKey: ProductKey): string {
  const id = PRICE_ENV[productKey];
  if (!id) throw new Error(`Stripe price for ${productKey} is not set`);
  return id;
}

export function productKeyFromPriceId(priceId: string): ProductKey | null {
  const match = Object.entries(PRICE_ENV).find(([, id]) => id === priceId);
  return match ? (match[0] as ProductKey) : null;
}
