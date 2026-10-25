import { auth } from "@clerk/nextjs/server";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { getProgrammeAccess } from "@/lib/access";
import { isProductKey, PRODUCTS } from "@/lib/catalogue";
import { getStripe } from "@/lib/stripe";
import { Refresher } from "./refresher";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { userId } = await auth();
  const { session_id } = await searchParams;
  if (!userId || !session_id) notFound();

  const session = await getStripe().checkout.sessions.retrieve(session_id).catch(() => null);
  // A student must never see someone else's checkout session.
  if (!session || session.client_reference_id !== userId) notFound();

  const productKey = session.metadata?.productKey;
  if (!isProductKey(productKey)) notFound();

  // Access is granted only by the webhook; this page just waits for it.
  const access = await getProgrammeAccess(db, userId);
  const ready = PRODUCTS[productKey].programmes.every((slug) => access[slug].hasAccess);

  return (
    <div className="mx-auto flex w-full max-w-xl items-center py-10">
      {ready ? (
        <div className="w-full rounded-3xl border border-amber/30 bg-amber/[0.08] p-8 text-center shadow-[0_0_70px_-24px_rgba(237,140,68,0.55)] backdrop-blur-xl">
          <CheckCircle2 className="mx-auto size-12 text-amber" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            Bārak Allāhu fīk, your access is ready
          </h1>
          <p className="mt-2 text-slate-300">{PRODUCTS[productKey].name} is now unlocked.</p>
          <Button asChild size="lg" className="mt-6 h-12 px-8 text-base">
            <Link href="/dashboard">
              Go to my programmes <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="w-full rounded-2xl bg-midnight-2/80 p-8 text-center ring-1 ring-white/10">
          <Loader2 className="mx-auto size-10 animate-spin text-amber" />
          <h1 className="mt-4 text-xl font-bold text-white">Setting up your access…</h1>
          <p className="mt-2 text-slate-400">Your payment went through. This usually takes a few seconds.</p>
          <Refresher />
        </div>
      )}
    </div>
  );
}
