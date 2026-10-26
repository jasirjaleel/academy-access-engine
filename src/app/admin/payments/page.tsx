import { PageTitle, Pill, Table, when } from "@/components/admin/ui";
import { db } from "@/db";
import { formatMoney, listFailedPayments } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const rows = await listFailedPayments(db);

  return (
    <div>
      <PageTitle title="Failed payments" subtitle="Every invoice that failed at least once. Paid ones were recovered." />
      <Table head={["Student", "Amount", "Status", "Attempts", "First failed", "Paid"]} empty={rows.length === 0}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3">
              <p className="text-white">{r.email}</p>
              <p className="font-mono text-xs text-slate-500">{r.id}</p>
            </td>
            <td className="px-4 py-3 tabular-nums">{formatMoney(r.amountDue, r.currency)}</td>
            <td className="px-4 py-3">
              <Pill value={r.status === "paid" ? "paid" : r.status} />
              {r.status === "paid" ? <span className="ml-2 text-xs text-emerald-300">recovered</span> : null}
            </td>
            <td className="px-4 py-3 tabular-nums">{r.attempts}</td>
            <td className="px-4 py-3 text-slate-400">{when(r.firstFailedAt)}</td>
            <td className="px-4 py-3 text-slate-400">{when(r.paidAt)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
