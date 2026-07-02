"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/lib/format";

export interface ChartPoint {
  t: number; // epoch ms
  price: number;
  /** Set (to the same price) on points where an alert fired — drawn as a red marker. */
  alertPrice?: number;
}

interface Props {
  data: ChartPoint[];
  baseline: { avg: number; min: number; max: number } | null;
  currency: string;
}

const INK_MUTED = "#898781";
const HAIRLINE = "#e1e0d9";
const AXIS = "#c3c2b7";
const SERIES = "#2a78d6";
const CRITICAL = "#d03b3b";

function fmtDay(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-[var(--ink-muted)]">
        {new Date(p.t).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      <p className="mt-0.5 font-semibold text-[var(--ink)]">{money(p.price, currency)}</p>
      {p.alertPrice != null && (
        <p className="mt-0.5 font-medium text-[var(--critical)]">⚠ alert fired</p>
      )}
    </div>
  );
}

function AlertDot(props: unknown) {
  const { cx, cy } = props as { cx?: number; cy?: number };
  if (cx === undefined || cy === undefined || cy === null) return <g />;
  return <circle cx={cx} cy={cy} r={5} fill={CRITICAL} stroke="#fff" strokeWidth={2} />;
}

export default function PriceChart({ data, baseline, currency }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--ink-muted)]">
        No price history yet — the worker records a point on every check.
      </p>
    );
  }
  const hasAlerts = data.some((d) => d.alertPrice != null);

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={HAIRLINE} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={fmtDay}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
            axisLine={{ stroke: AXIS }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => money(v, currency)}
            tick={{ fill: INK_MUTED, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={70}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          {baseline && (
            <ReferenceArea
              y1={baseline.min}
              y2={baseline.max}
              fill={HAIRLINE}
              fillOpacity={0.35}
              stroke="none"
            />
          )}
          {baseline && (
            <ReferenceLine y={baseline.avg} stroke={AXIS} strokeDasharray="4 4" />
          )}
          <Line
            name="price"
            dataKey="price"
            stroke={SERIES}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          {/* Alert markers share the chart's data (keyed on alertPrice) — a Scatter
              with its own data prop would hijack the axis domains in Recharts. */}
          <Scatter name="alert" dataKey="alertPrice" fill={CRITICAL} shape={AlertDot} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--ink-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES }} />
          cheapest price found
        </span>
        {baseline && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded" style={{ background: HAIRLINE }} />
            normal range (30-day)
          </span>
        )}
        {hasAlerts && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white"
              style={{ background: CRITICAL, boxShadow: "0 0 0 1px " + HAIRLINE }}
            />
            alert fired
          </span>
        )}
      </div>
    </div>
  );
}
