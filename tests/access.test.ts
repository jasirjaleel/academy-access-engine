import { beforeEach, describe, expect, it } from "vitest";
import { entitlements } from "@/db/schema";
import type { Database } from "@/db/types";
import { canWatchLesson, getProgrammeAccess } from "@/lib/access";
import { createTestDb } from "./helpers/db";
import { NOW, seedBasics } from "./helpers/fixtures";

describe("access rules", () => {
  let db: Database;
  let ids: Record<string, string>;
  beforeEach(async () => {
    db = await createTestDb();
    ids = await seedBasics(db);
  });

  const grant = (status: "active" | "grace" | "revoked", graceUntil: Date | null = null) =>
    db.insert(entitlements).values({
      userId: "user_1",
      programmeId: ids.arabic,
      source: "subscription",
      sourceRef: "sub_1",
      status,
      graceUntil,
    });

  it("allows preview lessons for anyone, even signed out", async () => {
    expect((await canWatchLesson(db, null, ids["arabic:1"], NOW))?.reason).toBe("preview");
    expect((await canWatchLesson(db, "user_1", ids["arabic:1"], NOW))?.allowed).toBe(true);
  });

  it("locks non-preview lessons without an entitlement", async () => {
    const res = await canWatchLesson(db, "user_1", ids["arabic:2"], NOW);
    expect(res).toMatchObject({ allowed: false, reason: "locked" });
  });

  it("allows an active entitlement", async () => {
    await grant("active");
    expect((await canWatchLesson(db, "user_1", ids["arabic:2"], NOW))?.reason).toBe("entitled");
    expect((await canWatchLesson(db, "user_1", ids["precision:2"], NOW))?.allowed).toBe(false);
  });

  it("allows grace only until grace_until", async () => {
    await grant("grace", new Date(NOW.getTime() + 86400_000));
    expect((await canWatchLesson(db, "user_1", ids["arabic:2"], NOW))?.allowed).toBe(true);
    const later = new Date(NOW.getTime() + 2 * 86400_000);
    expect((await canWatchLesson(db, "user_1", ids["arabic:2"], later))?.allowed).toBe(false);
  });

  it("denies revoked entitlements", async () => {
    await grant("revoked");
    expect((await canWatchLesson(db, "user_1", ids["arabic:2"], NOW))?.allowed).toBe(false);
  });

  it("summarises access per programme", async () => {
    await grant("grace", new Date(NOW.getTime() + 86400_000));
    const access = await getProgrammeAccess(db, "user_1", NOW);
    expect(access.arabic).toMatchObject({ hasAccess: true, status: "grace" });
    expect(access.precision).toMatchObject({ hasAccess: false, status: "none" });
  });

  it("returns null for an unknown lesson", async () => {
    expect(await canWatchLesson(db, "user_1", "00000000-0000-0000-0000-000000000000", NOW)).toBeNull();
  });
});
