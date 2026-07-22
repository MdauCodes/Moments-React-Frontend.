// Shared chart primitives for the admin analytics pages. Built per the dataviz
// skill's mark specs: 2px lines, rounded bar ends, hairline recessive gridlines,
// a legend whenever 2+ series are present, tooltips on hover, direct labels used
// sparingly (endpoints/extremes, never every point).
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
} from "recharts";
import { CHART_GRID, CHART_AXIS, CHART_TEXT_SECONDARY, CHART_TEXT_MUTED } from "@/lib/analyticsPalette";

const AXIS_STYLE = { fontSize: 11, fill: CHART_TEXT_MUTED };
const TOOLTIP_STYLE = {
  background: "var(--admin-surface)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  fontSize: 12,
  color: CHART_TEXT_SECONDARY,
};

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

/** Line chart over time — one line per series, status/categorical colored per caller. */
export function TrendLineChart({
  data, series, valueFormatter, height = 260,
}: {
  data: Record<string, string | number>[];
  series: TrendSeries[];
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={{ stroke: CHART_AXIS }} tickLine={false} />
        <YAxis
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v: number) => (valueFormatter ? valueFormatter(v) : v.toLocaleString())}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number) => (valueFormatter ? valueFormatter(v) : v.toLocaleString())}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: CHART_TEXT_SECONDARY }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4, fill: s.color, stroke: "var(--admin-surface)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranked bar chart — single series, direct end-labels, ≤24px thick bars. */
export function RankedBarChart({
  data, dataKey, nameKey, color, valueFormatter, height,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  nameKey: string;
  color: string;
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  const format = valueFormatter ?? ((v: number) => v.toLocaleString());
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(120, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="0" horizontal={false} />
        <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={format} />
        <YAxis type="category" dataKey={nameKey} tick={AXIS_STYLE} axisLine={false} tickLine={false} width={140} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => format(v)} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
          <LabelList dataKey={dataKey} position="right" formatter={format} style={{ fontSize: 11, fill: CHART_TEXT_SECONDARY }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

/** Donut for share-of-whole — 2px surface gaps between slices via paddingAngle, legend always shown. */
export function ShareDonutChart({
  data, valueFormatter, height = 220,
}: {
  data: DonutSlice[];
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  const format = valueFormatter ?? ((v: number) => v.toLocaleString());
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="var(--admin-surface)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => format(v)} />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          wrapperStyle={{ fontSize: 12, color: CHART_TEXT_SECONDARY }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
