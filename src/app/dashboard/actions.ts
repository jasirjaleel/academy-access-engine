"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

const nameSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name.").max(50),
  lastName: z.string().trim().max(50).optional().default(""),
});

export type SaveNameState = { error?: string } | undefined;

export async function saveNameAction(_prev: SaveNameState, formData: FormData): Promise<SaveNameState> {
  const { userId } = await auth();
  if (!userId) return { error: "Please sign in again." };

  const parsed = nameSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your name." };
  const { firstName, lastName } = parsed.data;

  // Clerk is the source of truth; keep our copy in step (the user.updated webhook does the same once deployed).
  const client = await clerkClient();
  await client.users.updateUser(userId, { firstName, lastName: lastName || undefined });
  await db
    .update(users)
    .set({ name: [firstName, lastName].filter(Boolean).join(" "), updatedAt: sql`now()` })
    .where(eq(users.id, userId));

  revalidatePath("/dashboard");
  return undefined;
}
