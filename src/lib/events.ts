import { outboundEvents } from "@/db/schema";
import type { Database } from "@/db/types";

export type OutboundEventType =
  | "student.enrolled"
  | "student.inactive_3d"
  | "payment.failed"
  | "payment.recovered"
  | "subscription.cancel_scheduled"
  | "subscription.ended"
  | "access.revoked";

/**
 * Writes to the outbox inside the caller's transaction (D5). Sending happens after
 * commit (M7). The unique dedupe_key makes a repeated enqueue a no-op.
 * Payload: ids and minimal fields only, never emails or phone numbers.
 */
export async function enqueueEvent(
  tx: Database,
  event: { type: OutboundEventType; userId: string; payload: Record<string, unknown>; dedupeKey: string },
) {
  await tx
    .insert(outboundEvents)
    .values({ ...event, status: "pending" })
    .onConflictDoNothing({ target: outboundEvents.dedupeKey });
}
