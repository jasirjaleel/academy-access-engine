import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24 bg-white/10" />
        <Skeleton className="h-9 w-72 bg-white/10" />
      </div>
      <Skeleton className="h-36 w-full rounded-2xl bg-white/5" />
      <div className="grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
