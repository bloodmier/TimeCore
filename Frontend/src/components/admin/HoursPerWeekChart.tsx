import { useId, useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  isoWeek: string;
  hours: number;
  billableHours?: number;
  nonBillableHours?: number;
};

type Props = { data: Point[] };

/**
 * HoursPerWeekChart
 *
 * Line chart showing weekly totals (total, billable, non-billable).
 * Uses CSS variables for theming and disables animations for snappier admin UX.
 *
 * Note: the gradient id is unique to avoid SVG <defs> collisions if multiple charts render.
 */
export function HoursPerWeekChart({ data }: Props) {
  const chart = useMemo(
    () =>
      (data ?? []).map((d) => ({
        week: d.isoWeek,
        hours: d.hours || 0,
        billableHours: d.billableHours ?? 0,
        nonBillableHours: d.nonBillableHours ?? 0,
      })),
    [data]
  );

  const gradientId = useId();

  return (
    <div className="theme-chart chart-surface-bg w-full rounded-xl border p-3 bg-background transition-colors">
      <h3 className="text-sm font-medium mb-2 text-muted-foreground text-end">
        Weekly hours summary
      </h3>

      <div style={{ height: "18rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <defs>
              <linearGradient id={`lineGradientTotal-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-bar)" />
                <stop offset="100%" stopColor="var(--chart-bar2)" />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={`hsl(var(--chart-grid))`} />

            <XAxis
              dataKey="week"
              tickMargin={8}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
              // If isoWeek is "YYYY-ww", we hide the year for readability.
              tickFormatter={(v: string) => v.replace(/^\d{4}-/, "")}
            />
            <YAxis allowDecimals={false} />

            <Tooltip
              contentStyle={{
                background: `var(--popover)`,
                color: `var(--popover-foreground)`,
                border: `1px solid hsl(var(--chart-grid))`,
                borderRadius: 8,
              }}
              labelStyle={{ color: `var(--popover-foreground)` }}
              itemStyle={{ color: `var(--popover-foreground)` }}
              formatter={(val: unknown, name: string) => {
                // Recharts provides numeric values here for our dataset.
                const label =
                  name === "hours"
                    ? "Total"
                    : name === "billableHours"
                    ? "Billable"
                    : name === "nonBillableHours"
                    ? "Non-billable"
                    : name;

                return [val as number, label];
              }}
            />

            <Legend wrapperStyle={{ paddingTop: 8 }} />

            <Line
              type="monotone"
              dataKey="hours"
              name="Total"
              stroke={`url(#lineGradientTotal-${gradientId})`}
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="billableHours"
              name="Billable"
              stroke={`hsl(var(--chart-green, 140 70% 45%))`}
              strokeWidth={2}
              dot={{ r: 2, strokeWidth: 1 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="nonBillableHours"
              name="Non-billable"
              stroke={`hsl(var(--chart-gray, 0 0% 50%))`}
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={{ r: 2, strokeWidth: 1 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
