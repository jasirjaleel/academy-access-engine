// Removes old manual test accounts (and everything they own) from the app database.
// Dry run by default: lists what would be deleted. Add --confirm to delete.
// Usage:
//   npx tsx scripts/remove-test-accounts.ts old-test@example.com
//   npx tsx scripts/remove-test-accounts.ts old-test@example.com --confirm
// Delete the same people in Supabase (Authentication → Users) yourself; this only touches our tables.
import { config } from "dotenv";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/db/schema";

config({ path: ".env.local", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const emails = args.filter((a) => a.includes("@"));
  if (emails.length === 0) throw new Error("Pass the email addresses of the accounts to remove.");
  if (emails.some((e) => e.endsWith("@demo.academy.test"))) throw new Error("Refusing to remove demo students; use scripts/seed-demo.ts.");

  const client = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const db = drizzle(client, { schema: s });
  try {
    const users = await db.select().from(s.users).where(inArray(s.users.email, emails));
    if (users.length === 0) return console.log("No matching accounts.");
    const ids = users.map((u) => u.id);

    const counts = {
      entitlements: (await db.select().from(s.entitlements).where(inArray(s.entitlements.userId, ids))).length,
      subscriptions: (await db.select().from(s.subscriptions).where(inArray(s.subscriptions.userId, ids))).length,
      invoices: (await db.select().from(s.invoices).where(inArray(s.invoices.userId, ids))).length,
      lessonProgress: (await db.select().from(s.lessonProgress).where(inArray(s.lessonProgress.userId, ids))).length,
      messages: (await db.select().from(s.outboundEvents).where(inArray(s.outboundEvents.userId, ids))).length,
      cancellationFeedback: (await db.select().from(s.cancellationFeedback).where(inArray(s.cancellationFeedback.userId, ids))).length,
    };
    console.log("Accounts:", users.map((u) => `${u.email} (${u.id})`).join(", "));
    console.log("Rows they own:", counts);

    if (!confirm) return console.log("\nDry run: nothing deleted. Re-run with --confirm to delete.");

    await db.transaction(async (tx) => {
      await tx.delete(s.outboundEvents).where(inArray(s.outboundEvents.userId, ids));
      await tx.delete(s.cancellationFeedback).where(inArray(s.cancellationFeedback.userId, ids));
      await tx.delete(s.lessonProgress).where(inArray(s.lessonProgress.userId, ids));
      await tx.delete(s.invoices).where(inArray(s.invoices.userId, ids));
      await tx.delete(s.entitlements).where(inArray(s.entitlements.userId, ids));
      await tx.delete(s.subscriptions).where(inArray(s.subscriptions.userId, ids));
      await tx.delete(s.users).where(inArray(s.users.id, ids));
    });
    console.log(`\nDeleted ${users.length} account(s) and their data.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
