// Demo students for the admin dashboard and walkthrough video.
// Idempotent: removes and recreates every row owned by a `demo_` user. Test data only (no Stripe objects).
// Usage: npx tsx scripts/seed-demo.ts
import { config } from "dotenv";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/db/schema";

config({ path: ".env.local", quiet: true });

const DAY = 86_400_000;
const now = new Date();
const daysAgo = (d: number, hour = 10) => {
  const t = new Date(now.getTime() - d * DAY);
  t.setUTCHours(hour, 0, 0, 0);
  return t;
};
const daysAhead = (d: number) => new Date(now.getTime() + d * DAY);

const students = [
  { id: "demo_aisha", name: "Aisha Rahman", tz: "Asia/Dubai", joined: 28 },
  { id: "demo_yusuf", name: "Yusuf Ali", tz: "Europe/London", joined: 20 },
  {
    id: "demo_maryam",
    name: "Maryam Siddiqui",
    tz: "Asia/Karachi",
    joined: 35,
  },
  {
    id: "demo_ibrahim",
    name: "Ibrahim Khan",
    tz: "America/Toronto",
    joined: 15,
  },
  { id: "demo_fatima", name: "Fatima Noor", tz: "Africa/Nairobi", joined: 4 },
] as const;

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema: s });

  try {
    // Every demo row belongs to a user whose id starts with demo_ (story + background students).
    const ids = (
      await db
        .select({ id: s.users.id })
        .from(s.users)
        .where(like(s.users.id, "demo_%"))
    ).map((u) => u.id);
    // Clean up previous demo rows (children first).
    await db
      .delete(s.outboundEvents)
      .where(inArray(s.outboundEvents.userId, ids));
    await db
      .delete(s.cancellationFeedback)
      .where(inArray(s.cancellationFeedback.userId, ids));
    await db
      .delete(s.lessonProgress)
      .where(inArray(s.lessonProgress.userId, ids));
    await db.delete(s.invoices).where(inArray(s.invoices.userId, ids));
    await db.delete(s.entitlements).where(inArray(s.entitlements.userId, ids));
    await db
      .delete(s.subscriptions)
      .where(inArray(s.subscriptions.userId, ids));
    await db
      .delete(s.processedEvents)
      .where(like(s.processedEvents.id, "evt_demo_%"));
    await db.delete(s.users).where(inArray(s.users.id, ids));

    // Catalogue lookups
    const progs = Object.fromEntries(
      (await db.select().from(s.programmes)).map((p) => [p.slug, p.id]),
    );
    const lessonsBy = async (slug: string) =>
      db
        .select()
        .from(s.lessons)
        .where(eq(s.lessons.programmeId, progs[slug]))
        .orderBy(asc(s.lessons.position));
    const arabic = await lessonsBy("arabic");
    const precision = await lessonsBy("precision");

    // Story students whose data was moved onto a real Clerk login (scripts/link-demo-logins.ts) are left alone.
    const aishaLinked = await db.query.users.findFirst({
      where: inArray(s.users.email, [
        "aisha+clerk_test@demo.academy",
        "aisha@demo.academy",
      ]),
    });
    for (const st of students) {
      if (st.id === "demo_aisha" && aishaLinked) continue;
      await db.insert(s.users).values({
        id: st.id,
        email: `${st.id.replace("demo_", "")}@demo.academy.test`,
        name: st.name,
        timezone: st.tz,
        createdAt: daysAgo(st.joined, 9),
        updatedAt: daysAgo(st.joined, 9),
      });
    }

    const ent = (
      userId: string,
      slug: string,
      source: "subscription" | "lifetime" | "bundle",
      sourceRef: string,
      created: number,
      extra: Partial<typeof s.entitlements.$inferInsert> = {},
    ) =>
      db
        .insert(s.entitlements)
        .values({
          userId,
          programmeId: progs[slug],
          source,
          sourceRef,
          status: "active",
          createdAt: daysAgo(created),
          updatedAt: daysAgo(created),
          ...extra,
        });
    const sub = (
      id: string,
      userId: string,
      productKey: string,
      status: string,
      periodEnd: Date,
      cancel = false,
    ) =>
      db
        .insert(s.subscriptions)
        .values({
          id,
          userId,
          productKey,
          status,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: cancel,
        });
    const inv = (
      id: string,
      userId: string,
      subId: string,
      cents: number,
      extra: Partial<typeof s.invoices.$inferInsert>,
    ) =>
      db
        .insert(s.invoices)
        .values({
          id,
          userId,
          subscriptionId: subId,
          amountDue: cents,
          currency: "usd",
          status: "paid",
          attemptCount: 1,
          ...extra,
        });
    const done = (userId: string, lessonIds: string[], startDay: number) =>
      lessonIds.length
        ? db
            .insert(s.lessonProgress)
            .values(
              lessonIds.map((lessonId, i) => ({
                userId,
                lessonId,
                lastPositionSec: 600,
                completedAt: daysAgo(Math.max(0, startDay - i)),
                updatedAt: daysAgo(Math.max(0, startDay - i)),
              })),
            )
        : Promise.resolve();
    const event = (
      userId: string,
      type: string,
      dedupeKey: string,
      created: number,
      status: "sent" | "pending" | "failed" = "sent",
    ) =>
      db
        .insert(s.outboundEvents)
        .values({
          userId,
          type,
          payload: {},
          dedupeKey,
          status,
          attempts: status === "sent" ? 1 : 0,
          createdAt: daysAgo(created),
          sentAt: status === "sent" ? daysAgo(created) : null,
        });

    // 1. Aisha: lifetime, very active (10 lessons done)
    if (!aishaLinked) {
      await ent("demo_aisha", "arabic", "lifetime", "pi_demo_aisha", 27);
      await ent("demo_aisha", "precision", "lifetime", "pi_demo_aisha", 27);
      await ent("demo_aisha", "usool", "bundle", "bundle", 27);
      await done(
        "demo_aisha",
        [...arabic.map((l) => l.id), ...precision.slice(0, 4).map((l) => l.id)],
        10,
      );
      await event(
        "demo_aisha",
        "student.enrolled",
        "enrolled:demo_aisha:lifetime",
        27,
      );
    }

    // 2. Yusuf: Arabic monthly, active, 3 lessons
    await sub(
      "sub_demo_yusuf",
      "demo_yusuf",
      "arabic_monthly",
      "active",
      daysAhead(10),
    );
    await ent("demo_yusuf", "arabic", "subscription", "sub_demo_yusuf", 20);
    await ent("demo_yusuf", "usool", "bundle", "bundle", 20);
    await inv("in_demo_yusuf_1", "demo_yusuf", "sub_demo_yusuf", 3000, {
      paidAt: daysAgo(20),
    });
    await done(
      "demo_yusuf",
      arabic.slice(0, 3).map((l) => l.id),
      4,
    );
    await event(
      "demo_yusuf",
      "student.enrolled",
      "enrolled:demo_yusuf:arabic_monthly",
      20,
    );

    // 3. Maryam: Precision monthly, renewal failed 3 days ago -> grace until +4 days
    await sub(
      "sub_demo_maryam",
      "demo_maryam",
      "precision_monthly",
      "past_due",
      daysAhead(27),
    );
    await ent(
      "demo_maryam",
      "precision",
      "subscription",
      "sub_demo_maryam",
      34,
      { status: "grace", graceUntil: daysAhead(4) },
    );
    await ent("demo_maryam", "usool", "bundle", "bundle", 34);
    await inv("in_demo_maryam_1", "demo_maryam", "sub_demo_maryam", 1500, {
      paidAt: daysAgo(34),
    });
    await inv("in_demo_maryam_2", "demo_maryam", "sub_demo_maryam", 1500, {
      status: "open",
      firstFailedAt: daysAgo(3),
      attemptCount: 2,
    });
    await done(
      "demo_maryam",
      precision.slice(0, 2).map((l) => l.id),
      30,
    );
    await db
      .insert(s.lessonProgress)
      .values({
        userId: "demo_maryam",
        lessonId: precision[2].id,
        lastPositionSec: 240,
        updatedAt: daysAgo(5),
      });
    await event(
      "demo_maryam",
      "payment.failed",
      "payfail:in_demo_maryam_2:1",
      3,
    );
    await event(
      "demo_maryam",
      "payment.failed",
      "payfail:in_demo_maryam_2:2",
      1,
    );

    // 4. Ibrahim: Arabic monthly, cancelled ("too expensive", declined the 30% offer), ends in 15 days
    await sub(
      "sub_demo_ibrahim",
      "demo_ibrahim",
      "arabic_monthly",
      "active",
      daysAhead(15),
      true,
    );
    await ent("demo_ibrahim", "arabic", "subscription", "sub_demo_ibrahim", 15);
    await ent("demo_ibrahim", "usool", "bundle", "bundle", 15);
    await inv("in_demo_ibrahim_1", "demo_ibrahim", "sub_demo_ibrahim", 3000, {
      paidAt: daysAgo(15),
    });
    await done(
      "demo_ibrahim",
      arabic.slice(0, 1).map((l) => l.id),
      12,
    );
    await db.insert(s.cancellationFeedback).values({
      userId: "demo_ibrahim",
      subscriptionId: "sub_demo_ibrahim",
      reason: "too_expensive",
      comment: "Will come back after Ramadan.",
      offerShown: "discount",
      offerAccepted: false,
      createdAt: daysAgo(6),
    });
    await event(
      "demo_ibrahim",
      "subscription.cancel_scheduled",
      "cancelsched:sub_demo_ibrahim",
      6,
    );

    // 5. Fatima: joined 4 days ago, Precision monthly, hasn't opened a lesson -> nudge queued
    await sub(
      "sub_demo_fatima",
      "demo_fatima",
      "precision_monthly",
      "active",
      daysAhead(26),
    );
    await ent("demo_fatima", "precision", "subscription", "sub_demo_fatima", 4);
    await ent("demo_fatima", "usool", "bundle", "bundle", 4);
    await inv("in_demo_fatima_1", "demo_fatima", "sub_demo_fatima", 1500, {
      paidAt: daysAgo(4),
    });
    await event(
      "demo_fatima",
      "student.enrolled",
      "enrolled:demo_fatima:precision_monthly",
      4,
    );
    await event(
      "demo_fatima",
      "student.inactive_3d",
      "inactive3d:demo_fatima",
      0,
      "pending",
    );

    // Background students: quieter accounts that give the charts a realistic 60-day history.
    let seed = 42;
    const rand = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
    const names = [
      "Omar Farooq",
      "Zainab Hussain",
      "Bilal Ahmed",
      "Khadija Malik",
      "Hamza Qureshi",
      "Safiya Begum",
      "Idris Okafor",
      "Amina Yusuf",
      "Tariq Mansour",
      "Hafsa Rahim",
      "Usman Sheikh",
      "Layla Haddad",
      "Anas Karim",
      "Ruqayyah Bello",
      "Salman Javed",
    ];
    const tzs = [
      "Asia/Dubai",
      "Europe/London",
      "Asia/Kolkata",
      "Africa/Lagos",
      "America/New_York",
      "Asia/Riyadh",
    ] as const;
    for (const [i, name] of names.entries()) {
      const id = `demo_bg_${i + 1}`;
      const joined = 3 + Math.floor(rand() * 55); // joined 3-58 days ago
      await db.insert(s.users).values({
        id,
        email: `${name.split(" ")[0].toLowerCase()}.${i + 1}@demo.academy.test`,
        name,
        timezone: pick(tzs),
        createdAt: daysAgo(joined, 8 + Math.floor(rand() * 10)),
        updatedAt: daysAgo(joined),
      });
      const roll = rand();
      if (roll < 0.15) {
        // lifetime
        const ref = `pi_demo_bg_${i + 1}`;
        await ent(id, "arabic", "lifetime", ref, joined);
        await ent(id, "precision", "lifetime", ref, joined);
        await ent(id, "usool", "bundle", "bundle", joined);
      } else if (roll < 0.85) {
        // monthly: first payment at join, then a renewal every 30 days
        const product =
          rand() < 0.6
            ? ("arabic_monthly" as const)
            : ("precision_monthly" as const);
        const slug = product === "arabic_monthly" ? "arabic" : "precision";
        const cents = product === "arabic_monthly" ? 3000 : 1500;
        const subId = `sub_demo_bg_${i + 1}`;
        const nextRenewal = 30 - (joined % 30);
        await sub(subId, id, product, "active", daysAhead(nextRenewal));
        await ent(id, slug, "subscription", subId, joined);
        await ent(id, "usool", "bundle", "bundle", joined);
        for (let d = joined, n = 1; d >= 0; d -= 30, n++) {
          await inv(`in_demo_bg_${i + 1}_${n}`, id, subId, cents, {
            paidAt: daysAgo(d, 9 + Math.floor(rand() * 8)),
          });
        }
      } // else: signed up, no plan yet
      // Lesson activity spread over the last few weeks for paying students.
      if (roll < 0.85) {
        const pool =
          roll < 0.15
            ? [...arabic, ...precision]
            : roll < 0.5
              ? arabic
              : precision;
        const count = Math.min(pool.length, 1 + Math.floor(rand() * 5));
        const start = Math.min(joined, 1 + Math.floor(rand() * 20));
        await done(
          id,
          pool.slice(0, count).map((l) => l.id),
          start,
        );
      }
    }

    // A few processed webhooks so the 24h log and system status have content
    await db.insert(s.processedEvents).values([
      {
        id: "evt_demo_1",
        provider: "stripe",
        type: "invoice.payment_failed",
        result: "applied",
        receivedAt: daysAgo(1, 7),
      },
      {
        id: "evt_demo_2",
        provider: "stripe",
        type: "customer.subscription.updated",
        result: "applied",
        receivedAt: daysAgo(0, 6),
      },
    ]);

    const [{ n }] =
      await client`select count(*)::int n from users where id like 'demo_%'`;
    console.log(`demo students: ${n}`);
    const check = await db
      .select({ u: s.entitlements.userId, st: s.entitlements.status })
      .from(s.entitlements)
      .where(
        and(
          like(s.entitlements.userId, "demo_%"),
          eq(s.entitlements.status, "grace"),
        ),
      );
    console.log(`in grace: ${check.map((c) => c.u).join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
