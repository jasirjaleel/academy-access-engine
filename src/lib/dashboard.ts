import "server-only";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { lessonProgress, lessons, programmes, subscriptions } from "@/db/schema";
import type { Database } from "@/db/types";
import { getProgrammeAccess } from "@/lib/access";
import { PRODUCTS, isProductKey, type ProgrammeSlug } from "@/lib/catalogue";

export async function getDashboardData(db: Database, userId: string, now = new Date()) {
  const [access, programmeRows, lessonRows, progressRows, subs] = await Promise.all([
    getProgrammeAccess(db, userId, now),
    db.select().from(programmes).orderBy(asc(programmes.position)),
    db.select({ id: lessons.id, programmeId: lessons.programmeId, isPreview: lessons.isPreview }).from(lessons),
    db
      .select({ lessonId: lessonProgress.lessonId, completedAt: lessonProgress.completedAt })
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId)),
    db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), ne(subscriptions.status, "canceled"))),
  ]);

  const completed = new Set(progressRows.filter((p) => p.completedAt).map((p) => p.lessonId));

  const programmeCards = programmeRows.map((p) => {
    const ls = lessonRows.filter((l) => l.programmeId === p.id);
    const slug = p.slug as ProgrammeSlug;
    return {
      ...p,
      slug,
      access: access[slug],
      totalLessons: ls.length,
      completedLessons: ls.filter((l) => completed.has(l.id)).length,
    };
  });

  // Continue watching: the most recently touched, unfinished lesson the student can still open.
  const recent = await db
    .select({ progress: lessonProgress, lesson: lessons, programme: programmes })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .innerJoin(programmes, eq(programmes.id, lessons.programmeId))
    .where(and(eq(lessonProgress.userId, userId), isNull(lessonProgress.completedAt)))
    .orderBy(desc(lessonProgress.updatedAt))
    .limit(5);
  const continueWatching =
    recent.find((r) => r.lesson.isPreview || access[r.programme.slug as ProgrammeSlug]?.hasAccess) ?? null;

  const graceDates = Object.values(access)
    .map((a) => a.graceUntil)
    .filter((d): d is Date => d !== null);

  return {
    programmeCards,
    continueWatching,
    billing: {
      hasLifetime: Object.values(access).some((a) => a.sources.includes("lifetime")),
      subscriptions: subs.map((s) => ({
        id: s.id,
        name: isProductKey(s.productKey) ? PRODUCTS[s.productKey].name : s.productKey,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        pausedUntil: s.pausedUntil && s.pausedUntil > now ? s.pausedUntil : null,
      })),
      graceUntil: graceDates.length ? new Date(Math.min(...graceDates.map((d) => d.getTime()))) : null,
    },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
