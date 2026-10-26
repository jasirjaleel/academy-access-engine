// Creates the catalogue in Stripe TEST mode. Safe to run repeatedly (lookup_key based).
// Usage: npx tsx scripts/stripe-setup.ts
import { config } from "dotenv";
import Stripe from "stripe";
import { PRODUCT_KEYS, PRODUCTS, type ProductKey } from "../src/lib/catalogue";

config({ path: ".env.local", quiet: true });

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("Refusing to run: STRIPE_SECRET_KEY must be a test key (sk_test_...).");
  process.exit(1);
}
const stripe = new Stripe(key);

const ENV_NAME: Record<ProductKey, string> = {
  arabic_monthly: "STRIPE_PRICE_ARABIC_MONTHLY",
  precision_monthly: "STRIPE_PRICE_PRECISION_MONTHLY",
  lifetime: "STRIPE_PRICE_LIFETIME",
};

async function ensurePrice(productKey: ProductKey): Promise<string> {
  const existing = await stripe.prices.list({ lookup_keys: [productKey], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`reused  ${productKey}`);
    return existing.data[0].id;
  }
  const def = PRODUCTS[productKey];
  const product = await stripe.products.create({ name: def.name, metadata: { productKey } });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: def.amountCents,
    lookup_key: productKey,
    ...(def.mode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
  });
  console.log(`created ${productKey}`);
  return price.id;
}

async function ensureCoupon() {
  try {
    await stripe.coupons.retrieve("REGION40");
    console.log("reused  coupon REGION40");
  } catch {
    await stripe.coupons.create({ id: "REGION40", percent_off: 40, duration: "once", name: "Regional pricing" });
    console.log("created coupon REGION40");
  }
  const codes = await stripe.promotionCodes.list({ code: "REGION40", active: true, limit: 1 });
  if (codes.data[0]) {
    console.log("reused  promotion code REGION40");
  } else {
    await stripe.promotionCodes.create({ promotion: { type: "coupon", coupon: "REGION40" }, code: "REGION40" });
    console.log("created promotion code REGION40");
  }
}

// Billing Portal: card updates + invoices only. Cancelling goes through our own flow (M6).
async function ensurePortal() {
  const existing = await stripe.billingPortal.configurations.list({ is_default: true, active: true, limit: 1 });
  if (existing.data[0]) {
    console.log("reused  billing portal configuration");
    return;
  }
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Demo Academy: manage your payment method and invoices" },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "name"] },
      subscription_cancel: { enabled: false },
    },
  });
  console.log("created billing portal configuration");
}

async function main() {
  const lines: string[] = [];
  for (const productKey of PRODUCT_KEYS) {
    lines.push(`${ENV_NAME[productKey]}=${await ensurePrice(productKey)}`);
  }
  await ensureCoupon();
  await ensurePortal();
  console.log("\nAdd these to .env.local (and Vercel):\n" + lines.join("\n"));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
