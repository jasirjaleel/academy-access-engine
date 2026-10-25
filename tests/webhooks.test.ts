import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { processedEvents } from "@/db/schema";
import type { Database } from "@/db/types";
import { withIdempotency } from "@/lib/webhooks";
import { createTestDb } from "./helpers/db";

const meta = (id: string) => ({ id, provider: "stripe" as const, type: "test.event" });
const row = (db: Database, id: string) =>
  db.query.processedEvents.findFirst({ where: eq(processedEvents.id, id) });

describe("withIdempotency", () => {
  let db: Database;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("runs the handler once for a duplicate event", async () => {
    let runs = 0;
    const handler = async () => {
      runs++;
      return "applied" as const;
    };
    const first = await withIdempotency(db, meta("evt_1"), handler);
    const second = await withIdempotency(db, meta("evt_1"), handler);

    expect(first).toEqual({ duplicate: false, result: "applied" });
    expect(second).toEqual({ duplicate: true });
    expect(runs).toBe(1);
    expect((await row(db, "evt_1"))?.result).toBe("applied");
  });

  it("records a failure and lets the retry through", async () => {
    await expect(
      withIdempotency(db, meta("evt_2"), async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await row(db, "evt_2")).toMatchObject({ result: "error", error: "boom" });

    const retry = await withIdempotency(db, meta("evt_2"), async () => "applied");
    expect(retry).toEqual({ duplicate: false, result: "applied" });
    expect(await row(db, "evt_2")).toMatchObject({ result: "applied", error: null });
  });

  it("rolls back the handler's writes when it fails", async () => {
    await expect(
      withIdempotency(db, meta("evt_3"), async (tx) => {
        await tx.insert(processedEvents).values({ id: "side_effect", provider: "stripe", type: "x", result: "applied" });
        throw new Error("fail after write");
      }),
    ).rejects.toThrow();
    expect(await row(db, "side_effect")).toBeUndefined();
  });
});
