import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { entitlements, lessonProgress } from "@/db/schema";
import type { Database } from "@/db/types";
import { saveProgress } from "@/lib/progress";
import { createTestDb } from "./helpers/db";
import { NOW, seedBasics } from "./helpers/fixtures";

describe("saveProgress", () => {
  let db: Database;
  let ids: Record<string, string>;
  beforeEach(async () => {
    db = await createTestDb();
    ids = await seedBasics(db);
  });

  const progressFor = (lessonId: string) =>
    db.query.lessonProgress.findFirst({
      where: and(eq(lessonProgress.userId, "user_1"), eq(lessonProgress.lessonId, lessonId)),
    });

  it("refuses to write progress on a locked lesson", async () => {
    await expect(saveProgress(db, "user_1", ids["arabic:2"], { positionSec: 30, completed: false }, NOW)).rejects.toThrow(
      "No access",
    );
    expect(await progressFor(ids["arabic:2"])).toBeUndefined();
  });

  it("saves position on a preview lesson and clamps it to the duration", async () => {
    await saveProgress(db, "user_1", ids["arabic:1"], { positionSec: 99_999, completed: false }, NOW);
    expect((await progressFor(ids["arabic:1"]))?.lastPositionSec).toBe(600);
  });

  it("never clears completion once set", async () => {
    await db.insert(entitlements).values({
      userId: "user_1",
      programmeId: ids.arabic,
      source: "subscription",
      sourceRef: "sub_1",
      status: "active",
    });
    await saveProgress(db, "user_1", ids["arabic:2"], { positionSec: 600, completed: true }, NOW);
    await saveProgress(db, "user_1", ids["arabic:2"], { positionSec: 10, completed: false }, NOW);
    const row = await progressFor(ids["arabic:2"]);
    expect(row?.completedAt).not.toBeNull();
    expect(row?.lastPositionSec).toBe(10);
  });
});
