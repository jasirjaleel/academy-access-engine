import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Eyebrow, formatDate, StatusBadge } from "@/components/dashboard/ui";
import { PortalButton } from "@/components/dashboard/portal-button";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { getDashboardData } from "@/lib/dashboard";
import { getOrCreateUser } from "@/lib/users";

const statusLabel: Record<string, { kind: "active" | "grace" | "locked"; text: string }> = {
  active: { kind: "active", text: "Active" },
  trialing: { kind: "active", text: "Trial" },
  past_due: { kind: "grace", text: "Payment failed" },
  unpaid: { kind: "locked", text: "Unpaid" },
};

export default async function BillingPage() {
  const user = await getOrCreateUser(db);
  if (!user) redirect("/sign-in");
  const { billing } = await getDashboardData(db, user.id);
  const empty = !billing.hasLifetime && billing.subscriptions.length === 0;

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">
        ← Dashboard
      </Link>
      <header>
        <Eyebrow>Billing</Eyebrow>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Your plan</h1>
      </header>

      {billing.graceUntil ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber/40 bg-amber/10 p-5 text-amber-100 sm:flex-row sm:items-center">
          <AlertTriangle className="size-6 shrink-0 text-amber" />
          <div className="flex-1">
            <p className="font-semibold text-white">Your last payment didn&apos;t go through</p>
            <p className="text-sm">
              Your access continues until <span className="font-semibold text-white">{formatDate(billing.graceUntil)}</span>.
              Update your card and we&apos;ll retry the payment automatically.
            </p>
          </div>
          {user.stripeCustomerId ? <PortalButton /> : null}
        </div>
      ) : null}

      <Card>
        {empty ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-300">You don&apos;t have a plan yet.</p>
            <Button asChild>
              <Link href="/pricing">View plans</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {billing.hasLifetime ? (
              <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <span className="font-semibold text-white">Lifetime access</span>
                <StatusBadge kind="active">Forever</StatusBadge>
              </li>
            ) : null}
            {billing.subscriptions.map((s) => {
              const label = statusLabel[s.status] ?? { kind: "locked" as const, text: s.status };
              return (
                <li key={s.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="text-sm text-slate-400">
                      {s.cancelAtPeriodEnd ? "Ends" : "Renews"} on {s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "-"}
                    </p>
                  </div>
                  <StatusBadge kind={label.kind}>{label.text}</StatusBadge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {user.stripeCustomerId ? (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">Payment method and invoices</p>
            <p className="text-sm text-slate-400">Managed securely by Stripe.</p>
          </div>
          <PortalButton label="Open billing portal" variant="secondary" />
        </Card>
      ) : null}
    </div>
  );
}
