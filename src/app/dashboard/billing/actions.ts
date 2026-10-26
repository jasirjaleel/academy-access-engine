"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cancellationFeedback, subscriptions } from "@/db/schema";
import { liveDeps } from "@/lib/billing/live";
import { applySubscriptionState } from "@/lib/billing/subscription-state";
import { CANCEL_REASONS, DISCOUNT_COUPON, offerFor, PAUSE_DAYS, type RetentionOffer } from "@/lib/cancellation";
import { scheduleDispatch } from "@/lib/dispatch-live";
import { getStripe } from "@/lib/stripe";

const reasonSchema = z.enum(Object.keys(CANCEL_REASONS) as [keyof typeof CANCEL_REASONS, ...(keyof typeof CANCEL_REASONS)[]]);
const input = z.object({
  subscriptionId: z.string().startsWith("sub_"),
  reason: reasonSchema,
  comment: z.string().trim().max(500).optional().default(""),
});

/** The subscription must belong to the signed-in student. */
async function ownedSubscription(subscriptionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)),
  });
  if (!sub) throw new Error("Subscription not found");
  return { userId, sub };
}

/** Mirror Stripe's answer right away (the webhook re-applies the same state later; it's idempotent). */
async function mirror(subscriptionId: string) {
  const fresh = await getStripe().subscriptions.retrieve(subscriptionId);
  await db.transaction((tx) => applySubscriptionState(tx, fresh, liveDeps));
  scheduleDispatch();
}

export async function getRetentionOffer(raw: { subscriptionId: string; reason: string }): Promise<RetentionOffer> {
  const { subscriptionId, reason } = input.pick({ subscriptionId: true, reason: true }).parse(raw);
  const { userId } = await ownedSubscription(subscriptionId);
  return offerFor(db, userId, subscriptionId, reason);
}

export async function finishCancellation(raw: {
  subscriptionId: string;
  reason: string;
  comment?: string;
  decision: "accept_offer" | "cancel";
}): Promise<{ message: string }> {
  const { subscriptionId, reason, comment } = input.parse(raw);
  const decision = z.enum(["accept_offer", "cancel"]).parse(raw.decision);
  const { userId } = await ownedSubscription(subscriptionId);

  // Recompute the offer on the server; never trust the client about which offer it saw.
  const offer = await offerFor(db, userId, subscriptionId, reason);
  const accepted = decision === "accept_offer" && offer !== null;
  const stripe = getStripe();
  let message: string;

  if (accepted && offer === "discount") {
    await stripe.subscriptions.update(subscriptionId, { discounts: [{ coupon: DISCOUNT_COUPON }] });
    message = "Done. Your next payment is 30% off, and nothing else changes.";
  } else if (accepted && offer === "pause") {
    const resumesAt = Math.floor(Date.now() / 1000) + PAUSE_DAYS * 86_400;
    await stripe.subscriptions.update(subscriptionId, { pause_collection: { behavior: "void", resumes_at: resumesAt } });
    message = `Billing is paused for ${PAUSE_DAYS} days. Your access and progress stay as they are.`;
  } else {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    message = "Your plan is cancelled. You keep access until the end of the period you've paid for.";
  }

  await db.insert(cancellationFeedback).values({
    userId,
    subscriptionId,
    reason,
    comment: comment || null,
    offerShown: offer,
    offerAccepted: accepted,
  });
  await mirror(subscriptionId);
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { message };
}

/** Undo a scheduled cancellation, or end a pause early. */
export async function keepSubscription(subscriptionId: string): Promise<{ message: string }> {
  await ownedSubscription(z.string().startsWith("sub_").parse(subscriptionId));
  await getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: false, pause_collection: "" });
  await mirror(subscriptionId);
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { message: "Your plan continues as normal." };
}
