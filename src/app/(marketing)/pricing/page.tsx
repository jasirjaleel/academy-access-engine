import { Check, Gift } from "lucide-react";
import { CanceledToast } from "./canceled-toast";
import { CheckoutButton } from "@/components/checkout-button";

const lifetimeTicks = [
  "Both programmes, Arabic and Precision in Knowledge",
  "Every current lesson, yours to keep",
  "One payment. No renewals, no monthly bills",
];

const monthly = [
  {
    key: "arabic_monthly" as const,
    title: "Arabic Programme",
    titleAr: "البرنامج العربي",
    tagline: "From the alphabet to fluency",
    price: 30,
  },
  {
    key: "precision_monthly" as const,
    title: "Precision in Knowledge",
    titleAr: "الدقة في العلم",
    tagline: "Classical Islamic sciences",
    price: 15,
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-16 sm:px-6 sm:pt-20">
      {canceled ? <CanceledToast /> : null}

      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">Choose your path</p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
          Invest in your{" "}
          <span className="bg-gradient-to-r from-dusk to-white bg-clip-text text-transparent">future</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          Own every programme for life with one payment, or subscribe to just one.
        </p>
      </div>

      <section className="mt-12 rounded-3xl border border-amber/30 bg-amber/[0.08] p-6 shadow-[0_0_70px_-24px_rgba(237,140,68,0.55)] backdrop-blur-xl sm:p-8">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">Lifetime access · Best value</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Own everything. Forever.</h2>
            <ul className="mt-5 space-y-2.5">
              {lifetimeTicks.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-slate-200">
                  <Check className="mt-0.5 size-4 shrink-0 text-amber" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:w-64">
            <p className="text-4xl font-bold text-white">
              $999 <span className="text-base font-medium text-slate-400">one-time</span>
            </p>
            <div className="mt-4">
              <CheckoutButton productKey="lifetime" label="Get lifetime access" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber/20 bg-amber/[0.05] p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber/30 bg-amber/15 text-amber">
          <Gift className="size-5" />
        </div>
        <p className="text-sm text-slate-200">
          <span className="font-semibold text-white">Free with any plan:</span> Foundations of Knowledge{" "}
          <span dir="rtl" lang="ar" className="font-arabic text-[1.1em]">
            أصول العلم
          </span>
        </p>
      </div>

      <h2 className="mt-14 text-center text-2xl font-bold tracking-tight text-white">Prefer to pay monthly?</h2>
      <p className="mt-2 text-center text-slate-400">Subscribe to a single programme. Upgrade to lifetime anytime.</p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {monthly.map((m) => (
          <div
            key={m.key}
            className="flex flex-col rounded-2xl bg-midnight-2/80 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">Programme</p>
            <h3 className="mt-2 text-xl font-bold text-white">
              {m.title}{" "}
              <span dir="rtl" lang="ar" className="font-arabic text-[1.1em] font-semibold text-slate-300">
                {m.titleAr}
              </span>
            </h3>
            <p className="mt-1 text-slate-400">{m.tagline}</p>
            <p className="mt-5 text-3xl font-bold text-white">
              ${m.price}
              <span className="text-base font-medium text-slate-400">/month</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">Includes Foundations of Knowledge free</p>
            <div className="mt-6">
              <CheckoutButton productKey={m.key} label="Join monthly" variant="secondary" />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-400">
        Regional pricing available: use code <span className="font-semibold text-amber">REGION40</span> at checkout.
      </p>
    </main>
  );
}
