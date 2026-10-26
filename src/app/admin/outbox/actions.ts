"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requeueOutboxEvents } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { dispatchPending } from "@/lib/dispatch";
import { liveDispatchConfig } from "@/lib/dispatch-live";

/** Admin-only: re-queue and send now. */
export async function retryOutbox(target: string): Promise<{ message: string }> {
  await requireAdmin();
  const ids = target === "all-failed" ? "all-failed" : [z.uuid().parse(target)];
  const requeued = await requeueOutboxEvents(db, ids);
  if (requeued === 0) return { message: "Nothing to retry." };

  const config = liveDispatchConfig();
  if (!config) {
    revalidatePath("/admin/outbox");
    return { message: `Re-queued ${requeued}. n8n isn't configured, so they'll wait in the queue.` };
  }
  const r = await dispatchPending(db, config, 100);
  revalidatePath("/admin/outbox");
  revalidatePath("/admin");
  return { message: `Re-queued ${requeued}: ${r.sent} sent, ${r.retried} will retry, ${r.failed} failed.` };
}
