import "server-only";
import { sql } from "drizzle-orm";
import { lessonProgress } from "@/db/schema";
import type { Database } from "@/db/types";
import { canWatchLesson } from "@/lib/access";

/** Access-checked: a locked student can't write progress by calling the action directly. */
export async function saveProgress(
  db: Database,
  userId: string,
  lessonId: string,
  input: { positionSec: number; completed: boolean },
  now = new Date(),
) {
  const check = await canWatchLesson(db, userId, lessonId, now);
  if (!check?.allowed) throw new Error("No access to this lesson");

  const position = Math.max(0, Math.min(Math.round(input.positionSec), check.lesson.durationSec));
  await db
    .insert(lessonProgress)
    .values({
      userId,
      lessonId,
      lastPositionSec: position,
      completedAt: input.completed ? now : null,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        lastPositionSec: position,
        // Set once, never cleared.
        completedAt: input.completed
          ? sql`coalesce(${lessonProgress.completedAt}, ${now.toISOString()}::timestamptz)`
          : sql`${lessonProgress.completedAt}`,
        updatedAt: sql`now()`,
      },
    });
}
