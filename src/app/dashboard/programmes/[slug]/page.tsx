import { getUserId } from "@/lib/auth";
import { and, asc, eq } from "drizzle-orm";
import { CheckCircle2, Lock, PlayCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arabic, Card, Eyebrow, formatDuration, ProgressBar } from "@/components/dashboard/ui";
import { db } from "@/db";
import { lessonProgress, lessons, programmes } from "@/db/schema";
import { getProgrammeAccess } from "@/lib/access";
import type { ProgrammeSlug } from "@/lib/catalogue";

export default async function ProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const userId = await getUserId();
  if (!userId) notFound();

  const programme = await db.query.programmes.findFirst({ where: eq(programmes.slug, slug) });
  if (!programme) notFound();

  const [lessonRows, progressRows, access] = await Promise.all([
    db.select().from(lessons).where(eq(lessons.programmeId, programme.id)).orderBy(asc(lessons.position)),
    db
      .select({ lessonId: lessonProgress.lessonId, completedAt: lessonProgress.completedAt, pos: lessonProgress.lastPositionSec })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .where(and(eq(lessonProgress.userId, userId), eq(lessons.programmeId, programme.id))),
    getProgrammeAccess(db, userId),
  ]);

  const hasAccess = access[programme.slug as ProgrammeSlug]?.hasAccess ?? false;
  const progress = new Map(progressRows.map((p) => [p.lessonId, p]));
  const done = progressRows.filter((p) => p.completedAt).length;

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Programme</Eyebrow>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{programme.titleEn}</h1>
        <Arabic className="mt-1 block text-xl text-slate-300">{programme.titleAr}</Arabic>
        <p className="mt-3 max-w-2xl text-slate-400">{programme.description}</p>
        <div className="mt-5 max-w-md">
          <ProgressBar value={done} max={lessonRows.length} />
          <p className="mt-1.5 text-xs text-slate-400">
            {done} of {lessonRows.length} lessons completed
          </p>
        </div>
      </header>

      <Card className="p-2 sm:p-2">
        <ol className="divide-y divide-white/5">
          {lessonRows.map((l) => {
            const p = progress.get(l.id);
            const unlocked = hasAccess || l.isPreview;
            const Icon = p?.completedAt ? CheckCircle2 : unlocked ? PlayCircle : Lock;
            return (
              <li key={l.id}>
                <Link
                  href={`/dashboard/lessons/${l.id}`}
                  className="flex items-center gap-4 rounded-xl px-3 py-4 transition hover:bg-white/5"
                >
                  <span className="w-6 text-center text-sm font-semibold text-slate-500">{l.position}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{l.titleEn}</p>
                    <Arabic className="text-slate-300">{l.titleAr}</Arabic>
                  </div>
                  {l.isPreview && !hasAccess ? (
                    <span className="hidden rounded-full bg-dusk/15 px-2.5 py-0.5 text-xs font-semibold text-dusk sm:inline">
                      Preview
                    </span>
                  ) : null}
                  <span className="hidden text-sm text-slate-400 sm:inline">{formatDuration(l.durationSec)}</span>
                  <Icon
                    className={
                      p?.completedAt ? "size-5 text-amber" : unlocked ? "size-5 text-slate-300" : "size-5 text-slate-500"
                    }
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
