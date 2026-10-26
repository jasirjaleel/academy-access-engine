import { FilterTabs, PageTitle, Pill, Table, when } from "@/components/admin/ui";
import { RetryButton } from "@/components/admin/retry-button";
import { db } from "@/db";
import { listOutbox } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

const STATUSES = ["pending", "sent", "failed"] as const;
type Status = (typeof STATUSES)[number];

export default async function AdminOutboxPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { filter } = await searchParams;
  const status = STATUSES.includes(filter as Status) ? (filter as Status) : undefined;
  const rows = await listOutbox(db, status);
  const anyFailed = rows.some((r) => r.status === "failed");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Outbox" subtitle="Messages handed to n8n. Failed ones can be retried. Latest 100." />
        {anyFailed ? <RetryButton target="all-failed" label="Retry all failed" /> : null}
      </div>
      <FilterTabs base="/admin/outbox" current={status} options={[...STATUSES]} />
      <Table head={["Created", "Type", "Student", "Status", "Attempts", "Next / sent", ""]} empty={rows.length === 0}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap px-4 py-3 text-slate-400">{when(r.createdAt)}</td>
            <td className="px-4 py-3 font-mono text-xs">{r.type}</td>
            <td className="px-4 py-3">{r.email}</td>
            <td className="px-4 py-3">
              <Pill value={r.status} />
              {r.lastError ? <p className="mt-1 max-w-[14rem] truncate text-xs text-red-300" title={r.lastError}>{r.lastError}</p> : null}
            </td>
            <td className="px-4 py-3 tabular-nums">{r.attempts}</td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-400">{r.status === "sent" ? when(r.sentAt) : when(r.nextAttemptAt)}</td>
            <td className="px-4 py-3 text-right">{r.status !== "sent" ? <RetryButton target={r.id} /> : null}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
