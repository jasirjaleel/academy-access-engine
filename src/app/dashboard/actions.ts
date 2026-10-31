"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

const nameSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name.").max(50),
  lastName: z.string().trim().max(50).optional().default(""),
});

export type SaveNameState = { error?: string } | undefined;

export async function saveNameAction(_prev: SaveNameState, formData: FormData): Promise<SaveNameState> {
  const userId = await getUserId();
  if (!userId) return { error: "Please sign in again." };

  const parsed = nameSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your name." };
  const { firstName, lastName } = parsed.data;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  // Keep the auth profile and our row in step.
  const supabase = await createSupabaseServer();
  await supabase.auth.updateUser({ data: { full_name: fullName } });
  await db
    .update(users)
    .set({ name: fullName, updatedAt: sql`now()` })
    .where(eq(users.id, userId));

  revalidatePath("/dashboard");
  return undefined;
}
