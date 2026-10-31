import { getUserId } from "@/lib/auth";
import { and, asc, eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Arabic, Eyebrow } from "@/components/dashboard/ui";
import { LockedLesson } from "@/components/locked-lesson";
import { db } from "@/db";
import { lessonProgress, lessons } from "@/db/schema";
import { canWatchLesson } from "@/lib/access";
import { LessonPlayer } from "./player";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const userId = await getUserId();
  const check = await canWatchLesson(db, userId, id);
  if (!check) notFound();
  const { lesson, programme, allowed } = check;

  const [siblings, progress] = await Promise.all([
    db
      .select({ id: lessons.id, position: lessons.position })
      .from(lessons)
      .where(eq(lessons.programmeId, programme.id))
      .orderBy(asc(lessons.position)),
    allowed && userId
      ? db.query.lessonProgress.findFirst({
          where: and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lesson.id)),
        })
      : Promise.resolve(undefined),
  ]);
  const idx = siblings.findIndex((s) => s.id === lesson.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>
          Lesson {lesson.position} · {programme.titleEn}
        </Eyebrow>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{lesson.titleEn}</h1>
        <Arabic className="mt-1 block text-xl text-slate-300">{lesson.titleAr}</Arabic>
      </header>

      {allowed ? (
        <LessonPlayer
          lessonId={lesson.id}
          videoUrl={lesson.videoUrl}
          startAt={progress?.lastPositionSec ?? 0}
          initiallyCompleted={Boolean(progress?.completedAt)}
        />
      ) : (
        // Locked: the video URL is never sent to the browser.
        <LockedLesson programmeTitle={programme.titleEn} />
      )}

      <nav className="flex justify-between gap-3">
        {prev ? (
          <Link href={`/dashboard/lessons/${prev.id}`} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white">
            <ChevronLeft className="size-4" /> Previous lesson
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/dashboard/lessons/${next.id}`} className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white">
            Next lesson <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
