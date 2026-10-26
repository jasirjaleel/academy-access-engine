import { db } from "@/db";
import { dispatchPending } from "@/lib/dispatch";
import { liveDispatchConfig } from "@/lib/dispatch-live";
import { env } from "@/lib/env";
import { enqueueInactiveNudges } from "@/lib/nudges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily safety net: queue inactivity nudges, then retry anything due in the outbox.
export async function GET(req: Request) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const nudged = await enqueueInactiveNudges(db);
  const config = liveDispatchConfig();
  const dispatched = config ? await dispatchPending(db, config, 100) : { skipped: "n8n not configured" };
  return Response.json({ ok: true, nudged, dispatched });
}
