import { AlertTriangle, ArrowRight, BookOpen, Gift, Lock, Play } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Arabic, Card, Eyebrow, formatDate, ProgressBar, StatusBadge } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { getDashboardData, type DashboardData } from "@/lib/dashboard";
import { getOrCreateUser } from "@/lib/users";

export default async function DashboardPage() {
  const user = await getOrCreateUser(db);
  if (!user) redirect("/sign-in");

  const data = await getDashboardData(db, user.id);
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <header>
        <Eyebrow>Dashboard</Eyebrow>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Assalāmu ʿalaykum{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 text-slate-400">Pick up where you left off, or start something new.</p>
      </header>

      {data.billing.graceUntil ? <PaymentBanner until={data.billing.graceUntil} /> : null}
      {data.continueWatching ? <ContinueWatching item={data.continueWatching} /> : null}

      <section>
        <h2 className="mb-4 text-xl font-bold tracking-tight text-white">My programmes</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {data.programmeCards.map((p) => (
            <ProgrammeCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <BillingCard billing={data.billing} />
    </div>
  );
}

function PaymentBanner({ until }: { until: Date }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-amber-100 sm:flex-row sm:items-center">
      <AlertTriangle className="size-5 shrink-0 text-amber" />
      <p className="flex-1 text-sm">
        Your last payment didn&apos;t go through. Your access continues until{" "}
        <span className="font-semibold text-white">{formatDate(until)}</span>.
      </p>
      <Link href="/dashboard/billing" className="inline-flex items-center gap-1 text-sm font-semibold text-amber hover:underline">
        Update your card <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function ContinueWatching({ item }: { item: NonNullable<DashboardData["continueWatching"]> }) {
  const { lesson, programme, progress } = item;
  return (
    <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <Link
        href={`/dashboard/lessons/${lesson.id}`}
        className="relative flex aspect-video w-full shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-midnight ring-1 ring-white/10 sm:w-56"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber text-midnight shadow-[0_20px_50px_-10px_rgba(237,140,68,0.65)] transition hover:scale-110">
          <Play className="ml-0.5 size-6 fill-current" />
        </span>
      </Link>
      <div className="min-w-0 flex-1">
        <Eyebrow>Continue watching</Eyebrow>
        <h3 className="mt-1 text-lg font-bold text-white">{lesson.titleEn}</h3>
        <p className="text-slate-300">
          <Arabic>{lesson.titleAr}</Arabic> · <span className="text-slate-400">{programme.titleEn}</span>
        </p>
        <div className="mt-3">
          <ProgressBar value={progress.lastPositionSec} max={lesson.durationSec} />
        </div>
      </div>
      <Button asChild className="h-11 px-6">
        <Link href={`/dashboard/lessons/${lesson.id}`}>Resume</Link>
      </Button>
    </Card>
  );
}

function ProgrammeCard({ p }: { p: DashboardData["programmeCards"][number] }) {
  const isBundle = p.access.sources.length > 0 && p.access.sources.every((s) => s === "bundle");
  const badge = !p.access.hasAccess ? (
    <StatusBadge kind="locked">Locked</StatusBadge>
  ) : p.access.status === "grace" ? (
    <StatusBadge kind="grace">Payment due</StatusBadge>
  ) : isBundle ? (
    <StatusBadge kind="free">Included free</StatusBadge>
  ) : (
    <StatusBadge kind="active">Active</StatusBadge>
  );

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber/30 bg-amber/15 text-amber">
          {p.slug === "usool" ? <Gift className="size-5" /> : <BookOpen className="size-5" />}
        </div>
        {badge}
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{p.titleEn}</h3>
      <Arabic className="text-slate-300">{p.titleAr}</Arabic>
      <p className="mt-2 flex-1 text-sm text-slate-400">{p.description}</p>
      <div className="mt-4">
        <ProgressBar value={p.completedLessons} max={p.totalLessons} />
        <p className="mt-1.5 text-xs text-slate-400">
          {p.completedLessons} of {p.totalLessons} lessons
        </p>
      </div>
      <div className="mt-5">
        {p.access.hasAccess ? (
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/dashboard/programmes/${p.slug}`}>Open</Link>
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button asChild variant="secondary" className="flex-1">
              <Link href={`/dashboard/programmes/${p.slug}`}>Preview</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href="/pricing">
                <Lock className="size-4" /> Unlock
              </Link>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function BillingCard({ billing }: { billing: DashboardData["billing"] }) {
  const empty = !billing.hasLifetime && billing.subscriptions.length === 0;
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Eyebrow>Billing</Eyebrow>
          {empty ? (
            <p className="mt-2 text-slate-300">No active plan yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-slate-200">
              {billing.hasLifetime ? <li className="font-semibold text-white">Lifetime access</li> : null}
              {billing.subscriptions.map((s) => (
                <li key={s.id}>
                  <span className="font-semibold text-white">{s.name}</span>{" "}
                  <span className="text-sm text-slate-400">
                    {s.cancelAtPeriodEnd ? "ends" : "renews"} on{" "}
                    {s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "-"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button asChild variant={empty ? "default" : "secondary"}>
          <Link href={empty ? "/pricing" : "/dashboard/billing"}>{empty ? "View plans" : "Manage billing"}</Link>
        </Button>
      </div>
    </Card>
  );
}
