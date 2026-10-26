import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
    </header>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-bold tabular-nums",
          tone === "good" && "text-emerald-300",
          tone === "warn" && "text-amber",
          tone === "bad" && "text-red-300",
          tone === "default" && "text-white",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-midnight-2/80 ring-1 ring-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-200">{children}</tbody>
      </table>
      {empty ? <p className="px-4 py-8 text-center text-slate-500">Nothing here yet.</p> : null}
    </div>
  );
}

const pillTone: Record<string, string> = {
  applied: "bg-emerald-400/10 text-emerald-300",
  sent: "bg-emerald-400/10 text-emerald-300",
  paid: "bg-emerald-400/10 text-emerald-300",
  ignored: "bg-white/5 text-slate-400",
  pending: "bg-amber/15 text-amber",
  open: "bg-amber/15 text-amber",
  error: "bg-red-400/10 text-red-300",
  failed: "bg-red-400/10 text-red-300",
  uncollectible: "bg-red-400/10 text-red-300",
};

export function Pill({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", pillTone[value] ?? "bg-white/5 text-slate-300")}>
      {value}
    </span>
  );
}

export function FilterTabs({ base, current, options }: { base: string; current?: string; options: string[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {["all", ...options].map((o) => {
        const active = (current ?? "all") === o;
        return (
          <Link
            key={o}
            href={o === "all" ? base : `${base}?filter=${o}`}
            className={cn(
              "rounded-full px-3 py-1 text-sm ring-1 ring-white/10",
              active ? "bg-amber/15 text-amber ring-amber/40" : "text-slate-300 hover:bg-white/5",
            )}
          >
            {o}
          </Link>
        );
      })}
    </div>
  );
}

export const when = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
