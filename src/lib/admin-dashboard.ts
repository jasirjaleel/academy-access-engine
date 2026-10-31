import { desc, gte } from "drizzle-orm";
import {
  entitlements,
  invoices,
  lessonProgress,
  lessons,
  outboundEvents,
  processedEvents,
  subscriptions,
  users,
} from "@/db/schema";
import type { Database } from "@/db/types";
import { PRODUCTS, isProductKey } from "@/lib/catalogue";

const DAY = 86_400_000;
const LIFETIME_CENTS = PRODUCTS.lifetime.amountCents;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
/** % change, or null when there's no previous value to compare with (shown as "new"). */
const pctChange = (now: number, before: number): number | null =>
  before === 0 ? null : Math.round(((now - before) / before) * 100);

export type StudentStatus =
  "active" | "payment_failed" | "cancelling" | "no_plan";

/**
 * Everything the admin Overview and Students pages show, from a handful of queries (small data set).
 * `excludeUserIds`: staff accounts (admins) to leave out of every number and list,
 * so the console only describes students.
 */
export async function getAdminDashboard(
  db: Database,
  now = new Date(),
  { excludeUserIds = [] }: { excludeUserIds?: string[] } = {},
) {
  const since60 = new Date(now.getTime() - 60 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);

  const [
    userRows,
    entRows,
    invRows,
    progRows,
    subRows,
    lessonCount,
    outbox,
    hooks,
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(entitlements),
    db.select().from(invoices),
    db.select().from(lessonProgress),
    db.select().from(subscriptions),
    db.$count(lessons),
    db.select({ status: outboundEvents.status }).from(outboundEvents),
    db
      .select()
      .from(processedEvents)
      .where(gte(processedEvents.receivedAt, since60))
      .orderBy(desc(processedEvents.receivedAt)),
  ]);

  const excluded = new Set(excludeUserIds);
  const students = userRows.filter(
    (u) => !u.email.endsWith("@invalid") && !excluded.has(u.id),
  );
  const studentIds = new Set(students.map((u) => u.id));
  const isStudent = (r: { userId: string }) => studentIds.has(r.userId);
  entRows.splice(0, entRows.length, ...entRows.filter(isStudent));
  invRows.splice(0, invRows.length, ...invRows.filter(isStudent));
  progRows.splice(0, progRows.length, ...progRows.filter(isStudent));
  subRows.splice(0, subRows.length, ...subRows.filter(isStudent));
  const live = (e: (typeof entRows)[number], at: Date) =>
    e.createdAt <= at &&
    (e.status === "active" ||
      (e.status === "grace" && e.graceUntil !== null && e.graceUntil > at) ||
      (e.status === "revoked" && e.updatedAt > at));
  const paidSources = new Set(["subscription", "lifetime"]);
  const payingAt = (at: Date) =>
    new Set(
      entRows
        .filter((e) => paidSources.has(e.source) && live(e, at))
        .map((e) => e.userId),
    ).size;

  // Revenue events: paid invoices + one lifetime payment per payment intent.
  // Fully refunded lifetime payments are not revenue.
  const refunded = new Set(
    entRows
      .filter((e) => e.source === "lifetime" && e.revokedReason === "refunded")
      .map((e) => e.sourceRef),
  );
  const lifetimePayments = new Map<string, Date>();
  for (const e of entRows)
    if (
      e.source === "lifetime" &&
      !refunded.has(e.sourceRef) &&
      !lifetimePayments.has(e.sourceRef)
    )
      lifetimePayments.set(e.sourceRef, e.createdAt);
  const revenue: { at: Date; cents: number; kind: "monthly" | "lifetime" }[] = [
    ...invRows
      .filter((i) => i.status === "paid" && i.paidAt)
      .map((i) => ({
        at: i.paidAt!,
        cents: i.amountDue,
        kind: "monthly" as const,
      })),
    ...[...lifetimePayments.values()].map((at) => ({
      at,
      cents: LIFETIME_CENTS,
      kind: "lifetime" as const,
    })),
  ];
  const sumBetween = (from: Date, to: Date) =>
    revenue
      .filter((r) => r.at >= from && r.at < to)
      .reduce((n, r) => n + r.cents, 0);
  const countBetween = <T>(
    rows: T[],
    at: (r: T) => Date,
    from: Date,
    to: Date,
  ) => rows.filter((r) => at(r) >= from && at(r) < to).length;

  const dayRevenue = (key: string, kind?: "monthly" | "lifetime") =>
    revenue
      .filter((r) => dayKey(r.at) === key && (!kind || r.kind === kind))
      .reduce((n, r) => n + r.cents, 0);

  const dayLearners = (key: string) => [
    ...new Set(
      progRows.filter((p) => dayKey(p.updatedAt) === key).map((p) => p.userId),
    ),
  ];

  // MRR: what live monthly subscriptions bring in each month (lifetime purchases are not recurring).
  const subProduct = new Map(subRows.map((s) => [s.id, s.productKey]));
  const mrrAt = (at: Date) =>
    entRows
      .filter((e) => e.source === "subscription" && live(e, at))
      .reduce((n, e) => {
        const key = subProduct.get(e.sourceRef);
        return n + (key && isProductKey(key) ? PRODUCTS[key].amountCents : 0);
      }, 0);

  // 30-day daily series (oldest → newest)
  const series = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(now.getTime() - (29 - i) * DAY);
    const key = dayKey(day);
    return {
      date: key,
      revenue: dayRevenue(key) / 100,
      monthly: dayRevenue(key, "monthly") / 100,
      lifetime: dayRevenue(key, "lifetime") / 100,
      // MRR at that moment of the day (today: right now).
      mrr: mrrAt(day) / 100,
      signups: students.filter((u) => dayKey(u.createdAt) === key).length,
      learners: dayLearners(key).length,
      // Ids let the chart count UNIQUE learners over 7/15/30 days (a daily sum would double-count).
      learnerIds: dayLearners(key),
    };
  });

  // Students table
  const progressBy = new Map<string, { done: number; last: Date | null }>();
  for (const p of progRows) {
    const cur = progressBy.get(p.userId) ?? { done: 0, last: null };
    if (p.completedAt) cur.done++;
    if (!cur.last || p.updatedAt > cur.last) cur.last = p.updatedAt;
    progressBy.set(p.userId, cur);
  }
  const studentRows = students
    .map((u) => {
      const mine = entRows.filter(
        (e) => e.userId === u.id && paidSources.has(e.source) && live(e, now),
      );
      const subs = subRows.filter(
        (s) => s.userId === u.id && s.status !== "canceled",
      );
      const lifetime = mine.some((e) => e.source === "lifetime");
      const grace = mine.some((e) => e.status === "grace");
      const cancelling = subs.some((s) => s.cancelAtPeriodEnd);
      const status: StudentStatus = grace
        ? "payment_failed"
        : cancelling
          ? "cancelling"
          : mine.length
            ? "active"
            : "no_plan";
      const plan = lifetime
        ? "Lifetime"
        : subs.length
          ? subs
              .map((s) =>
                isProductKey(s.productKey)
                  ? PRODUCTS[s.productKey].name.replace(" (monthly)", "")
                  : s.productKey,
              )
              .join(" + ")
          : "No plan";
      const pr = progressBy.get(u.id);
      return {
        id: u.id,
        name: u.name ?? u.email.split("@")[0],
        email: u.email,
        joined: u.createdAt,
        plan,
        status,
        done: pr?.done ?? 0,
        total: lessonCount,
        lastActive: pr?.last ?? null,
      };
    })
    .sort((a, b) => b.done - a.done || b.joined.getTime() - a.joined.getTime());

  // Students who need a person to act, most urgent first.
  const nameOf = new Map(students.map((u) => [u.id, u.name ?? u.email.split("@")[0]]));
  const attention: { userId: string; name: string; kind: "payment_failed" | "cancelling" | "quiet"; detail: string; at: Date | null }[] = [];
  // One row per student: a failed payment outranks a pending cancellation, which outranks going quiet.
  const flagged = new Set<string>();
  for (const e of entRows)
    if (e.source === "subscription" && e.status === "grace" && e.graceUntil && e.graceUntil > now && !flagged.has(e.userId)) {
      flagged.add(e.userId);
      const inv = invRows.find((i) => i.subscriptionId === e.sourceRef && i.firstFailedAt && i.status !== "paid");
      attention.push({
        userId: e.userId,
        name: nameOf.get(e.userId) ?? "Student",
        kind: "payment_failed",
        detail: `${inv ? `$${(inv.amountDue / 100).toFixed(2)} renewal failed · ` : ""}access ends`,
        at: e.graceUntil,
      });
    }
  for (const s of subRows)
    if (s.cancelAtPeriodEnd && s.status !== "canceled" && !flagged.has(s.userId)) {
      flagged.add(s.userId);
      attention.push({ userId: s.userId, name: nameOf.get(s.userId) ?? "Student", kind: "cancelling", detail: "Cancels on", at: s.currentPeriodEnd });
    }
  for (const s of studentRows)
    if (s.status === "active" && !flagged.has(s.id)) {
      const idle = s.lastActive ? Math.floor((now.getTime() - s.lastActive.getTime()) / DAY) : null;
      if (idle === null || idle >= 7)
        attention.push({
          userId: s.id,
          name: s.name,
          kind: "quiet",
          detail: idle === null ? "Paying, no lessons started yet" : `Paying, no lessons for ${idle} days`,
          at: null,
        });
    }

  const mix = { lifetime: 0, monthly: 0, none: 0 };
  for (const s of studentRows) {
    if (s.plan === "Lifetime") mix.lifetime++;
    else if (s.status === "no_plan") mix.none++;
    else mix.monthly++;
  }

  const rev30 = sumBetween(since30, now);
  const revPrev = sumBetween(since60, since30);
  const signups30 = countBetween(students, (u) => u.createdAt, since30, now);
  const signupsPrev = countBetween(
    students,
    (u) => u.createdAt,
    since60,
    since30,
  );
  const paying = payingAt(now);
  const payingBefore = payingAt(since30);
  const atRisk = invRows.filter(
    (i) => i.firstFailedAt && i.status !== "paid" && i.status !== "void",
  );
  const recovered = invRows.filter(
    (i) =>
      i.firstFailedAt && i.status === "paid" && i.paidAt && i.paidAt >= since30,
  );
  const hooks24 = hooks.filter(
    (h) => h.receivedAt >= new Date(now.getTime() - DAY),
  );

  return {
    kpis: {
      payingStudents: {
        value: paying,
        change: pctChange(paying, payingBefore),
      },
      revenue30d: {
        cents: rev30,
        change: pctChange(rev30, revPrev),
        lifetimeCents: revenue
          .filter((r) => r.kind === "lifetime" && r.at >= since30 && r.at < now)
          .reduce((n, r) => n + r.cents, 0),
        monthlyCents: revenue
          .filter((r) => r.kind === "monthly" && r.at >= since30 && r.at < now)
          .reduce((n, r) => n + r.cents, 0),
      },
      mrr: {
        cents: mrrAt(now),
        change: pctChange(mrrAt(now), mrrAt(since30)),
        subscriptions: entRows.filter(
          (e) => e.source === "subscription" && live(e, now),
        ).length,
      },
      uniqueLearners30d: new Set(
        progRows.filter((p) => p.updatedAt >= since30).map((p) => p.userId),
      ).size,
      newStudents30d: {
        value: signups30,
        change: pctChange(signups30, signupsPrev),
      },
      atRisk: {
        cents: atRisk.reduce((n, i) => n + i.amountDue, 0),
        invoices: atRisk.length,
      },
      recovered30d: {
        cents: recovered.reduce((n, i) => n + i.amountDue, 0),
        invoices: recovered.length,
      },
    },
    series,
    attention,
    mix,
    students: studentRows,
    status: {
      lastWebhookAt: hooks[0]?.receivedAt ?? null,
      webhookErrors24h: hooks24.filter((h) => h.result === "error").length,
      webhooks24h: hooks24.length,
      outboxPending: outbox.filter((o) => o.status === "pending").length,
      outboxFailed: outbox.filter((o) => o.status === "failed").length,
      inGrace: studentRows.filter((s) => s.status === "payment_failed").length,
    },
  };
}

export type AdminDashboard = Awaited<ReturnType<typeof getAdminDashboard>>;
export const studentStatusLabel: Record<StudentStatus, string> = {
  active: "Active",
  payment_failed: "Payment failed",
  cancelling: "Cancelling",
  no_plan: "No plan",
};
