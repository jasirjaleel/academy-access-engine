import { PricingPlans } from "@/components/pricing-plans";
import { CanceledToast } from "./canceled-toast";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-16 sm:px-6 sm:pt-20">
      {canceled ? <CanceledToast /> : null}

      <div className="mb-12 text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">Choose your path</p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
          Invest in your{" "}
          <span className="bg-gradient-to-r from-dusk to-white bg-clip-text text-transparent">future</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          Own every programme for life with one payment, or subscribe to just one.
        </p>
      </div>

      <PricingPlans />
    </main>
  );
}
