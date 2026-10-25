import { ArrowRight, Gift } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">Demo Academy</p>
      <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
        Islamic learning,{" "}
        <span className="bg-gradient-to-r from-dusk to-white bg-clip-text text-transparent">
          beautifully delivered
        </span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-200 sm:text-xl">
        Learn Arabic and the Islamic sciences, at your pace.
      </p>

      <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
        <Button asChild size="lg" className="h-12 w-full px-8 text-base sm:w-auto">
          <Link href="/pricing">
            View plans <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="h-12 w-full px-6 text-base sm:w-auto">
          <Link href="/dashboard">Student login</Link>
        </Button>
      </div>
      <p className="mt-4 text-xs font-medium text-slate-400">From $15/month • Cancel anytime</p>

      <div className="mt-14 w-full max-w-3xl rounded-3xl border border-amber/30 bg-amber/[0.08] p-6 shadow-[0_0_70px_-24px_rgba(237,140,68,0.55)] backdrop-blur-xl">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-amber/30 bg-amber/15 text-amber">
          <Gift className="size-5" />
        </div>
        <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-amber">
          Free with any programme
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
          Foundations of Knowledge{" "}
          <span dir="rtl" lang="ar" className="font-arabic text-[1.1em] font-semibold text-slate-200">
            أصول العلم
          </span>
        </h2>
        <p className="mt-2 text-sm text-slate-200 sm:text-base">
          The manners and principles every student should begin with, included with every plan.
        </p>
      </div>
    </main>
  );
}
