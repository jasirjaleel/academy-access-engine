import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { lessonProgress, outboundEvents, users } from "@/db/schema";
import type { Database } from "@/db/types";
import { BACKOFF_MINUTES, dispatchPending, MAX_ATTEMPTS } from "@/lib/dispatch";
import { enqueueEvent } from "@/lib/events";
import { enqueueInactiveNudges } from "@/lib/nudges";
import { createTestDb } from "./helpers/db";
import { NOW, seedBasics } from "./helpers/fixtures";

const SECRET = "test-secret";
type Call = { url: string; headers: Record<string, string>; body: string };

function fakeN8n(status = 200) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
    return new Response("ok", { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}
const config = (fetchImpl: typeof fetch, now = NOW) => ({
  webhookUrl: "https://n8n.example.test/webhook/academy-events",
  signingSecret: SECRET,
  appUrl: "https://academy.example.test",
  fetch: fetchImpl,
  now: () => now,
});
const row = (db: Database, key: string) =>
  db.query.outboundEvents.findFirst({ where: eq(outboundEvents.dedupeKey, key) });

describe("outbox dispatcher", () => {
  let db: Database;
  beforeEach(async () => {
    db = await createTestDb();
    await seedBasics(db);
    await db.update(users).set({ name: "Aisha Rahman" }).where(eq(users.id, "user_1"));
    await enqueueEvent(db, { type: "payment.failed", userId: "user_1", payload: { invoiceId: "in_1" }, dedupeKey: "payfail:in_1:1" });
    // created_at defaults to the real clock; make it due at the test's NOW
    await db.update(outboundEvents).set({ nextAttemptAt: new Date(NOW.getTime() - 1000) });
  });

  it("sends a signed request with student details looked up at send time", async () => {
    const n8n = fakeN8n();
    expect(await dispatchPending(db, config(n8n.fetchImpl))).toEqual({ sent: 1, retried: 0, failed: 0 });

    const [call] = n8n.calls;
    const ts = call.headers["x-academy-timestamp"];
    const expected = "sha256=" + createHmac("sha256", SECRET).update(`${ts}.${call.body}`).digest("hex");
    expect(call.headers["x-academy-signature"]).toBe(expected);

    const body = JSON.parse(call.body);
    expect(body).toMatchObject({
      type: "payment.failed",
      dedupeKey: "payfail:in_1:1",
      student: { email: "student@example.test", firstName: "Aisha", whatsapp: null },
      links: { billing: "https://academy.example.test/dashboard/billing" },
    });
    // the outbox row itself still holds no personal data
    expect(JSON.stringify((await row(db, "payfail:in_1:1"))?.payload)).not.toContain("@");
    expect(await row(db, "payfail:in_1:1")).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("does not send the same event twice", async () => {
    const n8n = fakeN8n();
    await dispatchPending(db, config(n8n.fetchImpl));
    await dispatchPending(db, config(n8n.fetchImpl));
    expect(n8n.calls).toHaveLength(1);
  });

  it("retries with backoff, then gives up after MAX_ATTEMPTS", async () => {
    const n8n = fakeN8n(503);
    let now = NOW;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await dispatchPending(db, config(n8n.fetchImpl, now));
      const r = await row(db, "payfail:in_1:1");
      expect(r?.attempts).toBe(attempt);
      expect(r?.lastError).toBe("HTTP 503");
      if (attempt < MAX_ATTEMPTS) {
        expect(r?.status).toBe("pending");
        expect(r?.nextAttemptAt.getTime()).toBe(now.getTime() + BACKOFF_MINUTES[attempt - 1] * 60_000);
        // not due yet: nothing is sent before the backoff passes
        await dispatchPending(db, config(n8n.fetchImpl, now));
        expect(n8n.calls).toHaveLength(attempt);
        now = new Date(r!.nextAttemptAt.getTime() + 1000);
      } else {
        expect(r?.status).toBe("failed");
      }
    }
  });

  it("recovers on a later attempt", async () => {
    await dispatchPending(db, config(fakeN8n(500).fetchImpl));
    const later = new Date(NOW.getTime() + 6 * 60_000);
    expect(await dispatchPending(db, config(fakeN8n(200).fetchImpl, later))).toMatchObject({ sent: 1 });
    expect(await row(db, "payfail:in_1:1")).toMatchObject({ status: "sent", attempts: 2, lastError: null });
  });

  it("never messages a deleted (anonymised) student", async () => {
    await db.update(users).set({ email: "deleted+user_1@invalid" }).where(eq(users.id, "user_1"));
    const n8n = fakeN8n();
    expect(await dispatchPending(db, config(n8n.fetchImpl))).toMatchObject({ failed: 1 });
    expect(n8n.calls).toHaveLength(0);
  });
});

describe("inactivity nudge", () => {
  let db: Database;
  let ids: Record<string, string>;
  beforeEach(async () => {
    db = await createTestDb();
    ids = await seedBasics(db);
    await enqueueEvent(db, { type: "student.enrolled", userId: "user_1", payload: {}, dedupeKey: "enrolled:user_1:arabic_monthly" });
  });

  it("nudges once, only after 3 days, only if no lesson was opened", async () => {
    const in4Days = new Date(Date.now() + 4 * 86_400_000);
    expect(await enqueueInactiveNudges(db, new Date())).toBe(0); // too early
    expect(await enqueueInactiveNudges(db, in4Days)).toBe(1);
    await enqueueInactiveNudges(db, in4Days); // daily re-run
    const nudges = (await db.select().from(outboundEvents)).filter((e) => e.type === "student.inactive_3d");
    expect(nudges).toHaveLength(1);
  });

  it("skips students who already watched something", async () => {
    await db.insert(lessonProgress).values({ userId: "user_1", lessonId: ids["arabic:1"], lastPositionSec: 30 });
    expect(await enqueueInactiveNudges(db, new Date(Date.now() + 4 * 86_400_000))).toBe(0);
  });
});
