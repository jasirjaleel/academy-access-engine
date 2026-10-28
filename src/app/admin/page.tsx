import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  ExternalLink,
  Info,
  RotateCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { OverviewChart } from "@/components/admin/overview-chart";
import { RetryButton } from "@/components/admin/retry-button";
import { StudentsTable } from "@/components/admin/students-table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { db } from "@/db";
import { formatMoney } from "@/lib/admin";
import { getAdminDashboard } from "@/lib/admin-dashboard";
import { requireAdmin } from "@/lib/auth";
import { getAdminUserIds } from "@/lib/staff";
import { cn } from "@/lib/utils";

function Delta({ change }: { change: number | null }) {
  if (change === null)
    return (
      <span className="rounded-full bg-dusk/15 px-2 py-0.5 text-xs font-semibold text-dusk">
        new
      </span>
    );
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        up ? "text-emerald-300" : "text-red-300",
      )}
    >
      {up ? "+" : ""}
      {change > 999 ? ">999" : change}% <Icon className="size-3.5" />
    </span>
  );
}

function Kpi({
  label,
  value,
  delta,
  hint,
  tone,
  info,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  hint: string;
  tone?: "warn" | "good";
  /** One-sentence plain-language definition shown on the ⓘ icon. */
  info: string;
}) {
  return (
    <div className="rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10">
      <div className="flex items-center gap-1.5">
        <p className="text-sm text-slate-400">{label}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`What is ${label}?`}
              className="text-slate-500 hover:text-amber"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs leading-relaxed">
            {info}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p
          className={cn(
            "text-3xl font-bold tabular-nums text-white",
            tone === "warn" && "text-amber",
            tone === "good" && "text-emerald-300",
          )}
        >
          {value}
        </p>
        {delta}
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function StatusRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0">
      <span className="flex items-center gap-2 text-sm text-slate-300">
        <span
          className={cn(
            "size-2 rounded-full",
            ok
              ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
              : "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]",
          )}
        />
        {label}
      </span>
      <span className="text-right text-sm font-medium text-white">
        {detail}
      </span>
    </div>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const d = await getAdminDashboard(db, new Date(), {
    excludeUserIds: await getAdminUserIds(),
  });
  const { kpis, status, mix } = d;
  const mixTotal = Math.max(1, mix.lifetime + mix.monthly + mix.none);
  const lastHook = status.lastWebhookAt
    ? status.lastWebhookAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "None yet";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">
            Admin console
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Overview
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Last 30 days, compared with the 30 days before.
          </p>
        </div>
        <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 ring-1 ring-white/10">
          Updated{" "}
          {new Date().toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label="Paying students"
          value={String(kpis.payingStudents.value)}
          delta={<Delta change={kpis.payingStudents.change} />}
          hint={`vs 30 days ago · ${kpis.uniqueLearners30d} studied this month`}
          info="Students who have paid access right now: active subscribers, lifetime owners, plus anyone in a grace period or cancelling but not yet ended."
        />
        <Kpi
          label="MRR"
          value={formatMoney(kpis.mrr.cents)}
          delta={<Delta change={kpis.mrr.change} />}
          hint={`${kpis.mrr.subscriptions} monthly subscription(s) · vs 30 days ago`}
          info="Monthly Recurring Revenue: what all live monthly subscriptions bring in every month if nothing changes. Lifetime purchases are one-off, so they are not included."
        />
        <Kpi
          label="Revenue (30 days)"
          value={formatMoney(kpis.revenue30d.cents)}
          delta={<Delta change={kpis.revenue30d.change} />}
          hint={`${formatMoney(kpis.revenue30d.lifetimeCents)} lifetime · ${formatMoney(kpis.revenue30d.monthlyCents)} monthly`}
          info="Cash actually collected in the last 30 days: lifetime purchases plus every monthly payment (new and renewals). Refunded payments are excluded."
        />
        <Kpi
          label="Revenue at risk"
          value={formatMoney(kpis.atRisk.cents)}
          tone={kpis.atRisk.cents > 0 ? "warn" : undefined}
          hint={`${kpis.atRisk.invoices} unpaid invoice(s) in grace`}
          info="Monthly payments that failed and are still unpaid. These students keep access for 7 days while we remind them to update their card."
        />
        <Kpi
          label="Recovered (30 days)"
          value={formatMoney(kpis.recovered30d.cents)}
          tone={kpis.recovered30d.cents > 0 ? "good" : undefined}
          hint={`${kpis.recovered30d.invoices} payment(s) saved after failing`}
          info="Payments that failed at first but were paid later (card updated or retry worked): money the reminders won back."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <OverviewChart data={d.series} />

        <div className="space-y-4">
          <div className="rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10">
            <h2 className="text-lg font-bold text-white">System status</h2>
            <p className="text-sm text-slate-400">Payments and messages</p>
            <div className="mt-3">
              <StatusRow
                ok={status.webhookErrors24h === 0}
                label="Stripe webhooks"
                detail={`${status.webhooks24h} in 24 h · ${status.webhookErrors24h} errors`}
              />
              <StatusRow
                ok={status.outboxFailed === 0}
                label="Messages to n8n"
                detail={`${status.outboxPending} waiting · ${status.outboxFailed} failed`}
              />
              <StatusRow
                ok={status.inGrace === 0}
                label="Students in grace"
                detail={String(status.inGrace)}
              />
              <StatusRow ok label="Last webhook" detail={lastHook} />
            </div>
          </div>
          <div className="rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10">
            <h2 className="text-lg font-bold text-white">Quick actions</h2>
            <div className="mt-3 flex flex-col gap-2">
              {status.outboxFailed > 0 ? (
                <RetryButton
                  target="all-failed"
                  label="Retry failed messages"
                />
              ) : (
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <RotateCw className="size-4" /> No failed messages to retry
                </p>
              )}
              <Link
                href="/admin/payments"
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
              >
                <CreditCard className="size-4 text-amber" /> Review failed
                payments
              </Link>
              <Link
                href="/admin/students"
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
              >
                <Users className="size-4 text-amber" /> All students
              </Link>
              <a
                href="https://dashboard.stripe.com/test/dashboard"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
              >
                <ExternalLink className="size-4 text-amber" /> Stripe dashboard
                (test)
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Most active students
            </h2>
            <Link
              href="/admin/students"
              className="text-sm text-amber hover:underline"
            >
              View all
            </Link>
          </div>
          <StudentsTable rows={d.students.slice(0, 5)} />
        </div>

        <div className="rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10">
          <h2 className="text-lg font-bold text-white">Plan mix</h2>
          <p className="text-sm text-slate-400">All students</p>
          <div className="mt-4 space-y-3">
            {[
              {
                label: "Lifetime",
                n: mix.lifetime,
                bar: "from-amber to-amber/50",
              },
              { label: "Monthly", n: mix.monthly, bar: "from-dusk to-dusk/40" },
              {
                label: "No plan",
                n: mix.none,
                bar: "from-slate-500 to-slate-600",
              },
            ].map((m) => {
              const pct = Math.round((m.n / mixTotal) * 100);
              return (
                <div key={m.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-300">
                      {m.label} <span className="text-slate-500">· {m.n}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-white">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r",
                        m.bar,
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
