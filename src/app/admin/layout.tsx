import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/webhooks", label: "Webhooks" },
  { href: "/admin/outbox", label: "Outbox" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:flex-row sm:px-6">
      <aside className="shrink-0 sm:w-48">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-amber">Admin</p>
        <nav className="flex gap-1 overflow-x-auto sm:flex-col">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
