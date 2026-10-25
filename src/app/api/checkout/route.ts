import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { getProgrammeAccess } from "@/lib/access";
import { PRODUCT_KEYS, PRODUCTS } from "@/lib/catalogue";
import { getOrCreateStripeCustomer } from "@/lib/customers";
import { env } from "@/lib/env";
import { getStripe, priceIdFor } from "@/lib/stripe";
import { getOrCreateUser } from "@/lib/users";

export const runtime = "nodejs";

const body = z.object({ productKey: z.enum(PRODUCT_KEYS) });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Please sign in first." }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown plan." }, { status: 400 });
  const { productKey } = parsed.data;
  const product = PRODUCTS[productKey];

  const user = await getOrCreateUser(db);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });

  // Block double purchases.
  const access = await getProgrammeAccess(db, user.id);
  const hasLifetime = Object.values(access).some((a) => a.sources.includes("lifetime"));
  const alreadySubscribed =
    product.mode === "subscription" &&
    product.programmes.every((slug) => access[slug].sources.includes("subscription"));
  if (hasLifetime || alreadySubscribed) {
    return Response.json(
      { error: hasLifetime ? "You already have lifetime access." : "You're already subscribed to this programme." },
      { status: 409 },
    );
  }

  const customer = await getOrCreateStripeCustomer(db, user);
  const metadata = { userId: user.id, productKey };

  const session = await getStripe().checkout.sessions.create({
    mode: product.mode,
    customer,
    line_items: [{ price: priceIdFor(productKey), quantity: 1 }],
    client_reference_id: user.id,
    allow_promotion_codes: true,
    metadata,
    ...(product.mode === "subscription"
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata } }),
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing?canceled=1`,
  });

  return Response.json({ url: session.url });
}
