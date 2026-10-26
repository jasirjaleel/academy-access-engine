import { beforeEach, describe, expect, it } from "vitest";
import { entitlements, lessonProgress } from "@/db/schema";
import type { Database } from "@/db/types";
import { getSidebarData } from "@/lib/sidebar";
import { createTestDb } from "./helpers/db";
import { NOW, seedBasics } from "./helpers/fixtures";

const DAY = 86_400_000;

describe("getSidebarData", () => {
  let db: Database;
  let ids: Record<string, string>;
  beforeEach(async () => {
    db = await createTestDb();
    ids = await seedBasics(db);
  });

  const states = (d: Awaited<ReturnType<typeof getSidebarData>>, slug: string) =>
    d.programmes.find((p) => p.slug === slug)!.lessons.map((l) => l.state);

  it("without a plan: previews are open, everything else locked", async () => {
    const d = await getSidebarData(db, "user_1", NOW);
    expect(d.programmes.map((p) => p.badge)).toEqual(["locked", "locked", "locked"]);
    expect(states(d, "arabic")).toEqual(["open", "locked"]);
    expect(d.continueLesson).toBeNull();
    expect(d.inGrace).toBe(false);
  });

  it("marks done / in progress, badges and continue-learning", async () => {
    await db.insert(entitlements).values([
      { userId: "user_1", programmeId: ids.arabic, source: "subscription", sourceRef: "sub_1", status: "active" },
      { userId: "user_1", programmeId: ids.usool, source: "bundle", sourceRef: "bundle", status: "active" },
    ]);
    await db.insert(lessonProgress).values([
      { userId: "user_1", lessonId: ids["arabic:1"], lastPositionSec: 600, completedAt: NOW, updatedAt: new Date(NOW.getTime() - DAY) },
      { userId: "user_1", lessonId: ids["arabic:2"], lastPositionSec: 120, updatedAt: NOW },
    ]);
    const d = await getSidebarData(db, "user_1", NOW);
    expect(d.programmes.map((p) => p.badge)).toEqual(["active", "locked", "free"]);
    expect(states(d, "arabic")).toEqual(["done", "in_progress"]);
    expect(d.programmes[0].completed).toBe(1);
    expect(d.continueLesson).toMatchObject({ id: ids["arabic:2"], programmeTitle: "arabic" });
  });

  it("flags the grace period", async () => {
    await db.insert(entitlements).values({
      userId: "user_1", programmeId: ids.arabic, source: "subscription", sourceRef: "sub_1", status: "grace", graceUntil: new Date(NOW.getTime() + 3 * DAY),
    });
    const d = await getSidebarData(db, "user_1", NOW);
    expect(d.inGrace).toBe(true);
    expect(d.programmes[0].badge).toBe("grace");
  });
});
