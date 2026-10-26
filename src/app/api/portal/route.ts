import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getOrCreateUser } from "@/lib/users";

export const runtime = "nodejs";

/** Opens Stripe's Billing Portal (update card, invoices). Cancelling uses our own flow (M6). */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Please sign in first." }, { status: 401 });

  const user = await getOrCreateUser(db);
  if (!user?.stripeCustomerId) {
    return Response.json({ error: "You don't have any billing details yet." }, { status: 404 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });
  return Response.json({ url: session.url });
}
