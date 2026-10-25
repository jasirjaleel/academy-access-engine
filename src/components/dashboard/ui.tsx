import { cn } from "@/lib/utils";

export function Arabic({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span dir="rtl" lang="ar" className={cn("font-arabic text-[1.1em]", className)}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-midnight-2/80 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/10 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">{children}</p>;
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

const badgeStyles = {
  active: "bg-amber/15 text-amber",
  free: "bg-dusk/15 text-dusk",
  grace: "bg-amber/25 text-amber-100",
  locked: "bg-white/5 text-slate-400",
} as const;

export function StatusBadge({ kind, children }: { kind: keyof typeof badgeStyles; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", badgeStyles[kind])}>
      {children}
    </span>
  );
}

export const formatDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatDuration = (sec: number) => `${Math.round(sec / 60)} min`;
