import type Stripe from "stripe";
import { db } from "@/db";
import { handleStripeEvent } from "@/lib/billing";
import { liveDeps } from "@/lib/billing/live";
import { scheduleDispatch } from "@/lib/dispatch-live";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { withIdempotency } from "@/lib/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  // Raw body: the signature is computed over the exact bytes Stripe sent.
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    const { duplicate } = await withIdempotency(
      db,
      { id: event.id, provider: "stripe", type: event.type },
      (tx) => handleStripeEvent(tx, event, liveDeps),
    );
    if (!duplicate) scheduleDispatch();
    return Response.json({ received: true, duplicate });
  } catch {
    // Log ids only (no payloads / personal data). 500 → Stripe retries.
    console.error(`stripe webhook failed: ${event.id} ${event.type}`);
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
}
