import { sql } from "drizzle-orm";
import { processedEvents } from "@/db/schema";
import type { Database } from "@/db/types";

export type HandlerResult = "applied" | "ignored";

type EventMeta = { id: string; provider: "stripe"; type: string };

/**
 * Runs `fn` at most once per event id (see docs/DECISIONS.md D2).
 *
 * The processed_events row is claimed inside the same transaction as the handler's
 * effects. A new event, or one whose previous attempt errored, is claimed; an event
 * already applied/ignored returns no row and is skipped. A concurrent duplicate waits
 * on the row lock and then sees the committed result.
 */
export async function withIdempotency(
  db: Database,
  meta: EventMeta,
  fn: (tx: Database) => Promise<HandlerResult>,
): Promise<{ duplicate: boolean; result?: HandlerResult }> {
  try {
    return await db.transaction(async (tx) => {
      const claimed = await tx
        .insert(processedEvents)
        .values({ id: meta.id, provider: meta.provider, type: meta.type, result: "processing" })
        .onConflictDoUpdate({
          target: processedEvents.id,
          set: { receivedAt: sql`now()`, result: "processing", error: null },
          where: sql`${processedEvents.result} = 'error'`,
        })
        .returning({ id: processedEvents.id });

      if (claimed.length === 0) return { duplicate: true };

      const result = await fn(tx);
      await tx
        .update(processedEvents)
        .set({ result })
        .where(sql`${processedEvents.id} = ${meta.id}`);
      return { duplicate: false, result };
    });
  } catch (err) {
    // The transaction rolled back; record the failure outside it so the admin log shows it
    // and the provider's retry is allowed through (result = 'error').
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    await db
      .insert(processedEvents)
      .values({ id: meta.id, provider: meta.provider, type: meta.type, result: "error", error: message })
      .onConflictDoUpdate({
        target: processedEvents.id,
        set: { result: "error", error: message, receivedAt: sql`now()` },
      });
    throw err;
  }
}
