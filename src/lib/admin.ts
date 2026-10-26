import { and, count, countDistinct, desc, eq, gt, gte, inArray, isNotNull, ne, or, sql, sum } from "drizzle-orm";
import { entitlements, invoices, outboundEvents, processedEvents, users } from "@/db/schema";
import type { Database } from "@/db/types";

const DAY_MS = 86_400_000;

export async function getAdminOverview(db: Database, now = new Date()) {
  const since30d = new Date(now.getTime() - 30 * DAY_MS);
  const since24h = new Date(now.getTime() - DAY_MS);

  const [[students], [grace], [atRisk], [recovered], outbox, [webhooks]] = await Promise.all([
    db
      .select({ n: countDistinct(entitlements.userId) })
      .from(entitlements)
      .where(
        and(
          inArray(entitlements.source, ["subscription", "lifetime"]),
          or(eq(entitlements.status, "active"), and(eq(entitlements.status, "grace"), gt(entitlements.graceUntil, now))),
        ),
      ),
    db
      .select({ n: countDistinct(entitlements.userId) })
      .from(entitlements)
      .where(and(eq(entitlements.status, "grace"), gt(entitlements.graceUntil, now))),
    db
      .select({ n: count(), cents: sum(invoices.amountDue) })
      .from(invoices)
      .where(and(isNotNull(invoices.firstFailedAt), ne(invoices.status, "paid"), ne(invoices.status, "void"))),
    db
      .select({ n: count(), cents: sum(invoices.amountDue) })
      .from(invoices)
      .where(and(isNotNull(invoices.firstFailedAt), eq(invoices.status, "paid"), gte(invoices.paidAt, since30d))),
    db.select({ status: outboundEvents.status, n: count() }).from(outboundEvents).groupBy(outboundEvents.status),
    db
      .select({
        total: count(),
        errors: sql<number>`count(*) filter (where ${processedEvents.result} = 'error')`.mapWith(Number),
      })
      .from(processedEvents)
      .where(gte(processedEvents.receivedAt, since24h)),
  ]);

  const outboxBy = Object.fromEntries(outbox.map((o) => [o.status, o.n])) as Partial<Record<"pending" | "sent" | "failed", number>>;
  return {
    activeStudents: students.n,
    studentsInGrace: grace.n,
    atRisk: { invoices: atRisk.n, cents: Number(atRisk.cents ?? 0) },
    recovered30d: { invoices: recovered.n, cents: Number(recovered.cents ?? 0) },
    outbox: { pending: outboxBy.pending ?? 0, sent: outboxBy.sent ?? 0, failed: outboxBy.failed ?? 0 },
    webhooks24h: { total: webhooks.total, errors: webhooks.errors },
  };
}

/** Invoices that failed at least once: open ones are at risk, paid ones were recovered. */
export function listFailedPayments(db: Database, limit = 50) {
  return db
    .select({
      id: invoices.id,
      email: users.email,
      amountDue: invoices.amountDue,
      currency: invoices.currency,
      status: invoices.status,
      attempts: invoices.attemptCount,
      firstFailedAt: invoices.firstFailedAt,
      paidAt: invoices.paidAt,
      subscriptionId: invoices.subscriptionId,
    })
    .from(invoices)
    .innerJoin(users, eq(users.id, invoices.userId))
    .where(isNotNull(invoices.firstFailedAt))
    .orderBy(desc(invoices.firstFailedAt))
    .limit(limit);
}

export function listWebhookEvents(db: Database, result?: string, limit = 100) {
  return db
    .select()
    .from(processedEvents)
    .where(result ? eq(processedEvents.result, result) : undefined)
    .orderBy(desc(processedEvents.receivedAt))
    .limit(limit);
}

export function listOutbox(db: Database, status?: "pending" | "sent" | "failed", limit = 100) {
  return db
    .select({
      id: outboundEvents.id,
      type: outboundEvents.type,
      email: users.email,
      status: outboundEvents.status,
      attempts: outboundEvents.attempts,
      lastError: outboundEvents.lastError,
      nextAttemptAt: outboundEvents.nextAttemptAt,
      createdAt: outboundEvents.createdAt,
      sentAt: outboundEvents.sentAt,
    })
    .from(outboundEvents)
    .innerJoin(users, eq(users.id, outboundEvents.userId))
    .where(status ? eq(outboundEvents.status, status) : undefined)
    .orderBy(desc(outboundEvents.createdAt))
    .limit(limit);
}

/**
 * Manual retry from the admin page: put failed (or waiting) events back in the queue now,
 * with a fresh attempt budget. Sent events are never re-sent (n8n would drop them anyway).
 */
export async function requeueOutboxEvents(db: Database, ids: string[] | "all-failed", now = new Date()) {
  const rows = await db
    .update(outboundEvents)
    .set({ status: "pending", attempts: 0, nextAttemptAt: now, lastError: null })
    .where(
      ids === "all-failed"
        ? eq(outboundEvents.status, "failed")
        : and(inArray(outboundEvents.id, ids), inArray(outboundEvents.status, ["failed", "pending"])),
    )
    .returning({ id: outboundEvents.id });
  return rows.length;
}

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
