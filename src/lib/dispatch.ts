import { createHmac } from "node:crypto";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { outboundEvents, users, type OutboundEvent } from "@/db/schema";
import type { Database } from "@/db/types";

/** Retry delays after attempt 1, 2, 3, 4. The 5th failure marks the event failed. */
export const BACKOFF_MINUTES = [5, 30, 120, 720];
export const MAX_ATTEMPTS = 5;
const LEASE_MINUTES = 2;

export type DispatchConfig = {
  webhookUrl: string;
  signingSecret: string;
  appUrl: string;
  fetch?: typeof fetch;
  now?: () => Date;
};

/** HMAC over "<timestamp>.<raw body>" so n8n can verify origin, integrity and freshness. */
export function signBody(secret: string, timestamp: number, body: string) {
  return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/**
 * Claim due events with a short lease (FOR UPDATE SKIP LOCKED), so two dispatchers
 * running at once (after() + cron) never send the same row in parallel.
 */
async function claimDue(db: Database, now: Date, limit: number): Promise<OutboundEvent[]> {
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: outboundEvents.id })
      .from(outboundEvents)
      .where(and(eq(outboundEvents.status, "pending"), lte(outboundEvents.nextAttemptAt, now)))
      .orderBy(asc(outboundEvents.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    return tx
      .update(outboundEvents)
      .set({ nextAttemptAt: new Date(now.getTime() + LEASE_MINUTES * 60_000) })
      .where(inArray(outboundEvents.id, due.map((d) => d.id)))
      .returning();
  });
}

/**
 * Sends due outbox events to n8n. Delivery is at-least-once; n8n de-duplicates on dedupeKey.
 * Personal data is looked up at send time and never stored in the outbox (D5).
 */
export async function dispatchPending(db: Database, config: DispatchConfig, limit = 25) {
  const now = config.now?.() ?? new Date();
  const doFetch = config.fetch ?? fetch;
  const events = await claimDue(db, now, limit);
  const result = { sent: 0, retried: 0, failed: 0 };

  for (const event of events) {
    const user = await db.query.users.findFirst({ where: eq(users.id, event.userId) });
    if (!user || user.email.endsWith("@invalid")) {
      await db
        .update(outboundEvents)
        .set({ status: "failed", lastError: "recipient deleted" })
        .where(eq(outboundEvents.id, event.id));
      result.failed++;
      continue;
    }

    const body = JSON.stringify({
      id: event.id,
      type: event.type,
      dedupeKey: event.dedupeKey,
      occurredAt: event.createdAt.toISOString(),
      payload: event.payload,
      student: {
        userId: user.id,
        email: user.email,
        name: user.name,
        firstName: user.name?.split(" ")[0] ?? null,
        timezone: user.timezone,
        whatsapp: user.whatsappOptIn ? user.whatsappPhone : null,
      },
      links: {
        dashboard: `${config.appUrl}/dashboard`,
        billing: `${config.appUrl}/dashboard/billing`,
        pricing: `${config.appUrl}/pricing`,
      },
    });
    const timestamp = Math.floor(now.getTime() / 1000);

    let error: string | null = null;
    try {
      const res = await doFetch(config.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-academy-event-id": event.id,
          "x-academy-timestamp": String(timestamp),
          "x-academy-signature": signBody(config.signingSecret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    if (!error) {
      await db
        .update(outboundEvents)
        .set({ status: "sent", sentAt: now, attempts: sql`${outboundEvents.attempts} + 1`, lastError: null })
        .where(eq(outboundEvents.id, event.id));
      result.sent++;
      continue;
    }

    const attempts = event.attempts + 1;
    const giveUp = attempts >= MAX_ATTEMPTS;
    await db
      .update(outboundEvents)
      .set({
        attempts,
        status: giveUp ? "failed" : "pending",
        lastError: error.slice(0, 300),
        nextAttemptAt: giveUp ? now : new Date(now.getTime() + BACKOFF_MINUTES[attempts - 1] * 60_000),
      })
      .where(eq(outboundEvents.id, event.id));
    if (giveUp) result.failed++;
    else result.retried++;
  }
  return result;
}
