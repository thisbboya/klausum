// The circuit bench: type a netlist, get node voltages and a Bode plot.
//
// A netlist rather than a drag-and-drop schematic on purpose. Engineering
// students already meet netlists in every SPICE tool they will use later, it
// is the format their lecturer's examples are written in, and it works on a
// phone keyboard — where dragging component symbols onto a canvas does not.
import { useMemo, useState } from "react";
import { Play, Zap, Info } from "lucide-react";
import { parseNetlist, solve, acSweep, magnitude, phaseDeg } from "@/lib/sim/mna";

const EXAMPLES: { name: string; netlist: string; out: string }[] = [
  {
    name: "Voltage divider",
    out: "out",
    netlist: `V1 in 0 5\nR1 in out 1k\nR2 out 0 2k`,
  },
  {
    name: "RC low-pass",
    out: "out",
    netlist: `V1 in 0 1\nR1 in out 1k\nC1 out 0 159.155n`,
  },
  {
    name: "RC high-pass",
    out: "out",
    netlist: `V1 in 0 1\nC1 in out 159.155n\nR1 out 0 1k`,
  },
  {
    name: "Loaded divider",
    out: "out",
    netlist: `V1 in 0 12\nR1 in out 4.7k\nR2 out 0 10k\nR3 out 0 22k`,
  },
  {
    name: "RLC band-pass",
    out: "out",
    netlist: `V1 in 0 1\nR1 in out 100\nL1 out 0 10m\nC1 out 0 1u`,
  },
];

export function CircuitLab() {
  const [text, setText] = useState(EXAMPLES[0].netlist);
  const [outNode, setOutNode] = useState("out");
  const [ran, setRan] = useState(0);

  const result = useMemo(() => {
    const net = parseNetlist(text);
    if (net.components.length === 0) return null;
    const dc = solve(net, 0);
    const hasReactive = net.components.some((k) => k.kind === "C" || k.kind === "L");
    const sweep = hasReactive && net.nodes.includes(outNode)
      ? acSweep(net, outNode, 1, 1e6, 70)
      : [];
    return { net, dc, sweep, hasReactive };
    // ran forces a recompute when the student presses the button even if the
    // text is unchanged, which is what they expect from a Run button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, outNode, ran]);

  // The −3 dB point, found from the sweep rather than assumed — it is the one
  // number a filter question is actually about.
  const cutoff = useMemo(() => {
    if (!result?.sweep.length) return null;
    const peak = Math.max(...result.sweep.map((p) => p.db));
    const target = peak - 3.0103;
    let best = result.sweep[0];
    let bestErr = Infinity;
    for (const p of result.sweep) {
      const err = Math.abs(p.db - target);
      if (err < bestErr) { bestErr = err; best = p; }
    }
    return bestErr < 1 ? best.f : null;
  }, [result]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e.name}
            onClick={() => { setText(e.netlist); setOutNode(e.out); setRan((r) => r + 1); }}
            className="rounded-full border-2 border-border bg-card px-3 py-1.5 text-xs font-extrabold transition hover:border-primary hover:text-primary"
          >
            {e.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            Netlist
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={9}
            className="w-full rounded-xl border-2 border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs font-extrabold text-muted-foreground">Output node</label>
            <input
              value={outNode}
              onChange={(e) => setOutNode(e.target.value.trim())}
              className="w-24 rounded-lg border-2 border-border bg-surface-2 px-2 py-1 font-mono text-xs outline-none focus:border-primary"
            />
            <button
              onClick={() => setRan((r) => r + 1)}
              className="btn-3d ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5" /> Run
            </button>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            One component per line: <code>name nodeA nodeB value</code>. R, C, L, V and I.
            Node <code>0</code> is ground. Suffixes work — 1k, 100n, 10u, 1meg.
          </p>
        </div>

        <div className="space-y-3">
          {!result?.dc ? (
            <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-xs font-semibold text-muted-foreground">
              Nothing to solve yet — every circuit needs a source and a path to ground.
            </div>
          ) : (
            <>
              <div>
                <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  DC operating point
                </div>
                <div className="overflow-hidden rounded-xl border-2 border-border">
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(result.dc.nodes)
                        .filter(([n]) => n !== "0")
                        .map(([node, v]) => (
                          <tr key={node} className="border-b-2 border-border last:border-0">
                            <td className="bg-surface-2 px-3 py-1.5 font-mono font-extrabold">V({node})</td>
                            <td className="px-3 py-1.5 text-right font-extrabold tabular-nums">
                              {v.re.toFixed(4)} V
                            </td>
                          </tr>
                        ))}
                      {Object.entries(result.dc.currents).map(([name, i]) => (
                        <tr key={name} className="border-b-2 border-border last:border-0">
                          <td className="bg-surface-2 px-3 py-1.5 font-mono font-extrabold">I({name})</td>
                          <td className="px-3 py-1.5 text-right font-extrabold tabular-nums">
                            {(Math.abs(i.re) * 1000).toFixed(3)} mA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.hasReactive && (
                  <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
                    At DC a capacitor is an open circuit and an inductor is a short — that is
                    why these numbers may look like the reactive parts are missing.
                  </p>
                )}
              </div>

              {result.sweep.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                      Frequency response at {outNode}
                    </span>
                    {cutoff && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                        <Zap className="h-3 w-3" /> −3 dB at {fmtHz(cutoff)}
                      </span>
                    )}
                  </div>
                  <Bode data={result.sweep} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const fmtHz = (f: number) =>
  f >= 1e6 ? `${(f / 1e6).toFixed(2)} MHz` : f >= 1e3 ? `${(f / 1e3).toFixed(2)} kHz` : `${f.toFixed(1)} Hz`;

/** A Bode magnitude plot, drawn as an SVG path on a log frequency axis. */
function Bode({ data }: { data: { f: number; db: number }[] }) {
  const W = 420;
  const H = 160;
  const dbs = data.map((d) => d.db);
  const top = Math.max(3, Math.max(...dbs) + 3);
  const bottom = Math.min(-40, Math.min(...dbs) - 3);
  const lf = Math.log10(data[0].f);
  const rf = Math.log10(data[data.length - 1].f);

  const x = (f: number) => ((Math.log10(f) - lf) / (rf - lf)) * W;
  const y = (db: number) => H - ((db - bottom) / (top - bottom)) * H;

  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.f).toFixed(1)},${y(d.db).toFixed(1)}`).join(" ");

  // A decade gridline every power of ten, which is how these plots are read.
  const decades: number[] = [];
  for (let e = Math.ceil(lf); e <= Math.floor(rf); e++) decades.push(10 ** e);

  return (
    <div className="overflow-hidden rounded-xl border-2 border-border bg-surface-2 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        {decades.map((f) => (
          <g key={f}>
            <line x1={x(f)} y1={0} x2={x(f)} y2={H} stroke="var(--border)" strokeWidth="1" />
            <text x={x(f) + 3} y={H - 4} fontSize="9" fill="var(--muted-foreground)">
              {fmtHz(f)}
            </text>
          </g>
        ))}
        {/* −3 dB reference, the line every filter question is about */}
        <line x1={0} y1={y(-3.0103)} x2={W} y2={y(-3.0103)} stroke="var(--muted-foreground)" strokeDasharray="4 3" strokeWidth="1" />
        <text x={2} y={y(-3.0103) - 3} fontSize="9" fill="var(--muted-foreground)">−3 dB</text>
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
