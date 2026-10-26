import { and, eq, lte, notExists, sql } from "drizzle-orm";
import { lessonProgress, outboundEvents } from "@/db/schema";
import type { Database } from "@/db/types";
import { enqueueEvent } from "@/lib/events";

const DAY_MS = 86_400_000;

/**
 * Students who enrolled 3+ days ago and haven't opened a single lesson get one gentle nudge.
 * Safe to run every day: the dedupe key allows exactly one per student.
 */
export async function enqueueInactiveNudges(db: Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 3 * DAY_MS);
  const candidates = await db
    .selectDistinct({ userId: outboundEvents.userId })
    .from(outboundEvents)
    .where(
      and(
        eq(outboundEvents.type, "student.enrolled"),
        lte(outboundEvents.createdAt, cutoff),
        notExists(db.select({ one: sql`1` }).from(lessonProgress).where(eq(lessonProgress.userId, outboundEvents.userId))),
      ),
    );

  for (const { userId } of candidates) {
    await enqueueEvent(db, {
      type: "student.inactive_3d",
      userId,
      payload: {},
      dedupeKey: `inactive3d:${userId}`,
    });
  }
  return candidates.length;
}
