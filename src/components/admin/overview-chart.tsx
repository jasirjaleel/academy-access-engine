"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  mrr: number;
  signups: number;
  learners: number;
  learnerIds: string[];
};
type Metric = "mrr" | "payments" | "signups" | "learners";
type Bucket = Point & { end: string };

const config = {
  mrr: { label: "MRR", color: "#ED8C44" },
  monthly: { label: "Monthly plans", color: "#7FB7D9" },
  lifetime: { label: "Lifetime", color: "#ED8C44" },
  signups: { label: "New students", color: "#7FB7D9" },
  learners: { label: "Learners that day", color: "#7FB7D9" },
} satisfies ChartConfig;

const metrics: { key: Metric; label: string }[] = [
  { key: "mrr", label: "MRR" },
  { key: "payments", label: "Payments" },
  { key: "signups", label: "Signups" },
  { key: "learners", label: "Active learners" },
];

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const long = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/**
 * Sum days into 7-day buckets counted back from today, so the last bar is always "this week".
 * Leftover days at the start (30 = 2 + 4×7) join the oldest bucket instead of making a tiny bar.
 */
function weekly(rows: Point[]): Bucket[] {
  const out: Bucket[] = [];
  const leftover = rows.length % 7;
  for (let end = rows.length, start = 0; end > 0; end = start) {
    start = end - 7 <= leftover ? 0 : end - 7;
    const chunk = rows.slice(start, end);
    out.unshift({
      ...chunk[0],
      end: chunk[chunk.length - 1].date,
      monthly: chunk.reduce((n, r) => n + r.monthly, 0),
      lifetime: chunk.reduce((n, r) => n + r.lifetime, 0),
    });
  }
  return out;
}

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

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "#64748B", fontSize: 12 },
} as const;

/** Activity chart with metric + range toggles (data: last 30 days, oldest first). */
export function OverviewChart({ data }: { data: Point[] }) {
  const [metric, setMetric] = useState<Metric>("mrr");
  const [days, setDays] = useState<7 | 15 | 30>(30);
  const rows = data.slice(-days);
  const first = rows[0];
  const last = rows[rows.length - 1];

  // Learners are counted once each over the range (summing days would double-count).
  const summary = {
    mrr: `${money(last.mrr)} MRR now · ${last.mrr >= first.mrr ? "+" : "−"}${money(Math.abs(last.mrr - first.mrr))} in ${days} days`,
    payments: `${money(rows.reduce((n, r) => n + r.revenue, 0))} collected · last ${days} days`,
    signups: `${rows.reduce((n, r) => n + r.signups, 0)} new students · last ${days} days`,
    learners: `${new Set(rows.flatMap((r) => r.learnerIds)).size} unique learners · last ${days} days`,
  }[metric];

  // 30 daily bars of $15 next to one $999 bar are unreadable, so a month is shown by week.
  const byWeek = metric === "payments" && days === 30;
  const bars = byWeek ? weekly(rows) : rows;

  const tooltip = (
    <ChartTooltip
      cursor={metric === "payments" ? { fill: "rgba(255,255,255,0.04)" } : { stroke: "rgba(255,255,255,0.15)" }}
      content={
        <ChartTooltipContent
          labelFormatter={(d, payload) => {
            const end = (payload?.[0]?.payload as Bucket | undefined)?.end;
            return byWeek && end ? `${short(String(d))} – ${short(end)}` : long(String(d));
          }}
        />
      }
    />
  );
  const xAxis = <XAxis dataKey="date" {...axisProps} tickMargin={8} minTickGap={24} tickFormatter={short} />;
  const yAxis = (isMoney: boolean) => (
    <YAxis
      {...axisProps}
      width={48}
      allowDecimals={false}
      tickFormatter={(v: number) => (isMoney ? money(v) : String(v))}
    />
  );
  const grid = <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />;
  const fill = (key: keyof typeof config) => (
    <linearGradient id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={config[key].color} stopOpacity={0.45} />
      <stop offset="95%" stopColor={config[key].color} stopOpacity={0.02} />
    </linearGradient>
  );

  return (
    <div className="flex flex-col rounded-2xl bg-midnight-2/80 p-5 ring-1 ring-white/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Activity</h2>
          <p className="text-sm text-slate-400">{summary}</p>
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
      {/* Grows to the height of the cards beside it on wide screens. */}
      <ChartContainer config={config} className="mt-6 aspect-auto h-64 w-full xl:h-auto xl:min-h-64 xl:flex-1">
        {metric === "payments" ? (
          <BarChart data={bars} margin={{ left: 0, right: 8, top: 8 }}>
            {grid}
            {xAxis}
            {yAxis(true)}
            {tooltip}
            <ChartLegend content={<ChartLegendContent />} />
            {/* Stacked: monthly renewals under one-off lifetime purchases. */}
            <Bar dataKey="monthly" stackId="pay" fill={config.monthly.color} maxBarSize={byWeek ? 56 : 28} />
            <Bar
              dataKey="lifetime"
              stackId="pay"
              fill={config.lifetime.color}
              radius={[6, 6, 0, 0]}
              maxBarSize={byWeek ? 56 : 28}
            />
          </BarChart>
        ) : (
          <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <defs>{fill(metric)}</defs>
            {grid}
            {xAxis}
            {yAxis(metric === "mrr")}
            {tooltip}
            <Area
              dataKey={metric}
              // MRR moves in steps when someone subscribes or leaves; counts read better smooth.
              type={metric === "mrr" ? "stepAfter" : "monotone"}
              stroke={config[metric].color}
              strokeWidth={2}
              fill={`url(#fill-${metric})`}
            />
          </AreaChart>
        )}
      </ChartContainer>
    </div>
  );
}
