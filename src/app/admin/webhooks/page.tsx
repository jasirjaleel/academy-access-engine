import { FilterTabs, PageTitle, Pill, Table, when } from "@/components/admin/ui";
import { db } from "@/db";
import { listWebhookEvents } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

const RESULTS = ["applied", "ignored", "error"];

export default async function AdminWebhooksPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { filter } = await searchParams;
  const result = filter && RESULTS.includes(filter) ? filter : undefined;
  const rows = await listWebhookEvents(db, result);

  return (
    <div>
      <PageTitle title="Webhook log" subtitle="Every Stripe and Clerk event, processed exactly once. Latest 100." />
      <FilterTabs base="/admin/webhooks" current={result} options={RESULTS} />
      <Table head={["Received", "Provider", "Type", "Result", "Event id"]} empty={rows.length === 0}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap px-4 py-3 text-slate-400">{when(r.receivedAt)}</td>
            <td className="px-4 py-3">{r.provider}</td>
            <td className="px-4 py-3 font-mono text-xs">{r.type}</td>
            <td className="px-4 py-3">
              <Pill value={r.result} />
              {r.error ? <p className="mt-1 max-w-xs truncate text-xs text-red-300" title={r.error}>{r.error}</p> : null}
            </td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.id}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
