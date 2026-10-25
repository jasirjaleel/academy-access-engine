import { and, eq, sql } from "drizzle-orm";
import { entitlements, programmes, type Entitlement } from "@/db/schema";
import type { Database } from "@/db/types";
import type { ProgrammeSlug } from "@/lib/catalogue";

export async function programmeIdBySlug(tx: Database, slug: ProgrammeSlug): Promise<string> {
  const row = await tx.query.programmes.findFirst({ where: eq(programmes.slug, slug) });
  if (!row) throw new Error(`Programme ${slug} is not seeded`);
  return row.id;
}

type Key = {
  userId: string;
  slug: ProgrammeSlug;
  source: Entitlement["source"];
  sourceRef: string;
};

/** Grant (or re-grant) access: active, no grace, no revoke reason. */
export async function grantEntitlement(tx: Database, key: Key) {
  const programmeId = await programmeIdBySlug(tx, key.slug);
  await tx
    .insert(entitlements)
    .values({
      userId: key.userId,
      programmeId,
      source: key.source,
      sourceRef: key.sourceRef,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [entitlements.userId, entitlements.programmeId, entitlements.source, entitlements.sourceRef],
      set: { status: "active", graceUntil: null, revokedReason: null, updatedAt: sql`now()` },
    });
}

/** Revoke an existing entitlement. Returns the rows that were changed. */
export async function revokeEntitlements(
  tx: Database,
  where: { userId: string; source: Entitlement["source"]; sourceRef: string },
  reason: string,
) {
  return tx
    .update(entitlements)
    .set({ status: "revoked", revokedReason: reason, graceUntil: null, updatedAt: sql`now()` })
    .where(
      and(
        eq(entitlements.userId, where.userId),
        eq(entitlements.source, where.source),
        eq(entitlements.sourceRef, where.sourceRef),
        sql`${entitlements.status} <> 'revoked'`,
      ),
    )
    .returning();
}
