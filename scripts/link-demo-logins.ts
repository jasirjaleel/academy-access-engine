// Connects demo data to real Clerk logins (created by hand in the Clerk dashboard).
//  - Moves a demo student's rows (plan, progress, invoices, messages...) onto their Clerk user id.
//  - Gives the admin login publicMetadata.role = "admin".
// Dry run by default; add --confirm to apply.
// Usage: npx tsx scripts/link-demo-logins.ts [--confirm]
import { createClerkClient } from "@clerk/backend";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/db/schema";

config({ path: ".env.local", quiet: true });

const STUDENT_LINKS = [{ demoId: "demo_aisha", email: "aisha+clerk_test@demo.academy" }];
const ADMIN_EMAILS = ["admin+clerk_test@demo.academy"];

const confirm = process.argv.includes("--confirm");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function clerkUserByEmail(email: string) {
  const { data } = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  return data[0] ?? null;
}

async function main() {
  const client = postgres(
    process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!,
    { prepare: false, max: 1 },
  );
  const db = drizzle(client, { schema: s });
  try {
    for (const { demoId, email } of STUDENT_LINKS) {
      const login = await clerkUserByEmail(email);
      if (!login) {
        console.log(
          `✗ ${email}: no Clerk user yet (create it in Clerk → Users → Create user)`,
        );
        continue;
      }
      const demo = await db.query.users.findFirst({
        where: eq(s.users.id, demoId),
      });
      if (!demo) {
        const linked = await db.query.users.findFirst({
          where: eq(s.users.id, login.id),
        });
        console.log(
          linked
            ? `✓ ${email}: already linked (${login.id})`
            : `✗ ${email}: no ${demoId} data (run scripts/seed-demo.ts first)`,
        );
        continue;
      }
      console.log(
        `→ ${email}: move ${demoId} data onto Clerk user ${login.id}`,
      );
      if (!confirm) continue;

      await db.transaction(async (tx) => {
        // If the login already opened the app, an empty row exists; it has no data worth keeping.
        const existing = await tx.query.users.findFirst({
          where: eq(s.users.id, login.id),
        });
        if (existing) {
          await tx
            .delete(s.outboundEvents)
            .where(eq(s.outboundEvents.userId, login.id));
          await tx
            .delete(s.lessonProgress)
            .where(eq(s.lessonProgress.userId, login.id));
          await tx.delete(s.users).where(eq(s.users.id, login.id));
        }
        await tx.insert(s.users).values({
          ...demo,
          id: login.id,
          email,
          name:
            [login.firstName, login.lastName].filter(Boolean).join(" ") ||
            demo.name,
        });
        const move = { userId: login.id };
        await tx
          .update(s.entitlements)
          .set(move)
          .where(eq(s.entitlements.userId, demoId));
        await tx
          .update(s.subscriptions)
          .set(move)
          .where(eq(s.subscriptions.userId, demoId));
        await tx
          .update(s.invoices)
          .set(move)
          .where(eq(s.invoices.userId, demoId));
        await tx
          .update(s.lessonProgress)
          .set(move)
          .where(eq(s.lessonProgress.userId, demoId));
        await tx
          .update(s.outboundEvents)
          .set(move)
          .where(eq(s.outboundEvents.userId, demoId));
        await tx
          .update(s.cancellationFeedback)
          .set(move)
          .where(eq(s.cancellationFeedback.userId, demoId));
        await tx.delete(s.users).where(eq(s.users.id, demoId));
      });
      console.log(`  ✓ linked`);
    }

    for (const email of ADMIN_EMAILS) {
      const login = await clerkUserByEmail(email);
      if (!login) {
        console.log(`✗ ${email}: no Clerk user yet`);
        continue;
      }
      if (login.publicMetadata.role === "admin") {
        console.log(`✓ ${email}: already admin`);
        continue;
      }
      console.log(`→ ${email}: set role = admin (${login.id})`);
      if (confirm) {
        await clerk.users.updateUserMetadata(login.id, {
          publicMetadata: { role: "admin" },
        });
        console.log(`  ✓ admin`);
      }
    }
    if (!confirm)
      console.log(
        "\nDry run: nothing changed. Re-run with --confirm to apply.",
      );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
