// Demo academy: 20 students with REAL Stripe test-mode history, made with test clocks.
//
//  1. Reset: delete demo test clocks (Stripe), demo auth users (Supabase) and demo rows (our DB).
//  2. Create auth users (+ our users rows) on @demo.academy.test, a domain that can never receive mail.
//  3. Per student, a Stripe test clock that starts on their join date: customer, card, subscription
//     or lifetime payment, then the clock is advanced to now so Stripe itself bills the renewals,
//     fails Maryam's card, recovers one payment, schedules a cancellation, refunds one lifetime buyer.
//  4. The script reads the resulting events back from Stripe and runs each one through the same
//     handler and idempotency guard as /api/webhooks/stripe, so it never depends on delivery timing;
//     the webhook's own copies are skipped as duplicates. Then it copies Stripe's timestamps onto the
//     rows (handlers stamp the moment they ran, which for a simulated history is "today").
//  5. Lesson progress, cancellation feedback and the inactivity nudge are app data, inserted directly.
//
// Test mode only. Needs STRIPE_*, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and
// DEMO_LOGIN_PASSWORD (the password for aisha@ and admin@demo.academy.test) in .env.local.
// Usage: npx tsx scripts/seed-demo.ts
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { and, asc, eq, inArray, isNotNull, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import Stripe from "stripe";
import * as s from "../src/db/schema";
import { handleStripeEvent } from "../src/lib/billing";
import { handleCheckoutCompleted } from "../src/lib/billing/checkout";
import type { BillingDeps } from "../src/lib/billing/types";
import type { ProductKey } from "../src/lib/catalogue";
import { withIdempotency } from "../src/lib/webhooks";

config({ path: ".env.local", quiet: true });

const DOMAIN = "demo.academy.test";
const DAY = 86_400_000;
const GRACE_DAYS = 7;
const now = Date.now();
const daysAgo = (d: number, hour = 10) => {
  const t = new Date(now - d * DAY);
  t.setUTCHours(hour, 0, 0, 0);
  return t;
};
const unix = (d: Date) => Math.floor(d.getTime() / 1000);
const fromUnix = (t: number) => new Date(t * 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing from .env.local`);
  return v;
}

const stripeKey = required("STRIPE_SECRET_KEY");
if (!stripeKey.startsWith("sk_test_")) throw new Error("Test mode only: STRIPE_SECRET_KEY must start with sk_test_");
const stripe = new Stripe(stripeKey);
const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const loginPassword = required("DEMO_LOGIN_PASSWORD");

const PRICE: Record<ProductKey, string> = {
  arabic_monthly: required("STRIPE_PRICE_ARABIC_MONTHLY"),
  precision_monthly: required("STRIPE_PRICE_PRECISION_MONTHLY"),
  lifetime: required("STRIPE_PRICE_LIFETIME"),
};
const deps: BillingDeps = {
  retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
  productKeyFromPriceId: (id) =>
    (Object.entries(PRICE).find(([, p]) => p === id)?.[0] as ProductKey | undefined) ?? null,
  now: () => new Date(),
};

type Plan =
  | { kind: "none" }
  | { kind: "lifetime"; refund?: boolean }
  | {
      kind: "monthly";
      product: "arabic_monthly" | "precision_monthly";
      /** grace: the renewal card fails and stays failed; recovered: it fails, then a new card pays it. */
      fail?: "grace" | "recovered";
      /** Days ago the student scheduled the cancellation. */
      cancelDaysAgo?: number;
    };

type Student = {
  key: string;
  name: string;
  email: string;
  tz: string;
  joined: number; // days ago
  plan: Plan;
  login?: "student" | "admin";
};

const story: Student[] = (
  [
  { key: "aisha", name: "Aisha Rahman", tz: "Asia/Dubai", joined: 28, plan: { kind: "lifetime" }, login: "student" },
  { key: "yusuf", name: "Yusuf Ali", tz: "Europe/London", joined: 20, plan: { kind: "monthly", product: "arabic_monthly" } },
  {
    key: "maryam",
    name: "Maryam Siddiqui",
    tz: "Asia/Karachi",
    joined: 33, // renewal ~3 days ago fails -> 4 days of grace left
    plan: { kind: "monthly", product: "precision_monthly", fail: "grace" },
  },
  {
    key: "ibrahim",
    name: "Ibrahim Khan",
    tz: "America/Toronto",
    joined: 15,
    plan: { kind: "monthly", product: "arabic_monthly", cancelDaysAgo: 6 },
  },
  { key: "fatima", name: "Fatima Noor", tz: "Africa/Nairobi", joined: 4, plan: { kind: "monthly", product: "precision_monthly" } },
  ] satisfies Omit<Student, "email">[]
).map((st) => ({ ...st, email: `${st.key}@${DOMAIN}` }));

const admin: Student = {
  key: "admin",
  name: "Demo Admin",
  email: `admin@${DOMAIN}`,
  tz: "Asia/Dubai",
  joined: 60,
  plan: { kind: "none" },
  login: "admin",
};

// Background students: quieter accounts that give the charts a realistic history (deterministic).
function background(): Student[] {
  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const tzs = ["Asia/Dubai", "Europe/London", "Asia/Kolkata", "Africa/Lagos", "America/New_York", "Asia/Riyadh"];
  const names = [
    "Omar Farooq", "Zainab Hussain", "Bilal Ahmed", "Khadija Malik", "Hamza Qureshi",
    "Safiya Begum", "Idris Okafor", "Amina Yusuf", "Tariq Mansour", "Hafsa Rahim",
    "Usman Sheikh", "Layla Haddad", "Anas Karim", "Ruqayyah Bello", "Salman Javed",
  ];
  let refunded = false;
  let recovered = false;
  return names.map((name, i) => {
    const joined = 3 + Math.floor(rand() * 55); // 3-58 days ago
    const tz = tzs[Math.floor(rand() * tzs.length)];
    const roll = rand();
    const product = rand() < 0.6 ? ("arabic_monthly" as const) : ("precision_monthly" as const);
    let plan: Plan;
    if (roll < 0.15) {
      plan = { kind: "lifetime", refund: !refunded };
      refunded = true;
    } else if (roll < 0.85) {
      // The first student old enough to have renewed ~10+ days ago gets a failed-then-recovered renewal.
      const fail = !recovered && joined >= 42 ? ("recovered" as const) : undefined;
      if (fail) recovered = true;
      plan = { kind: "monthly", product, fail };
    } else plan = { kind: "none" };
    const key = `${name.split(" ")[0].toLowerCase()}.${i + 1}`;
    return { key, name, email: `${key}@${DOMAIN}`, tz, joined, plan };
  });
}

// ---------------------------------------------------------------- Stripe helpers

async function waitForClock(id: string) {
  for (let i = 0; i < 120; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(id);
    if (clock.status === "ready") return clock;
    if (clock.status === "internal_failure") throw new Error(`Test clock ${id} failed`);
    await sleep(2000);
  }
  throw new Error(`Test clock ${id} did not finish advancing`);
}

async function advance(clockId: string, to: Date) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: unix(to) });
  await waitForClock(clockId);
}

async function card(customer: string, token: "pm_card_visa" | "pm_card_chargeCustomerFail") {
  const pm = await stripe.paymentMethods.attach(token, { customer });
  await stripe.customers.update(customer, { invoice_settings: { default_payment_method: pm.id } });
  return pm.id;
}

type StripeResult = {
  userId: string;
  customerId: string;
  subId?: string;
  paymentIntentId?: string;
  lifetimeInvoiceId?: string;
  refund?: boolean;
};

/** Builds one student's billing history on their own test clock. */
async function buildHistory(st: Student, userId: string, db: ReturnType<typeof drizzle<typeof s>>): Promise<StripeResult> {
  const plan = st.plan;
  const start = daysAgo(st.joined, 9);
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: unix(start), name: `demo-${st.key}` });
  const customer = await stripe.customers.create({
    email: st.email,
    name: st.name,
    test_clock: clock.id,
    metadata: { userId },
  });
  await db.update(s.users).set({ stripeCustomerId: customer.id }).where(eq(s.users.id, userId));
  const goodCard = await card(customer.id, "pm_card_visa");
  const result: StripeResult = { userId, customerId: customer.id };

  if (plan.kind === "lifetime") {
    // A one-off invoice on the clock, so Stripe dates the $999 payment on the join day
    // (a bare PaymentIntent would carry today's real date).
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "charge_automatically",
      auto_advance: false,
      metadata: { userId, productKey: "lifetime" },
    });
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      pricing: { price: PRICE.lifetime },
    });
    await stripe.invoices.finalizeInvoice(invoice.id!);
    await stripe.invoices.pay(invoice.id!, { payment_method: goodCard });
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id!, limit: 1 });
    const piRef = payments.data[0]?.payment.payment_intent;
    const pi = { id: typeof piRef === "string" ? piRef : piRef?.id };
    if (!pi.id) throw new Error(`No payment intent for lifetime invoice ${invoice.id}`);
    // A script can't click through Stripe Checkout, so it hands the production handler
    // the same completed-session shape Checkout would send for this payment.
    await db.transaction((tx) =>
      handleCheckoutCompleted(
        tx,
        {
          id: `cs_seed_${pi.id}`,
          payment_status: "paid",
          mode: "payment",
          client_reference_id: userId,
          metadata: { userId, productKey: "lifetime" },
          payment_intent: pi.id,
        } as unknown as Stripe.Checkout.Session,
        deps,
      ),
    );
    result.paymentIntentId = pi.id;
    result.lifetimeInvoiceId = invoice.id;
    result.refund = plan.refund;
  }

  if (plan.kind === "monthly") {
    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: PRICE[plan.product] }],
      metadata: { userId, productKey: plan.product },
    });
    result.subId = sub.id;
    const renewal = fromUnix(sub.items.data[0].current_period_end);

    if (plan.fail) await card(customer.id, "pm_card_chargeCustomerFail");
    if (plan.fail === "recovered") {
      // Let the renewal fail (and one retry), then the student adds a working card and pays.
      await advance(clock.id, new Date(renewal.getTime() + 2 * DAY));
      await card(customer.id, "pm_card_visa");
      const open = await stripe.invoices.list({ subscription: sub.id, status: "open", limit: 1 });
      if (open.data[0]?.id) await stripe.invoices.pay(open.data[0].id);
    }
    if (plan.cancelDaysAgo !== undefined) {
      await advance(clock.id, daysAgo(plan.cancelDaysAgo, 14));
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    }
  }

  await advance(clock.id, new Date(now - 60_000));
  if (result.refund && result.paymentIntentId) {
    await stripe.refunds.create({ payment_intent: result.paymentIntentId, reason: "requested_by_customer" });
  }
  return result;
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
];

/** Applies every Stripe event since `since` for these customers, oldest first, exactly as the webhook would. */
async function replayEvents(db: ReturnType<typeof drizzle<typeof s>>, customers: Set<string>, since: number) {
  const events: Stripe.Event[] = [];
  for await (const e of stripe.events.list({ created: { gte: since }, types: EVENT_TYPES, limit: 100 })) {
    const obj = e.data.object as { customer?: string | { id: string } | null };
    const customer = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
    if (customer && customers.has(customer)) events.push(e);
  }
  events.sort((a, b) => a.created - b.created);
  let applied = 0;
  const failed: string[] = [];
  for (const e of events) {
    try {
      const { duplicate } = await withIdempotency(db, { id: e.id, provider: "stripe", type: e.type }, (tx) =>
        handleStripeEvent(tx, e, deps),
      );
      if (!duplicate) applied++;
    } catch (err) {
      failed.push(`${e.type} ${e.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { total: events.length, applied, failed };
}

// ---------------------------------------------------------------- main

async function main() {
  // Few connections: the session pooler is shared with the app and its webhook bursts (D15).
  const client = postgres(required("DATABASE_URL"), { prepare: false, max: 2 });
  const db = drizzle(client, { schema: s });
  try {
    // 1a. Stripe: deleting a demo clock deletes its customers and subscriptions. Replaying those
    //     events now (while the demo users still exist) marks them processed, so the webhook's
    //     copies and any retries from an earlier run are skipped instead of failing.
    const seedStart = Math.floor(Date.now() / 1000);
    const clocks = await stripe.testHelpers.testClocks.list({ limit: 100 });
    const demoClocks = clocks.data.filter((c) => c.name?.startsWith("demo-"));
    const oldCustomers = new Set<string>();
    for (const c of demoClocks) {
      for await (const cu of stripe.customers.list({ test_clock: c.id, limit: 100 })) oldCustomers.add(cu.id);
      await stripe.testHelpers.testClocks.del(c.id);
    }
    if (demoClocks.length) {
      await sleep(10_000);
      const r = await replayEvents(db, oldCustomers, seedStart - 3 * DAY / 1000);
      console.log(`deleted ${demoClocks.length} old demo clocks; replayed ${r.applied} of ${r.total} events`);
    }

    // 1b. Our rows (children first). Demo users themselves are kept, so their ids stay stable
    //     across runs. Older seeds used demo_ ids and the Clerk-era logins used @demo.academy.
    const keepIds = (await db.select({ id: s.users.id }).from(s.users).where(like(s.users.email, `%@${DOMAIN}`))).map((u) => u.id);
    const legacyIds = (
      await db
        .select({ id: s.users.id })
        .from(s.users)
        .where(or(like(s.users.id, "demo_%"), like(s.users.email, "%@demo.academy")))
    ).map((u) => u.id);
    const ids = [...keepIds, ...legacyIds];
    if (ids.length) {
      await db.delete(s.outboundEvents).where(inArray(s.outboundEvents.userId, ids));
      await db.delete(s.cancellationFeedback).where(inArray(s.cancellationFeedback.userId, ids));
      await db.delete(s.lessonProgress).where(inArray(s.lessonProgress.userId, ids));
      await db.delete(s.invoices).where(inArray(s.invoices.userId, ids));
      await db.delete(s.entitlements).where(inArray(s.entitlements.userId, ids));
      await db.delete(s.subscriptions).where(inArray(s.subscriptions.userId, ids));
    }
    if (legacyIds.length) await db.delete(s.users).where(inArray(s.users.id, legacyIds));
    await db.delete(s.processedEvents).where(like(s.processedEvents.id, "evt_demo_%"));

    // 1c. Existing Supabase demo logins, reused by email.
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const existing = new Map(
      list.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`)).map((u) => [u.email!, u.id]),
    );

    // 2. Accounts.
    const students = [...story, ...background()];
    const userIds = new Map<string, string>();
    for (const st of [admin, ...students]) {
      const attrs = {
        password: st.login ? loginPassword : randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { full_name: st.name },
        app_metadata: { role: st.login === "admin" ? "admin" : null },
      };
      const known = existing.get(st.email);
      const { data, error } = known
        ? await supabase.auth.admin.updateUserById(known, attrs)
        : await supabase.auth.admin.createUser({ email: st.email, ...attrs });
      if (error || !data.user) throw error ?? new Error(`Could not create ${st.email}`);
      userIds.set(st.key, data.user.id);
      const row = { email: st.email, name: st.name, timezone: st.tz, stripeCustomerId: null, createdAt: daysAgo(st.joined, 9), updatedAt: daysAgo(st.joined, 9) };
      await db.insert(s.users).values({ id: data.user.id, ...row }).onConflictDoUpdate({ target: s.users.id, set: row });
    }
    console.log(`${students.length} students + 1 admin ready (${existing.size} reused)`);

    // 3. Stripe history, four clocks at a time.
    const paying = students.filter((st) => st.plan.kind !== "none");
    const results = await pool(paying, 4, async (st) => {
      const r = await buildHistory(st, userIds.get(st.key)!, db);
      console.log(`  ✓ ${st.name}: ${st.plan.kind}`);
      return r;
    });

    // 4. Apply the new history through the webhook's own code path.
    const customers = new Set(results.map((r) => r.customerId));
    const replay = await replayEvents(db, customers, seedStart);
    if (replay.failed.length) throw new Error(`Some events failed:\n${replay.failed.join("\n")}`);
    console.log(`applied ${replay.applied} of ${replay.total} Stripe events (the rest were already in via the webhook)`);

    // 5. Stripe's timestamps instead of "when our webhook ran".
    for (const r of results) {
      if (r.subId) {
        const sub = await stripe.subscriptions.retrieve(r.subId);
        await db
          .update(s.entitlements)
          .set({ createdAt: fromUnix(sub.start_date) })
          .where(and(eq(s.entitlements.sourceRef, r.subId), eq(s.entitlements.userId, r.userId)));
        const rows = await db.select().from(s.invoices).where(eq(s.invoices.subscriptionId, r.subId));
        for (const row of rows) {
          const inv = await stripe.invoices.retrieve(row.id);
          const paidAt = inv.status_transitions.paid_at ? fromUnix(inv.status_transitions.paid_at) : null;
          // The first attempt follows finalization; that's when the payment first failed.
          const firstFailedAt =
            row.firstFailedAt && inv.status_transitions.finalized_at ? fromUnix(inv.status_transitions.finalized_at) : row.firstFailedAt;
          await db.update(s.invoices).set({ paidAt, firstFailedAt }).where(eq(s.invoices.id, row.id));
          if (firstFailedAt && inv.status !== "paid") {
            await db
              .update(s.entitlements)
              .set({ graceUntil: new Date(firstFailedAt.getTime() + GRACE_DAYS * DAY) })
              .where(and(eq(s.entitlements.sourceRef, r.subId), eq(s.entitlements.status, "grace")));
          }
        }
      }
      if (r.paymentIntentId && r.lifetimeInvoiceId) {
        // Clock time, like the monthly invoices (the charge itself carries today's real date).
        const inv = await stripe.invoices.retrieve(r.lifetimeInvoiceId);
        await db
          .update(s.entitlements)
          .set({ createdAt: fromUnix(inv.status_transitions.paid_at ?? unix(new Date())) })
          .where(eq(s.entitlements.sourceRef, r.paymentIntentId));
      }
      // The free bundle starts with the student's first paid access.
      const [first] = await db
        .select({ at: s.entitlements.createdAt })
        .from(s.entitlements)
        .where(and(eq(s.entitlements.userId, r.userId), inArray(s.entitlements.source, ["subscription", "lifetime"])))
        .orderBy(asc(s.entitlements.createdAt))
        .limit(1);
      if (first) {
        await db
          .update(s.entitlements)
          .set({ createdAt: first.at })
          .where(and(eq(s.entitlements.userId, r.userId), eq(s.entitlements.source, "bundle")));
      }
    }

    // 6. App activity (not billing): lessons, cancellation feedback, the inactivity nudge.
    const progs = Object.fromEntries((await db.select().from(s.programmes)).map((p) => [p.slug, p.id]));
    const lessonsBy = (slug: string) =>
      db.select().from(s.lessons).where(eq(s.lessons.programmeId, progs[slug])).orderBy(asc(s.lessons.position));
    const arabic = await lessonsBy("arabic");
    const precision = await lessonsBy("precision");
    const done = (userId: string, lessonIds: string[], startDay: number) =>
      lessonIds.length
        ? db.insert(s.lessonProgress).values(
            lessonIds.map((lessonId, i) => ({
              userId,
              lessonId,
              lastPositionSec: 600,
              completedAt: daysAgo(Math.max(0, startDay - i)),
              updatedAt: daysAgo(Math.max(0, startDay - i)),
            })),
          )
        : Promise.resolve();
    const id = (key: string) => userIds.get(key)!;

    await done(id("aisha"), [...arabic.map((l) => l.id), ...precision.slice(0, 4).map((l) => l.id)], 10);
    await done(id("yusuf"), arabic.slice(0, 3).map((l) => l.id), 4);
    await done(id("maryam"), precision.slice(0, 2).map((l) => l.id), 30);
    await db.insert(s.lessonProgress).values({
      userId: id("maryam"),
      lessonId: precision[2].id,
      lastPositionSec: 240,
      updatedAt: daysAgo(5),
    });
    await done(id("ibrahim"), arabic.slice(0, 1).map((l) => l.id), 12);
    const ibrahimSub = results.find((r) => r.userId === id("ibrahim"))!.subId!;
    await db.insert(s.cancellationFeedback).values({
      userId: id("ibrahim"),
      subscriptionId: ibrahimSub,
      reason: "too_expensive",
      comment: "Will come back after Ramadan.",
      offerShown: "discount",
      offerAccepted: false,
      createdAt: daysAgo(6, 14),
    });
    await db.insert(s.outboundEvents).values({
      userId: id("fatima"),
      type: "student.inactive_3d",
      payload: {},
      dedupeKey: `inactive3d:${id("fatima")}`,
      status: "pending",
      createdAt: daysAgo(0),
    });

    let lcg = 7;
    const rand = () => (lcg = (lcg * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const st of students.slice(story.length)) {
      if (st.plan.kind === "none") continue;
      const pool =
        st.plan.kind === "lifetime"
          ? [...arabic, ...precision]
          : st.plan.product === "arabic_monthly"
            ? arabic
            : precision;
      const count = Math.min(pool.length, 1 + Math.floor(rand() * 5));
      await done(id(st.key), pool.slice(0, count).map((l) => l.id), Math.min(st.joined, 1 + Math.floor(rand() * 20)));
    }

    const grace = await db
      .select({ u: s.entitlements.userId })
      .from(s.entitlements)
      .where(and(eq(s.entitlements.status, "grace"), isNotNull(s.entitlements.graceUntil)));
    console.log(`done: ${students.length} students, ${results.length} with Stripe history, ${grace.length} in grace`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
