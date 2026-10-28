import { beforeEach, describe, expect, it } from "vitest";
import { entitlements, invoices, lessonProgress, subscriptions, users } from "@/db/schema";
import type { Database } from "@/db/types";
import { getAdminDashboard } from "@/lib/admin-dashboard";
import { createTestDb } from "./helpers/db";
import { NOW, seedBasics } from "./helpers/fixtures";

const DAY = 86_400_000;
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);

describe("getAdminDashboard", () => {
  let db: Database;
  let ids: Record<string, string>;
  beforeEach(async () => {
    db = await createTestDb();
    ids = await seedBasics(db); // user_1, no plan
    await db.insert(users).values([
      { id: "u_life", email: "life@x.test", name: "Life Student", createdAt: ago(10) },
      { id: "u_sub", email: "sub@x.test", name: "Sub Student", createdAt: ago(40) },
      { id: "u_grace", email: "grace@x.test", name: "Grace Student", createdAt: ago(5) },
    ]);
    await db.insert(subscriptions).values([
      { id: "sub_a", userId: "u_sub", productKey: "arabic_monthly", status: "active", cancelAtPeriodEnd: true },
      { id: "sub_g", userId: "u_grace", productKey: "precision_monthly", status: "past_due" },
    ]);
    await db.insert(entitlements).values([
      { userId: "u_life", programmeId: ids.arabic, source: "lifetime", sourceRef: "pi_1", status: "active", createdAt: ago(10) },
      { userId: "u_life", programmeId: ids.precision, source: "lifetime", sourceRef: "pi_1", status: "active", createdAt: ago(10) },
      { userId: "u_sub", programmeId: ids.arabic, source: "subscription", sourceRef: "sub_a", status: "active", createdAt: ago(40) },
      { userId: "u_grace", programmeId: ids.precision, source: "subscription", sourceRef: "sub_g", status: "grace", graceUntil: new Date(NOW.getTime() + 2 * DAY), createdAt: ago(5) },
    ]);
    await db.insert(invoices).values([
      { id: "in_old", userId: "u_sub", subscriptionId: "sub_a", amountDue: 3000, currency: "usd", status: "paid", paidAt: ago(40) },
      { id: "in_new", userId: "u_sub", subscriptionId: "sub_a", amountDue: 3000, currency: "usd", status: "paid", paidAt: ago(9) },
      { id: "in_fail", userId: "u_grace", subscriptionId: "sub_g", amountDue: 1500, currency: "usd", status: "open", firstFailedAt: ago(1) },
    ]);
    await db.insert(lessonProgress).values({ userId: "u_life", lessonId: ids["arabic:1"], lastPositionSec: 600, completedAt: ago(2), updatedAt: ago(2) });
  });

  it("computes KPIs with changes vs the previous 30 days", async () => {
    const d = await getAdminDashboard(db, NOW);
    expect(d.kpis.payingStudents.value).toBe(3); // lifetime, subscription, grace
    expect(d.kpis.revenue30d.cents).toBe(99900 + 3000); // lifetime + one renewal in window
    expect(d.kpis.revenue30d.change).toBe(Math.round(((102900 - 3000) / 3000) * 100));
    expect(d.kpis.atRisk).toEqual({ cents: 1500, invoices: 1 });
  });

  it("builds a 30-day series, plan mix and student statuses", async () => {
    const d = await getAdminDashboard(db, NOW);
    expect(d.series).toHaveLength(30);
    expect(d.series.reduce((n, p) => n + p.revenue, 0)).toBe(1029);
    expect(d.mix).toEqual({ lifetime: 1, monthly: 2, none: 1 });
    const byId = Object.fromEntries(d.students.map((s) => [s.id, s]));
    expect(byId.u_life).toMatchObject({ plan: "Lifetime", status: "active", done: 1 });
    expect(byId.u_sub.status).toBe("cancelling");
    expect(byId.u_grace.status).toBe("payment_failed");
    expect(byId.user_1.status).toBe("no_plan");
    expect(d.students[0].id).toBe("u_life"); // most active first
  });

  it("does not count a fully refunded lifetime payment as revenue", async () => {
    await db.insert(users).values({ id: "u_ref", email: "ref@x.test", createdAt: ago(3) });
    await db.insert(entitlements).values({
      userId: "u_ref", programmeId: ids.arabic, source: "lifetime", sourceRef: "pi_refunded", status: "revoked", revokedReason: "refunded", createdAt: ago(3),
    });
    const d = await getAdminDashboard(db, NOW);
    expect(d.kpis.revenue30d.cents).toBe(99900 + 3000);
  });


  it("computes MRR from live subscriptions and counts unique learners", async () => {
    const d = await getAdminDashboard(db, NOW);
    // u_sub Arabic $30 (cancelling, still live) + u_grace Precision $15 (in grace) ; lifetime not recurring
    expect(d.kpis.mrr.cents).toBe(4500);
    expect(d.kpis.mrr.subscriptions).toBe(2);
    expect(d.kpis.revenue30d.lifetimeCents).toBe(99900);
    expect(d.kpis.revenue30d.monthlyCents).toBe(3000);
    expect(d.kpis.uniqueLearners30d).toBe(1);
    expect(new Set(d.series.flatMap((p) => p.learnerIds)).size).toBe(1);
  });
});

