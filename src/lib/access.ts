import "server-only";
import { and, eq } from "drizzle-orm";
import { entitlements, lessons, programmes, type Entitlement } from "@/db/schema";
import type { Database } from "@/db/types";
import type { ProgrammeSlug } from "@/lib/catalogue";

type EntitlementState = Pick<Entitlement, "status" | "graceUntil">;

/** The single access rule (docs/ARCHITECTURE.md → Access rule). */
export function isEntitlementLive(e: EntitlementState, now: Date): boolean {
  return e.status === "active" || (e.status === "grace" && e.graceUntil !== null && e.graceUntil > now);
}

export type ProgrammeAccess = {
  hasAccess: boolean;
  status: "active" | "grace" | "none";
  graceUntil: Date | null;
  sources: Entitlement["source"][];
};

export async function getProgrammeAccess(
  db: Database,
  userId: string,
  now = new Date(),
): Promise<Record<ProgrammeSlug, ProgrammeAccess>> {
  const rows = await db
    .select({
      slug: programmes.slug,
      source: entitlements.source,
      status: entitlements.status,
      graceUntil: entitlements.graceUntil,
    })
    .from(entitlements)
    .innerJoin(programmes, eq(programmes.id, entitlements.programmeId))
    .where(eq(entitlements.userId, userId));

  const result = {} as Record<ProgrammeSlug, ProgrammeAccess>;
  for (const slug of ["arabic", "precision", "usool"] as const) {
    const live = rows.filter((r) => r.slug === slug && isEntitlementLive(r, now));
    const active = live.some((r) => r.status === "active");
    const grace = live.filter((r) => r.status === "grace");
    result[slug] = {
      hasAccess: live.length > 0,
      status: active ? "active" : grace.length > 0 ? "grace" : "none",
      graceUntil: !active && grace.length > 0 ? grace[0].graceUntil : null,
      sources: live.map((r) => r.source),
    };
  }
  return result;
}

export async function canWatchLesson(db: Database, userId: string | null, lessonId: string, now = new Date()) {
  const [row] = await db
    .select({ lesson: lessons, programme: programmes })
    .from(lessons)
    .innerJoin(programmes, eq(programmes.id, lessons.programmeId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!row) return null;

  if (row.lesson.isPreview) return { allowed: true, reason: "preview" as const, ...row };
  if (!userId) return { allowed: false, reason: "locked" as const, ...row };

  const ents = await db
    .select({ status: entitlements.status, graceUntil: entitlements.graceUntil })
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.programmeId, row.programme.id)));
  const allowed = ents.some((e) => isEntitlementLive(e, now));
  return { allowed, reason: allowed ? ("entitled" as const) : ("locked" as const), ...row };
}
