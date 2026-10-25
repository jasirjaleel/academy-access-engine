import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { anonymizeUser, upsertUserFromClerk } from "@/lib/users";
import { withIdempotency } from "@/lib/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Svix keeps the same message id across retries, so it is our idempotency key.
  const svixId = req.headers.get("svix-id");
  if (!svixId) return Response.json({ error: "missing svix-id" }, { status: 400 });

  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    const { duplicate } = await withIdempotency(
      db,
      { id: svixId, provider: "clerk", type: evt.type },
      async (tx) => {
        switch (evt.type) {
          case "user.created":
          case "user.updated":
            await upsertUserFromClerk(tx, evt.data);
            return "applied";
          case "user.deleted":
            if (!evt.data.id) return "ignored";
            await anonymizeUser(tx, evt.data.id);
            return "applied";
          default:
            return "ignored";
        }
      },
    );
    return Response.json({ ok: true, duplicate });
  } catch {
    console.error(`clerk webhook failed: ${svixId} ${evt.type}`);
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
}
