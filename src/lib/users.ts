import "server-only";
import type { UserJSON } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { users, type User } from "@/db/schema";
import type { Database } from "@/db/types";

function fullName(first: string | null | undefined, last: string | null | undefined) {
  return [first, last].filter(Boolean).join(" ") || null;
}

export async function upsertUserFromClerk(db: Database, data: UserJSON) {
  const primary =
    data.email_addresses.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses[0];
  if (!primary) throw new Error(`Clerk user ${data.id} has no email address`);

  const values = {
    id: data.id,
    email: primary.email_address,
    name: fullName(data.first_name, data.last_name),
  };
  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.id,
      set: { email: values.email, name: values.name, updatedAt: sql`now()` },
    });
}

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

/** For pages: the webhook may not have arrived yet right after sign-up. */
export async function getOrCreateUser(db: Database): Promise<User | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const existing = await db.query.users.findFirst({ where: eq(users.id, clerkUser.id) });
  if (existing) return existing;

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error(`Clerk user ${clerkUser.id} has no email address`);

  const [created] = await db
    .insert(users)
    .values({ id: clerkUser.id, email, name: fullName(clerkUser.firstName, clerkUser.lastName) })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.query.users.findFirst({ where: eq(users.id, clerkUser.id) })) ?? null;
}
