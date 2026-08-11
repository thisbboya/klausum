// The Recharts half of <Plot>, split into its own module purely so it can be
// lazily imported — Recharts is ~100 kB and most tutor answers have no graph.
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Series = { label: string; color: string };

export default function PlotCanvas({
  data,
  series,
}: {
  data: Record<string, number | null>[];
  series: Series[];
}) {
  return (
    <div className="h-56 w-full px-1 py-2 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 2, left: -12 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          {/* The axes themselves — without these the origin is invisible and a
              maths graph is much harder to read than a data chart. */}
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeWidth={1.5} />
          <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeWidth={1.5} />
          <XAxis
            dataKey="x"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            tickCount={7}
            // Zoomed sample points land on values like -2.3333; a graph axis
            // reads as noise at that precision.
            tickFormatter={(v: number) =>
              Number.isInteger(v) ? String(v) : v.toFixed(1)
            }
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            stroke="var(--border)"
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "2px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
            }}
            labelFormatter={(v) => `x = ${v}`}
            formatter={(value: unknown, name: unknown) => {
              const idx = Number(String(name).replace("s", ""));
              return [value as number, series[idx]?.label ?? String(name)];
            }}
          />
          {series.map((s, idx) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={`s${idx}`}
              stroke={s.color}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
