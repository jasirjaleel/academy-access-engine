import { and, eq, inArray, sql } from "drizzle-orm";
import { entitlements } from "@/db/schema";
import type { Database } from "@/db/types";
import { BUNDLE_PROGRAMME } from "@/lib/catalogue";
import { grantEntitlement, programmeIdBySlug } from "./entitlements";

/** The free programme exists exactly while the user has any live paid access. */
export async function syncBundle(tx: Database, userId: string, now: Date) {
  const paid = await tx
    .select({ status: entitlements.status, graceUntil: entitlements.graceUntil })
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), inArray(entitlements.source, ["subscription", "lifetime"])));

  const hasPaidAccess = paid.some(
    (e) => e.status === "active" || (e.status === "grace" && e.graceUntil !== null && e.graceUntil > now),
  );

  if (hasPaidAccess) {
    await grantEntitlement(tx, { userId, slug: BUNDLE_PROGRAMME, source: "bundle", sourceRef: "bundle" });
    return;
  }

  const programmeId = await programmeIdBySlug(tx, BUNDLE_PROGRAMME);
  await tx
    .update(entitlements)
    .set({ status: "revoked", revokedReason: "no_paid_access", updatedAt: sql`now()` })
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.programmeId, programmeId),
        eq(entitlements.source, "bundle"),
        sql`${entitlements.status} <> 'revoked'`,
      ),
    );
}
