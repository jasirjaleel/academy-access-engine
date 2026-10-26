import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { entitlements, invoices, outboundEvents, processedEvents, subscriptions } from "@/db/schema";
import type { Database } from "@/db/types";
import { formatMoney, getAdminOverview, listFailedPayments, requeueOutboxEvents } from "@/lib/admin";
import { createTestDb } from "./helpers/db";
import { NOW, seedBasics } from "./helpers/fixtures";

const DAY = 86_400_000;

describe("admin overview", () => {
  let db: Database;
  let ids: Record<string, string>;
  beforeEach(async () => {
    db = await createTestDb();
    ids = await seedBasics(db);
    await db.insert(subscriptions).values({ id: "sub_1", userId: "user_1", productKey: "arabic_monthly", status: "past_due" });
  });

  it("counts grace students, revenue at risk and recovered revenue (30 days only)", async () => {
    await db.insert(entitlements).values([
      { userId: "user_1", programmeId: ids.arabic, source: "subscription", sourceRef: "sub_1", status: "grace", graceUntil: new Date(NOW.getTime() + 3 * DAY) },
      { userId: "user_1", programmeId: ids.usool, source: "bundle", sourceRef: "bundle", status: "active" },
    ]);
    await db.insert(invoices).values([
      { id: "in_open", userId: "user_1", subscriptionId: "sub_1", amountDue: 3000, currency: "usd", status: "open", firstFailedAt: NOW },
      { id: "in_recovered", userId: "user_1", subscriptionId: "sub_1", amountDue: 1500, currency: "usd", status: "paid", firstFailedAt: new Date(NOW.getTime() - 5 * DAY), paidAt: new Date(NOW.getTime() - 4 * DAY) },
      { id: "in_old", userId: "user_1", subscriptionId: "sub_1", amountDue: 9999, currency: "usd", status: "paid", firstFailedAt: new Date(NOW.getTime() - 60 * DAY), paidAt: new Date(NOW.getTime() - 59 * DAY) },
      { id: "in_normal", userId: "user_1", subscriptionId: "sub_1", amountDue: 3000, currency: "usd", status: "paid", paidAt: NOW },
    ]);

    const o = await getAdminOverview(db, NOW);
    expect(o.activeStudents).toBe(1); // grace still counts as paying; the bundle alone doesn't
    expect(o.studentsInGrace).toBe(1);
    expect(o.atRisk).toEqual({ invoices: 1, cents: 3000 });
    expect(o.recovered30d).toEqual({ invoices: 1, cents: 1500 });
    expect((await listFailedPayments(db)).map((r) => r.id)).toEqual(["in_open", "in_recovered", "in_old"]);
  });

  it("summarises outbox and webhook health", async () => {
    await db.insert(outboundEvents).values([
      { type: "payment.failed", userId: "user_1", payload: {}, dedupeKey: "a", status: "sent" },
      { type: "payment.failed", userId: "user_1", payload: {}, dedupeKey: "b", status: "failed" },
      { type: "payment.failed", userId: "user_1", payload: {}, dedupeKey: "c", status: "pending" },
    ]);
    await db.insert(processedEvents).values([
      { id: "evt_1", provider: "stripe", type: "x", result: "applied", receivedAt: NOW },
      { id: "evt_2", provider: "stripe", type: "x", result: "error", error: "boom", receivedAt: NOW },
      { id: "evt_old", provider: "stripe", type: "x", result: "error", receivedAt: new Date(NOW.getTime() - 2 * DAY) },
    ]);
    const o = await getAdminOverview(db, NOW);
    expect(o.outbox).toEqual({ pending: 1, sent: 1, failed: 1 });
    expect(o.webhooks24h).toEqual({ total: 2, errors: 1 });
  });
});

describe("requeueOutboxEvents", () => {
  let db: Database;
  beforeEach(async () => {
    db = await createTestDb();
    await seedBasics(db);
    await db.insert(outboundEvents).values([
      { type: "payment.failed", userId: "user_1", payload: {}, dedupeKey: "failed-1", status: "failed", attempts: 5, lastError: "HTTP 500" },
      { type: "payment.failed", userId: "user_1", payload: {}, dedupeKey: "failed-2", status: "failed", attempts: 5 },
      { type: "payment.failed", userId: "user_1", payload: {}, dedupeKey: "sent-1", status: "sent", attempts: 1 },
    ]);
  });
  const byKey = (k: string) => db.query.outboundEvents.findFirst({ where: eq(outboundEvents.dedupeKey, k) });

  it("re-queues one failed event with a fresh attempt budget", async () => {
    const row = await byKey("failed-1");
    expect(await requeueOutboxEvents(db, [row!.id], NOW)).toBe(1);
    expect(await byKey("failed-1")).toMatchObject({ status: "pending", attempts: 0, lastError: null });
    expect((await byKey("failed-2"))?.status).toBe("failed");
  });

  it("re-queues all failed, never re-sends a sent event", async () => {
    expect(await requeueOutboxEvents(db, "all-failed", NOW)).toBe(2);
    const sent = await byKey("sent-1");
    expect(await requeueOutboxEvents(db, [sent!.id], NOW)).toBe(0);
    expect((await byKey("sent-1"))?.status).toBe("sent");
  });
});

it("formats money", () => {
  expect(formatMoney(3000)).toBe("$30.00");
  expect(formatMoney(99900, "usd")).toBe("$999.00");
});
