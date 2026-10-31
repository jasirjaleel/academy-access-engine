import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { users, type User } from "@/db/schema";
import type { Database } from "@/db/types";
import { getAuthUser } from "./auth";

/** D8: keep the row for billing history, wipe personal data. */
export async function anonymizeUser(db: Database, userId: string) {
  await db
    .update(users)
    .set({
      email: `deleted+${userId}@invalid`,
      name: null,
      whatsappPhone: null,
      whatsappOptIn: false,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
}

// user_metadata is editable by the user, so the name is checked like any other input.
const fullNameSchema = z.string().trim().max(100).catch("");

/** Our row for the signed-in user, created on their first page load after sign-up. */
export async function getOrCreateUser(db: Database): Promise<User | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const existing = await db.query.users.findFirst({ where: eq(users.id, authUser.id) });
  if (existing) return existing;

  if (!authUser.email) throw new Error(`Auth user ${authUser.id} has no email address`);
  const fullName = fullNameSchema.parse(authUser.user_metadata?.full_name) || null;

  const [created] = await db
    .insert(users)
    .values({ id: authUser.id, email: authUser.email, name: fullName })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.query.users.findFirst({ where: eq(users.id, authUser.id) })) ?? null;
}
