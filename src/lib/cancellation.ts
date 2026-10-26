import "server-only";
import { and, eq } from "drizzle-orm";
import { cancellationFeedback } from "@/db/schema";
import type { Database } from "@/db/types";

import type { CancelReason, RetentionOffer } from "./cancel-reasons";

export { CANCEL_REASONS, type CancelReason, type RetentionOffer } from "./cancel-reasons";

/** One tailored offer per reason, and each offer only once per subscription. */
export async function offerFor(db: Database, userId: string, subscriptionId: string, reason: CancelReason): Promise<RetentionOffer> {
  const offer: RetentionOffer =
    reason === "too_expensive" ? "discount" : reason === "no_time" || reason === "taking_break" ? "pause" : null;
  if (!offer) return null;

  const usedBefore = await db.query.cancellationFeedback.findFirst({
    where: and(
      eq(cancellationFeedback.userId, userId),
      eq(cancellationFeedback.subscriptionId, subscriptionId),
      eq(cancellationFeedback.offerShown, offer),
      eq(cancellationFeedback.offerAccepted, true),
    ),
  });
  return usedBefore ? null : offer;
}

export const DISCOUNT_COUPON = "STAY30";
export const PAUSE_DAYS = 30;
