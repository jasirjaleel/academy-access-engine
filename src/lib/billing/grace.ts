import { and, eq, lt, sql } from "drizzle-orm";
import { entitlements } from "@/db/schema";
import type { Database } from "@/db/types";
import { enqueueEvent } from "@/lib/events";
import { syncBundle } from "./bundle";

/** Daily job: grace periods that ran out become revoked. Safe to run repeatedly. */
export async function expireGrace(db: Database, now = new Date()): Promise<number> {
  const expired = await db
    .select({ id: entitlements.id, userId: entitlements.userId })
    .from(entitlements)
    .where(and(eq(entitlements.status, "grace"), lt(entitlements.graceUntil, now)));

  for (const e of expired) {
    await db.transaction(async (tx) => {
      // Re-check inside the transaction: a payment may have just recovered it.
      const [revoked] = await tx
        .update(entitlements)
        .set({ status: "revoked", revokedReason: "payment_failed", graceUntil: null, updatedAt: sql`now()` })
        .where(and(eq(entitlements.id, e.id), eq(entitlements.status, "grace"), lt(entitlements.graceUntil, now)))
        .returning({ id: entitlements.id });
      if (!revoked) return;

      await syncBundle(tx, e.userId, now);
      await enqueueEvent(tx, {
        type: "access.revoked",
        userId: e.userId,
        payload: { entitlementId: e.id, reason: "payment_failed" },
        dedupeKey: `revoked:${e.id}`,
      });
    });
  }
  return expired.length;
}
