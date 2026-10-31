import { PageTitle } from "@/components/admin/ui";
import { StudentsTable } from "@/components/admin/students-table";
import { db } from "@/db";
import { getAdminDashboard, type StudentStatus } from "@/lib/admin-dashboard";
import { requireAdmin } from "@/lib/auth";
import { getAdminUserIds } from "@/lib/staff";

const legend: {
  status: StudentStatus;
  label: string;
  dot: string;
  text: string;
}[] = [
  {
    status: "active",
    label: "Active",
    dot: "bg-emerald-400",
    text: "Paying, and nothing needs attention.",
  },
  {
    status: "payment_failed",
    label: "Payment failed",
    dot: "bg-red-400",
    text: "Card failed; still has access during the 7-day grace period.",
  },
  {
    status: "cancelling",
    label: "Cancelling",
    dot: "bg-amber",
    text: "Cancelled; keeps access until the paid month ends.",
  },
  {
    status: "no_plan",
    label: "No plan",
    dot: "bg-slate-500",
    text: "Signed up but never paid; can watch preview lessons only.",
  },
];

export default async function AdminStudentsPage() {
  await requireAdmin();
  const { students, kpis } = await getAdminDashboard(db, new Date(), {
    excludeUserIds: await getAdminUserIds(),
  });
  const count = (s: StudentStatus) =>
    students.filter((x) => x.status === s).length;

  return (
    <div>
      <PageTitle
        title="Students"
        subtitle={`${students.length} students, most active first.`}
      />

      <div className="mb-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
        <div className="grid gap-3 sm:grid-cols-2">
          {legend.map((l) => (
            <div key={l.status} className="flex items-start gap-2.5 text-sm">
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${l.dot}`}
              />
              <p className="text-slate-300">
                <span className="font-semibold text-white">
                  {l.label} ({count(l.status)})
                </span>{" "}
                {l.text}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">
            Paying students ({kpis.payingStudents.value})
          </span>{" "}
          = Active + Payment failed + Cancelling, because all of them still have
          paid access today.
        </p>
      </div>

      <div className="rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10 sm:p-6">
        <StudentsTable rows={students} />
      </div>
    </div>
  );
}
