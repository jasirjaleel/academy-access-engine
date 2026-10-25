import type Stripe from "stripe";
import { lessons, programmes, users } from "@/db/schema";
import type { Database } from "@/db/types";
import type { BillingDeps } from "@/lib/billing/types";
import type { ProductKey } from "@/lib/catalogue";

export const NOW = new Date("2026-10-26T12:00:00Z");

export const PRICE: Record<ProductKey, string> = {
  arabic_monthly: "price_arabic",
  precision_monthly: "price_precision",
  lifetime: "price_lifetime",
};

/** 3 programmes with 2 lessons each (lesson 1 = preview), and one user. */
export async function seedBasics(db: Database, userId = "user_1") {
  const ids: Record<string, string> = {};
  for (const [i, slug] of ["arabic", "precision", "usool"].entries()) {
    const [p] = await db
      .insert(programmes)
      .values({ slug, titleEn: slug, titleAr: slug, description: slug, position: i + 1 })
      .returning();
    ids[slug] = p.id;
    for (const position of [1, 2]) {
      const [l] = await db
        .insert(lessons)
        .values({
          programmeId: p.id,
          titleEn: `${slug} ${position}`,
          titleAr: `${slug} ${position}`,
          videoUrl: "https://example.test/video.mp4",
          durationSec: 600,
          position,
          isPreview: position === 1,
        })
        .returning();
      ids[`${slug}:${position}`] = l.id;
    }
  }
  await db.insert(users).values({ id: userId, email: "student@example.test", stripeCustomerId: "cus_1" });
  return ids;
}

export function subscription(
  opts: Partial<{ id: string; status: Stripe.Subscription.Status; productKey: ProductKey; userId: string; cancelAtPeriodEnd: boolean }> = {},
): Stripe.Subscription {
  const productKey = opts.productKey ?? "arabic_monthly";
  return {
    id: opts.id ?? "sub_1",
    object: "subscription",
    status: opts.status ?? "active",
    customer: "cus_1",
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    metadata: { userId: opts.userId ?? "user_1", productKey },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          price: { id: PRICE[productKey] },
          current_period_end: Math.floor(NOW.getTime() / 1000) + 30 * 86400,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

export function stripeEvent<T extends Stripe.Event["type"]>(id: string, type: T, object: unknown): Stripe.Event {
  return { id, type, object: "event", data: { object } } as unknown as Stripe.Event;
}

export function checkoutSession(
  opts: Partial<{ mode: "subscription" | "payment"; paymentStatus: string; userId: string; productKey: ProductKey; subscriptionId: string }> = {},
): Stripe.Checkout.Session {
  const mode = opts.mode ?? "subscription";
  const productKey = opts.productKey ?? (mode === "payment" ? "lifetime" : "arabic_monthly");
  return {
    id: "cs_1",
    object: "checkout.session",
    mode,
    payment_status: opts.paymentStatus ?? "paid",
    client_reference_id: opts.userId ?? "user_1",
    subscription: mode === "subscription" ? (opts.subscriptionId ?? "sub_1") : null,
    payment_intent: mode === "payment" ? "pi_1" : null,
    metadata: { userId: opts.userId ?? "user_1", productKey },
  } as unknown as Stripe.Checkout.Session;
}

/** Fake Stripe: retrieveSubscription returns whatever is in the map right now. */
export function fakeDeps(subs: Record<string, Stripe.Subscription> = {}): BillingDeps {
  const byPrice = Object.fromEntries(Object.entries(PRICE).map(([k, v]) => [v, k as ProductKey]));
  return {
    retrieveSubscription: async (id) => {
      const s = subs[id];
      if (!s) throw new Error(`fake stripe: no subscription ${id}`);
      return s;
    },
    productKeyFromPriceId: (priceId) => byPrice[priceId] ?? null,
    now: () => NOW,
  };
}
