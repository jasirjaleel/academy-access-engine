import { redirect } from "next/navigation";
import { CanceledToast } from "@/app/(marketing)/pricing/canceled-toast";
import { Eyebrow } from "@/components/dashboard/ui";
import { PricingPlans } from "@/components/pricing-plans";
import { db } from "@/db";
import { getProgrammeAccess } from "@/lib/access";
import { getOrCreateUser } from "@/lib/users";

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ canceled?: string }> }) {
  const user = await getOrCreateUser(db);
  if (!user) redirect("/sign-in");
  const { canceled } = await searchParams;

  const access = await getProgrammeAccess(db, user.id);
  const lifetime = Object.values(access).some((a) => a.sources.includes("lifetime"));
  const subscribed = (["arabic", "precision"] as const).filter((slug) => access[slug].sources.includes("subscription"));

  return (
    <div>
      {canceled ? <CanceledToast /> : null}
      <header className="mb-8">
        <Eyebrow>Plans &amp; upgrades</Eyebrow>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Grow your learning</h1>
        <p className="mt-2 text-slate-400">
          {lifetime
            ? "You own lifetime access to everything. Bārak Allāhu fīk."
            : "Add a programme, or switch to lifetime and never pay again."}
        </p>
      </header>
      <PricingPlans owned={{ lifetime, subscribed: [...subscribed] }} />
    </div>
  );
}
