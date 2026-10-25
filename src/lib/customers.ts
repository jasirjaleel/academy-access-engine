import "server-only";
import { eq } from "drizzle-orm";
import { users, type User } from "@/db/schema";
import type { Database } from "@/db/types";
import { getStripe } from "@/lib/stripe";

export async function getOrCreateStripeCustomer(db: Database, user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  // Idempotency key: a double click can't create two customers.
  const customer = await getStripe().customers.create(
    { email: user.email, name: user.name ?? undefined, metadata: { userId: user.id } },
    { idempotencyKey: `customer-create-${user.id}` },
  );
  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, user.id));
  return customer.id;
}
