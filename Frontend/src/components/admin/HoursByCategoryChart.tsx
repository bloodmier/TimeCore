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

type Props = { data: Array<{ name: string | null; hours: number }> };

/**
 * HoursByCategoryChart
 *
 * Bar chart that visualizes total hours per category.
 * The chart dynamically calculates bar size + category gap based on container width
 * to reduce label overlap and avoid horizontal scrolling on small screens.
 *
 * Note: Uses ResizeObserver to measure the container width.
 */
export function HoursByCategoryChart({ data }: Props) {
  // Aggregate + sort (highest hours first) for a clearer “top categories” chart.
  const chart = useMemo(
    () =>
      (data ?? [])
        .map((x) => ({ name: x.name || "—", hours: x.hours || 0 }))
        .sort((a, b) => b.hours - a.hours),
    [data]
  );

  // Measure host width so we can calculate barSize responsively.
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

  // Calculate dynamic barSize/gap so bars fit without horizontal scrolling.
  const n = chart.length || 1;

  // Margins must match BarChart.margin.
  const margin = { top: 8, right: 16, bottom: 56, left: 8 };
  const innerWidth = Math.max(0, w - margin.left - margin.right);

  // Approximate width per category slot.
  const slot = n > 0 ? innerWidth / n : innerWidth;

  // Bar width = ~70% of each slot, clamped to a reasonable range.
  const barSize = Math.max(4, Math.min(Math.floor(slot * 0.7), 24));

  // Category gap as a percentage (smaller gaps on very narrow layouts).
  const barCategoryGapPct =
    slot <= 16 ? 4 : slot <= 28 ? 8 : slot <= 40 ? 12 : 18;
  const barCategoryGap = `${barCategoryGapPct}%`;

  // Unique gradient id to avoid SVG <defs> collisions if multiple charts are rendered.
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
            margin={margin}
            barSize={barSize}
            barGap={0}
            barCategoryGap={barCategoryGap}
          >
            <text
              x="50%"
              y={20}
              textAnchor="middle"
              fill="currentColor"
              fontSize={14}
              fontWeight={500}
            >
              Hours per Category
            </text>

            <defs>
              <linearGradient
                id={`barFillCategory-${gradientId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="var(--chart-bar-cat)" />
                <stop offset="100%" stopColor="var(--chart-bar-cat-2)" />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical
              strokeDasharray="3 3"
              stroke={`hsl(var(--chart-grid))`}
            />

            <XAxis
              dataKey="name"
              tickMargin={8}
              angle={-45}
              textAnchor="end"
              height={64}
              interval={0}
              tickFormatter={(v: string) =>
                v.length > 16 ? v.slice(0, 15) + "…" : v
              }
            />
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
                <Cell key={i} fill={`url(#barFillCategory-${gradientId})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
