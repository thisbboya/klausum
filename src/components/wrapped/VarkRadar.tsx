// Custom SVG radar — replaces Recharts to eliminate label clipping.
// Renders 4 axes (one per VARK style) with labels positioned outside the
// chart bounds, guaranteed legible at any size.
type Point = { subject: string; A: number };

export function VarkRadar({ data, size = 280 }: { data: Point[]; size?: number }) {
  // Always render exactly 4 axes in this order, even if input is partial.
  const ORDER = ["Visual", "Auditory", "Reading", "Kinesthetic"];
  const byName = new Map(data.map((d) => [d.subject, d.A]));
  const pts = ORDER.map((subject) => ({ subject, A: Math.max(0, Math.min(100, byName.get(subject) ?? 0)) }));

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.32; // generous margin for labels
  const angles = pts.map((_, i) => (-Math.PI / 2) + (i * 2 * Math.PI) / pts.length);

  const polar = (r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });

  const dataPath = pts
    .map((p, i) => {
      const { x, y } = polar((p.A / 100) * radius, angles[i]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full overflow-visible" aria-label="VARK radar">
      {/* Grid rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={angles
            .map((a) => {
              const { x, y } = polar(r * radius, a);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
        />
      ))}
      {/* Axes */}
      {angles.map((a, i) => {
        const { x, y } = polar(radius, a);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />;
      })}
      {/* Data shape */}
      <path d={dataPath} fill="#F4A300" fillOpacity={0.55} stroke="#F4A300" strokeWidth={2} />
      {/* Vertex dots */}
      {pts.map((p, i) => {
        const { x, y } = polar((p.A / 100) * radius, angles[i]);
        return <circle key={i} cx={x} cy={y} r={3.5} fill="#fff" />;
      })}
      {/* Labels — positioned 22px beyond the axis endpoint */}
      {pts.map((p, i) => {
        const { x, y } = polar(radius + 22, angles[i]);
        const anchor: "middle" | "start" | "end" =
          Math.abs(Math.cos(angles[i])) < 0.2 ? "middle" : Math.cos(angles[i]) > 0 ? "start" : "end";
        const baseline = Math.sin(angles[i]) < -0.2 ? "auto" : Math.sin(angles[i]) > 0.2 ? "hanging" : "middle";
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline={baseline}
            fill="#fff"
            fontSize={12}
            fontWeight={600}
          >
            {p.subject}
          </text>
        );
      })}
    </svg>
  );
}
