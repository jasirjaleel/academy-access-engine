import "server-only";
import { after } from "next/server";
import { db } from "@/db";
import { dispatchPending } from "@/lib/dispatch";
import { env } from "@/lib/env";

/** Live config, or null when n8n isn't configured (the app works without it; events wait in the outbox). */
export function liveDispatchConfig() {
  if (!env.N8N_WEBHOOK_URL || !env.N8N_SIGNING_SECRET) return null;
  return { webhookUrl: env.N8N_WEBHOOK_URL, signingSecret: env.N8N_SIGNING_SECRET, appUrl: env.NEXT_PUBLIC_APP_URL };
}

/** Send right after the response (and after the transaction committed); the daily cron is the safety net. */
export function scheduleDispatch() {
  const config = liveDispatchConfig();
  if (!config) return;
  after(async () => {
    try {
      await dispatchPending(db, config);
    } catch (err) {
      console.error("outbox dispatch failed:", err instanceof Error ? err.message : err);
    }
  });
}
