"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { saveProgress } from "@/lib/progress";

const input = z.object({
  lessonId: z.uuid(),
  positionSec: z.number().min(0).max(24 * 3600),
  completed: z.boolean(),
});

export async function saveProgressAction(lessonId: string, positionSec: number, completed: boolean) {
  // The user id always comes from the session, never from the client.
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const parsed = input.parse({ lessonId, positionSec, completed });
  await saveProgress(db, userId, parsed.lessonId, parsed);
}
