import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

type Props = { data: Array<{ customerName: string | null; hours: number }> };

/**
 * HoursByCustomerChart
 *
 * Bar chart showing hours grouped by customer.
 * Uses ResizeObserver to compute a responsive bar size and category gap,
 * and hides the X-axis labels on very small screens to avoid unreadable clutter.
 */
export function HoursByCustomerChart({ data }: Props) {
  // Normalize + sort (highest hours first)
  const chart = useMemo(
    () =>
      (data ?? [])
        .map((x) => ({ name: x.customerName || "—", hours: x.hours || 0 }))
        .sort((a, b) => b.hours - a.hours),
    [data]
  );

  // Measure host width so we can size bars responsively.
  const hostRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return;

    const ro = new ResizeObserver(([entry]) => {
      const cw =
        (entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width) || 0;
      setW(cw);
    });

    ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, []);

  const isCompact = w < 500;

  // Margins must match BarChart.margin
  const margin = { top: 8, right: 16, bottom: 56, left: 8 };
  const marginMobile = { top: 1, right: 0, bottom: 0, left: -30 };

  // Compute dynamic bar sizing
  const n = chart.length || 1;
  const innerWidth = Math.max(0, w - margin.left - margin.right);
  const slot = n > 0 ? innerWidth / n : innerWidth;

  // Bar width = ~70% of each slot (clamped)
  const barSize = Math.max(4, Math.min(Math.floor(slot * 0.7), 24));

  // Category gap as a percentage (smaller gaps on narrow layouts)
  const barCategoryGapPct =
    slot <= 16 ? 4 : slot <= 28 ? 8 : slot <= 40 ? 12 : 18;
  const barCategoryGap = `${barCategoryGapPct}%`;

  // Unique gradient id to avoid SVG <defs> collisions.
  const gradientId = useId();

  return (
    <div
      ref={hostRef}
      className="theme-chart chart-surface-bg w-full rounded-xl border p-3 bg-background transition-colors"
      style={{ overflowX: "hidden" }}
    >
      <div style={{ height: "18rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chart}
            margin={isCompact ? marginMobile : margin}
            barSize={barSize}
            barGap={0}
            barCategoryGap={barCategoryGap}
          >

            <defs>
              <linearGradient
                id={`barFill-${gradientId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="var(--chart-bar)" />
                <stop offset="100%" stopColor="var(--chart-bar2)" />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical
              strokeDasharray="3 3"
              stroke={`hsl(var(--chart-grid))`}
            />

            {isCompact ? (
              // Hide X labels on narrow screens (too dense to read)
              <XAxis dataKey="name" hide />
            ) : (
              <XAxis
                dataKey="name"
                tickMargin={8}
                angle={-45}
                textAnchor="end"
                height={64}
                interval={0}
                tickFormatter={(v: string) => {
                  if (w < 640) return v.length > 6 ? v.slice(0, 5) + "…" : v;
                  return v.length > 13 ? v.slice(0, 10) + "…" : v;
                }}
              />
            )}

            <YAxis allowDecimals={false} />

            <Tooltip
              contentStyle={{
                background: `var(--popover)`,
                color: `var(--popover-foreground)`,
                border: "1px solid hsl(var(--chart-grid))",
                borderRadius: 8,
              }}
              labelStyle={{ color: `var(--popover-foreground)` }}
              itemStyle={{ color: `var(--popover-foreground)` }}
              formatter={(val: any) => [val, "Hours"]}
            />

            <Bar
              dataKey="hours"
              radius={[6, 6, 0, 0]}
              cursor="default"
              isAnimationActive={false}
            >
              {chart.map((_, i) => (
                <Cell key={i} fill={`url(#barFill-${gradientId})`} />
              ))}
            </Bar>
              <text
                x="98%"
                y={20}
                textAnchor="end"
                fill="currentColor"
                fontSize={14}
                fontWeight={500}
              >
                Hours on customers
              </text>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
