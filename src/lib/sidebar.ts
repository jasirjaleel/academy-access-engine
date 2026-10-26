import { asc, eq } from "drizzle-orm";
import { lessonProgress, lessons, programmes } from "@/db/schema";
import type { Database } from "@/db/types";
import { getProgrammeAccess } from "@/lib/access";
import type { ProgrammeSlug } from "@/lib/catalogue";

export type LessonState = "done" | "in_progress" | "open" | "locked";
export type ProgrammeBadge = "active" | "grace" | "free" | "locked";

export type SidebarProgramme = {
  slug: ProgrammeSlug;
  titleEn: string;
  titleAr: string;
  badge: ProgrammeBadge;
  completed: number;
  lessons: { id: string; position: number; titleEn: string; titleAr: string; isPreview: boolean; state: LessonState }[];
};

export type SidebarData = {
  programmes: SidebarProgramme[];
  continueLesson: { id: string; titleEn: string; programmeTitle: string } | null;
  inGrace: boolean;
};

/** Everything the app-shell sidebar and ⌘K palette need, in four queries. */
export async function getSidebarData(db: Database, userId: string, now = new Date()): Promise<SidebarData> {
  const [access, programmeRows, lessonRows, progressRows] = await Promise.all([
    getProgrammeAccess(db, userId, now),
    db.select().from(programmes).orderBy(asc(programmes.position)),
    db.select().from(lessons).orderBy(asc(lessons.position)),
    db
      .select({
        lessonId: lessonProgress.lessonId,
        completedAt: lessonProgress.completedAt,
        lastPositionSec: lessonProgress.lastPositionSec,
        updatedAt: lessonProgress.updatedAt,
      })
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId)),
  ]);

  const progress = new Map(progressRows.map((p) => [p.lessonId, p]));

  const result: SidebarProgramme[] = programmeRows.map((p) => {
    const slug = p.slug as ProgrammeSlug;
    const a = access[slug];
    const bundleOnly = a.sources.length > 0 && a.sources.every((s) => s === "bundle");
    const badge: ProgrammeBadge = !a.hasAccess ? "locked" : a.status === "grace" ? "grace" : bundleOnly ? "free" : "active";

    const items = lessonRows
      .filter((l) => l.programmeId === p.id)
      .map((l) => {
        const pr = progress.get(l.id);
        const state: LessonState = !(a.hasAccess || l.isPreview)
          ? "locked"
          : pr?.completedAt
            ? "done"
            : pr && pr.lastPositionSec > 0
              ? "in_progress"
              : "open";
        return { id: l.id, position: l.position, titleEn: l.titleEn, titleAr: l.titleAr, isPreview: l.isPreview, state };
      });

    return {
      slug,
      titleEn: p.titleEn,
      titleAr: p.titleAr,
      badge,
      completed: items.filter((i) => i.state === "done").length,
      lessons: items,
    };
  });

  // Continue learning: the most recently touched lesson that's unfinished and still watchable.
  const watchable = new Map(
    result.flatMap((p) => p.lessons.filter((l) => l.state === "in_progress" || l.state === "open").map((l) => [l.id, { ...l, programmeTitle: p.titleEn }] as const)),
  );
  const latest = progressRows
    .filter((r) => !r.completedAt && watchable.has(r.lessonId))
    .sort((x, y) => y.updatedAt.getTime() - x.updatedAt.getTime())[0];
  const cont = latest ? watchable.get(latest.lessonId)! : null;

  return {
    programmes: result,
    continueLesson: cont ? { id: cont.id, titleEn: cont.titleEn, programmeTitle: cont.programmeTitle } : null,
    inGrace: Object.values(access).some((a) => a.status === "grace"),
  };
}
