import { and, eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { entitlements, invoices, subscriptions } from "@/db/schema";
import type { Database } from "@/db/types";
import { enqueueEvent } from "@/lib/events";
import { syncBundle } from "./bundle";
import { applySubscriptionState } from "./subscription-state";
import type { BillingDeps, HandlerResult } from "./types";

export const GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

/** Current API: invoice.parent.subscription_details.subscription; older payloads: invoice.subscription. */
export function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  const value = fromParent ?? legacy ?? null;
  return typeof value === "string" ? value : (value?.id ?? null);
}

/** Make sure the subscription is mirrored (invoice events can arrive before subscription events). */
async function ensureSubscription(tx: Database, subId: string, deps: BillingDeps) {
  const existing = await tx.query.subscriptions.findFirst({ where: eq(subscriptions.id, subId) });
  if (existing) return existing.userId;
  const { userId } = await applySubscriptionState(tx, await deps.retrieveSubscription(subId), deps);
  return userId;
}

/**
 * Renewal failed: keep access for GRACE_DAYS from the FIRST failure (Stripe retries don't extend it),
 * and queue one reminder per attempt (D4).
 */
export async function handleInvoicePaymentFailed(
  tx: Database,
  invoice: Stripe.Invoice,
  deps: BillingDeps,
): Promise<HandlerResult> {
  const subId = subscriptionIdOf(invoice);
  if (!subId || !invoice.id) return "ignored";

  const userId = await ensureSubscription(tx, subId, deps);
  const existing = await tx.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) });
  // A late failure event for an invoice that's already paid must not take access away.
  if (existing?.status === "paid") return "ignored";

  const now = deps.now();
  const firstFailedAt = existing?.firstFailedAt ?? now;
  const graceUntil = new Date(firstFailedAt.getTime() + GRACE_DAYS * DAY_MS);

  await tx
    .insert(invoices)
    .values({
      id: invoice.id,
      userId,
      subscriptionId: subId,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status ?? "open",
      firstFailedAt,
      attemptCount: invoice.attempt_count,
    })
    .onConflictDoUpdate({
      target: invoices.id,
      set: { status: invoice.status ?? "open", attemptCount: invoice.attempt_count, firstFailedAt },
    });

  // Only live access moves to grace; a revoked entitlement stays revoked.
  await tx
    .update(entitlements)
    .set({ status: "grace", graceUntil, updatedAt: sql`now()` })
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.source, "subscription"),
        eq(entitlements.sourceRef, subId),
        inArray(entitlements.status, ["active", "grace"]),
      ),
    );
  await syncBundle(tx, userId, now);

  await enqueueEvent(tx, {
    type: "payment.failed",
    userId,
    payload: {
      invoiceId: invoice.id,
      subscriptionId: subId,
      attempt: invoice.attempt_count,
      graceUntil: graceUntil.toISOString(),
    },
    dedupeKey: `payfail:${invoice.id}:${invoice.attempt_count}`,
  });
  return "applied";
}

/** Paid (first payment, renewal, or recovery after a failure). */
export async function handleInvoicePaid(
  tx: Database,
  invoice: Stripe.Invoice,
  deps: BillingDeps,
): Promise<HandlerResult> {
  const subId = subscriptionIdOf(invoice);
  if (!subId || !invoice.id) return "ignored";

  // Re-fetch (D3): once the invoice is paid the subscription is active again, which clears grace.
  const { userId } = await applySubscriptionState(tx, await deps.retrieveSubscription(subId), deps);

  const existing = await tx.query.invoices.findFirst({ where: eq(invoices.id, invoice.id) });
  const recovered = Boolean(existing?.firstFailedAt);
  const now = deps.now();

  await tx
    .insert(invoices)
    .values({
      id: invoice.id,
      userId,
      subscriptionId: subId,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      status: "paid",
      paidAt: now,
      attemptCount: invoice.attempt_count,
    })
    .onConflictDoUpdate({
      target: invoices.id,
      set: { status: "paid", paidAt: now, attemptCount: invoice.attempt_count },
    });

  if (recovered) {
    await enqueueEvent(tx, {
      type: "payment.recovered",
      userId,
      payload: { invoiceId: invoice.id, subscriptionId: subId },
      dedupeKey: `recovered:${invoice.id}`,
    });
  }
  return "applied";
}
