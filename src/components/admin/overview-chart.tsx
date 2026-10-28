"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type Point = {
  date: string;
  revenue: number;
  monthly: number;
  lifetime: number;
  signups: number;
  learners: number;
  learnerIds: string[];
};
type Metric = "revenue" | "signups" | "learners";

const config = {
  revenue: { label: "Revenue ($)", color: "#ED8C44" },
  monthly: { label: "Monthly ($)", color: "#7FB7D9" },
  lifetime: { label: "Lifetime ($)", color: "#ED8C44" },
  signups: { label: "New students", color: "#7FB7D9" },
  learners: { label: "Learners that day", color: "#7FB7D9" },
} satisfies ChartConfig;

const metrics: { key: Metric; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "signups", label: "Signups" },
  { key: "learners", label: "Active learners" },
];

function Toggle<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition",
            value === o.key
              ? "bg-amber text-midnight shadow-[0_0_20px_-6px_rgba(237,140,68,0.8)]"
              : "text-slate-400 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Activity chart with metric + range toggles (data: last 30 days, oldest first). */
export function OverviewChart({ data }: { data: Point[] }) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [days, setDays] = useState<7 | 15 | 30>(30);
  const rows = data.slice(-days);
  // Learners are counted once each over the range (summing days would double-count).
  const total =
    metric === "learners"
      ? new Set(rows.flatMap((r) => r.learnerIds)).size
      : rows.reduce((n, r) => n + r[metric], 0);
  const totalLabel = {
    revenue: "revenue",
    signups: "new students",
    learners: "unique learners",
  }[metric];
  const color = config[metric].color;

  return (
    <div className="rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Activity</h2>
          <p className="text-sm text-slate-400">
            {metric === "revenue" ? `$${total.toLocaleString("en-US")}` : total}{" "}
            {totalLabel} · last {days} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle value={metric} onChange={setMetric} options={metrics} />
          <Toggle
            value={days}
            onChange={setDays}
            options={[
              { key: 7, label: "7d" },
              { key: 15, label: "15d" },
              { key: 30, label: "30d" },
            ]}
          />
        </div>
      </div>
      <ChartContainer config={config} className="mt-6 aspect-auto h-64 w-full">
        {metric === "revenue" ? (
          // Payments are discrete events, so bars read better than a smoothed line.
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tick={{ fill: "#64748B", fontSize: 12 }}
              tickFormatter={(d: string) =>
                new Date(d).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              tick={{ fill: "#64748B", fontSize: 12 }}
            />
            <ChartTooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(d) =>
                    new Date(String(d)).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {/* Stacked: monthly renewals vs one-off lifetime purchases. */}
            <Bar
              dataKey="monthly"
              stackId="rev"
              fill="#7FB7D9"
              maxBarSize={28}
            />
            <Bar
              dataKey="lifetime"
              stackId="rev"
              fill="#ED8C44"
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        ) : (
          <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <defs>
              <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.45} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tick={{ fill: "#64748B", fontSize: 12 }}
              tickFormatter={(d: string) =>
                new Date(d).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              tick={{ fill: "#64748B", fontSize: 12 }}
            />
            <ChartTooltip
              cursor={{ stroke: "rgba(255,255,255,0.15)" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(d) =>
                    new Date(String(d)).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })
                  }
                />
              }
            />
            <Area
              dataKey={metric}
              type="monotone"
              stroke={color}
              strokeWidth={2}
              fill={`url(#fill-${metric})`}
            />
          </AreaChart>
        )}
      </ChartContainer>
    </div>
  );
}
