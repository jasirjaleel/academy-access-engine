import { db } from "@/db";
import { expireGrace } from "@/lib/billing/grace";
import { scheduleDispatch } from "@/lib/dispatch-live";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: Request) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const expired = await expireGrace(db);
  if (expired > 0) scheduleDispatch();
  return Response.json({ ok: true, expired });
}
