import { useState, useMemo } from "react";

/**
 * Minimal DC nodal analysis for resistor + independent voltage/current-source netlists.
 * Netlist grammar (one element per line):
 *   R<name> <n1> <n2> <resistance>
 *   V<name> <n+> <n-> <volts>
 *   I<name> <n+> <n-> <amps>    (current flows from n+ to n- externally)
 * Node "0" is ground.
 */

type Elem =
  | { kind: "R"; name: string; a: string; b: string; val: number }
  | { kind: "V"; name: string; a: string; b: string; val: number }
  | { kind: "I"; name: string; a: string; b: string; val: number };

function parse(src: string): Elem[] {
  const out: Elem[] = [];
  src.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.split(/[*;#]/)[0].trim();
    if (!line) return;
    const [tok, a, b, v] = line.split(/\s+/);
    const kind = tok?.[0]?.toUpperCase();
    const val = Number(v);
    if (!tok || !a || !b || !isFinite(val)) throw new Error(`Line ${i + 1}: bad element "${raw}"`);
    if (kind === "R") out.push({ kind: "R", name: tok, a, b, val });
    else if (kind === "V") out.push({ kind: "V", name: tok, a, b, val });
    else if (kind === "I") out.push({ kind: "I", name: tok, a, b, val });
    else throw new Error(`Line ${i + 1}: unknown element "${tok}"`);
  });
  return out;
}

// Solve Ax = b via Gaussian elimination.
function solve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    if (Math.abs(M[i][i]) < 1e-12) throw new Error("Singular matrix — check connectivity/loops");
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

function analyze(src: string) {
  const els = parse(src);
  const nodeSet = new Set<string>();
  els.forEach((e) => { nodeSet.add(e.a); nodeSet.add(e.b); });
  const nodes = [...nodeSet].filter((n) => n !== "0").sort();
  const idx: Record<string, number> = {};
  nodes.forEach((n, i) => (idx[n] = i));
  const vs = els.filter((e) => e.kind === "V") as Extract<Elem, { kind: "V" }>[];
  const N = nodes.length + vs.length;
  const A: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  const rhs: number[] = Array(N).fill(0);

  // Resistors -> G matrix
  els.forEach((e) => {
    if (e.kind !== "R") return;
    const g = 1 / e.val;
    const ia = e.a === "0" ? -1 : idx[e.a];
    const ib = e.b === "0" ? -1 : idx[e.b];
    if (ia >= 0) A[ia][ia] += g;
    if (ib >= 0) A[ib][ib] += g;
    if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
  });
  // Current sources
  els.forEach((e) => {
    if (e.kind !== "I") return;
    const ia = e.a === "0" ? -1 : idx[e.a];
    const ib = e.b === "0" ? -1 : idx[e.b];
    if (ia >= 0) rhs[ia] -= e.val;
    if (ib >= 0) rhs[ib] += e.val;
  });
  // Voltage sources (MNA extension)
  vs.forEach((e, k) => {
    const row = nodes.length + k;
    const ia = e.a === "0" ? -1 : idx[e.a];
    const ib = e.b === "0" ? -1 : idx[e.b];
    if (ia >= 0) { A[ia][row] += 1; A[row][ia] += 1; }
    if (ib >= 0) { A[ib][row] -= 1; A[row][ib] -= 1; }
    rhs[row] = e.val;
  });

  const x = solve(A, rhs);
  const nodeVolts: Record<string, number> = { "0": 0 };
  nodes.forEach((n, i) => (nodeVolts[n] = x[i]));
  const branchCurrents: Record<string, number> = {};
  vs.forEach((e, k) => (branchCurrents[e.name] = x[nodes.length + k]));

  // Resistor currents (from a -> b)
  const resistorCurrents: { name: string; i: number }[] = [];
  els.forEach((e) => {
    if (e.kind !== "R") return;
    resistorCurrents.push({ name: e.name, i: (nodeVolts[e.a] - nodeVolts[e.b]) / e.val });
  });

  return { nodeVolts, branchCurrents, resistorCurrents };
}

const EXAMPLES = [
  { name: "Voltage divider", src: "V1 1 0 10\nR1 1 2 1000\nR2 2 0 2000" },
  { name: "Two-loop mesh", src: "V1 1 0 12\nR1 1 2 100\nR2 2 3 200\nR3 3 0 300\nR4 2 0 400" },
  { name: "Current source + resistors", src: "I1 0 1 0.01\nR1 1 0 1000\nR2 1 2 500\nR3 2 0 2000" },
];

export function SpiceDc() {
  const [src, setSrc] = useState(EXAMPLES[0].src);
  const result = useMemo(() => {
    try { return { ok: true as const, ...analyze(src) }; }
    catch (e: any) { return { ok: false as const, error: e.message as string }; }
  }, [src]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex.name} onClick={() => setSrc(ex.src)} className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted">{ex.name}</button>
        ))}
      </div>
      <textarea
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        className="w-full min-h-40 rounded-lg border border-border bg-background p-2 font-mono text-xs"
        spellCheck={false}
      />
      {!result.ok ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{result.error}</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-xs uppercase text-muted-foreground mb-2">Node voltages</div>
            <table className="w-full text-sm font-mono">
              <tbody>
                {Object.entries(result.nodeVolts).sort().map(([n, v]) => (
                  <tr key={n}><td>V({n})</td><td className="text-right text-primary">{v.toFixed(4)} V</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-xs uppercase text-muted-foreground mb-2">Branch currents</div>
            <table className="w-full text-sm font-mono">
              <tbody>
                {result.resistorCurrents.map((r) => (
                  <tr key={r.name}><td>I({r.name})</td><td className="text-right text-primary">{(r.i * 1000).toFixed(4)} mA</td></tr>
                ))}
                {Object.entries(result.branchCurrents).map(([n, v]) => (
                  <tr key={n}><td>I({n})</td><td className="text-right text-primary">{(v * 1000).toFixed(4)} mA</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">DC analysis for R / V / I only. Node 0 is ground. One element per line.</p>
    </div>
  );
}
