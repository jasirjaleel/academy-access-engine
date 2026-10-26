import { PageTitle, Stat } from "@/components/admin/ui";
import { db } from "@/db";
import { formatMoney, getAdminOverview } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const o = await getAdminOverview(db);

  return (
    <div>
      <PageTitle title="Overview" subtitle="Billing health and message delivery at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Paying students" value={String(o.activeStudents)} hint="Live subscription or lifetime access" />
        <Stat
          label="In grace period"
          value={String(o.studentsInGrace)}
          tone={o.studentsInGrace > 0 ? "warn" : "default"}
          hint="Payment failed, access still on"
        />
        <Stat
          label="Revenue at risk"
          value={formatMoney(o.atRisk.cents)}
          tone={o.atRisk.cents > 0 ? "warn" : "default"}
          hint={`${o.atRisk.invoices} unpaid invoice(s) after a failure`}
        />
        <Stat
          label="Recovered (30 days)"
          value={formatMoney(o.recovered30d.cents)}
          tone={o.recovered30d.cents > 0 ? "good" : "default"}
          hint={`${o.recovered30d.invoices} invoice(s) paid after failing`}
        />
        <Stat
          label="Messages"
          value={`${o.outbox.sent} sent`}
          tone={o.outbox.failed > 0 ? "bad" : "default"}
          hint={`${o.outbox.pending} waiting · ${o.outbox.failed} failed`}
        />
        <Stat
          label="Webhooks (24 h)"
          value={String(o.webhooks24h.total)}
          tone={o.webhooks24h.errors > 0 ? "bad" : "default"}
          hint={`${o.webhooks24h.errors} error(s)`}
        />
      </div>
    </div>
  );
}
