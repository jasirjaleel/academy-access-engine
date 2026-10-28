import type { AdminDashboard, StudentStatus } from "@/lib/admin-dashboard";
import { studentStatusLabel } from "@/lib/admin-dashboard";
import { cn } from "@/lib/utils";

const statusTone: Record<StudentStatus, string> = {
  active: "bg-emerald-400/10 text-emerald-300",
  payment_failed: "bg-red-400/10 text-red-300",
  cancelling: "bg-amber/15 text-amber",
  no_plan: "bg-white/5 text-slate-400",
};

const ago = (d: Date | null) => {
  if (!d) return "Never";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};

/** Student list with progress bars (Overview shows the top few, Students shows everyone). */
export function StudentsTable({ rows }: { rows: AdminDashboard["students"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="pb-3 font-semibold">Student</th>
            <th className="pb-3 font-semibold">Plan</th>
            <th className="pb-3 font-semibold">Status</th>
            <th className="pb-3 font-semibold">Progress</th>
            <th className="pb-3 font-semibold">Last active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((s) => {
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <tr key={s.id} className="text-slate-200">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber/40 to-teal text-xs font-bold text-white ring-1 ring-white/10">
                      {s.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {s.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {s.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 text-slate-300">{s.plan}</td>
                <td className="py-3 pr-4">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      statusTone[s.status],
                    )}
                  >
                    {studentStatusLabel[s.status]}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber to-amber/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-slate-400">
                      {s.done}/{s.total}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-slate-400">{ago(s.lastActive)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-slate-500">No students yet.</p>
      ) : null}
    </div>
  );
}
