// A circuit solver, in the same language SPICE speaks.
//
// The obvious route was to ship ngspice compiled to WebAssembly. I measured
// it: 38.8 MB across six files, essentially all of it one .wasm. Even loaded
// only on desktop and only when asked for, that is a thirty-megabyte download
// before a student sees a single volt — and it still could not report state to
// the mission engine, because it is a black box that returns printed output.
//
// So this implements the part of SPICE that actually matters for teaching:
// Modified Nodal Analysis. MNA is what every circuit simulator does at its
// core — write one equation per node from Kirchhoff's current law, add one per
// voltage source, and solve the linear system. In a few hundred lines it
// covers DC operating points and full AC frequency sweeps of R, L, C, and
// independent sources, which is the entire first two years of circuit theory.
//
// What it deliberately does NOT do is nonlinear devices: diodes, transistors,
// op-amps. Those need Newton–Raphson iteration on top, and pretending
// otherwise would be worse than not offering them.

export type Component = {
  kind: "R" | "C" | "L" | "V" | "I";
  name: string;
  /** Node names; "0" or "gnd" is ground. */
  a: string;
  b: string;
  /** Ohms, farads, henries, volts or amps depending on kind. */
  value: number;
};

export type Netlist = { components: Component[]; nodes: string[] };

/** SPICE-style engineering suffixes. "1k" is 1000, "1u" is 1e-6, "1meg" is 1e6. */
export function parseValue(raw: string): number {
  const m = /^(-?[\d.]+)\s*(meg|[a-zµ]*)$/i.exec(raw.trim());
  if (!m) return NaN;
  const n = Number(m[1]);
  const suffix = (m[2] || "").toLowerCase();
  const mult: Record<string, number> = {
    "": 1, f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3,
    k: 1e3, meg: 1e6, g: 1e9,
    // Unit letters people write out of habit: "10ohm", "100nf", "5v".
    ohm: 1, r: 1, v: 1, a: 1, hz: 1,
  };
  // "100nF" -> suffix "nf"; take the multiplier letter and ignore the unit.
  const key = suffix in mult ? suffix : suffix.slice(0, 3) in mult ? suffix.slice(0, 3) : suffix[0] ?? "";
  return n * (mult[key] ?? 1);
}

/**
 * Parse a SPICE-ish netlist.
 *
 *   V1 in 0 5
 *   R1 in out 1k
 *   R2 out 0 2k
 */
export function parseNetlist(src: string): Netlist {
  const components: Component[] = [];
  const nodes = new Set<string>();

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("*") || line.startsWith("#") || line.startsWith(".")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const [name, a, b, valueRaw] = parts;
    const kind = name[0].toUpperCase() as Component["kind"];
    if (!"RCLVI".includes(kind)) continue;
    const value = parseValue(valueRaw);
    if (!Number.isFinite(value)) continue;
    const na = norm(a);
    const nb = norm(b);
    components.push({ kind, name, a: na, b: nb, value });
    if (na !== "0") nodes.add(na);
    if (nb !== "0") nodes.add(nb);
  }
  return { components, nodes: [...nodes].sort() };
}

const norm = (n: string) => (n === "gnd" || n === "GND" || n === "0" ? "0" : n);

// ── Complex arithmetic, kept tiny and local ────────────────────────────────
type C = { re: number; im: number };
const c = (re: number, im = 0): C => ({ re, im });
const add = (x: C, y: C): C => c(x.re + y.re, x.im + y.im);
const sub = (x: C, y: C): C => c(x.re - y.re, x.im - y.im);
const mul = (x: C, y: C): C => c(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
const div = (x: C, y: C): C => {
  const d = y.re * y.re + y.im * y.im;
  return d === 0 ? c(0) : c((x.re * y.re + x.im * y.im) / d, (x.im * y.re - x.re * y.im) / d);
};
export const magnitude = (x: C) => Math.hypot(x.re, x.im);
export const phaseDeg = (x: C) => (Math.atan2(x.im, x.re) * 180) / Math.PI;

/**
 * Solve the circuit at one frequency. `freq = 0` gives the DC operating point,
 * where capacitors are open and inductors are shorts.
 *
 * Returns node voltages (complex) keyed by node name, plus the current through
 * each voltage source.
 */
export function solve(net: Netlist, freq = 0): { nodes: Record<string, C>; currents: Record<string, C> } | null {
  const nodeIndex = new Map<string, number>();
  net.nodes.forEach((n, i) => nodeIndex.set(n, i));
  const vSources = net.components.filter((k) => k.kind === "V");
  const n = net.nodes.length;
  const m = vSources.length;
  const size = n + m;
  if (size === 0) return null;

  // A·x = z, where x is [node voltages ... source currents].
  const A: C[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => c(0)));
  const z: C[] = Array.from({ length: size }, () => c(0));

  const w = 2 * Math.PI * freq;
  const at = (node: string) => (node === "0" ? -1 : nodeIndex.get(node)!);

  const stamp = (i: number, j: number, v: C) => {
    if (i >= 0 && j >= 0) A[i][j] = add(A[i][j], v);
  };

  for (const comp of net.components) {
    const i = at(comp.a);
    const j = at(comp.b);

    if (comp.kind === "R" || comp.kind === "C" || comp.kind === "L") {
      // Admittance: 1/R for a resistor, jwC for a capacitor, 1/(jwL) for an
      // inductor. At DC that makes C an open circuit and L a short, which is
      // exactly the behaviour a student is being taught.
      let y: C;
      if (comp.kind === "R") y = c(1 / comp.value);
      else if (comp.kind === "C") y = c(0, w * comp.value);
      else y = w === 0 ? c(1e9) : div(c(1), c(0, w * comp.value));

      stamp(i, i, y);
      stamp(j, j, y);
      stamp(i, j, c(-y.re, -y.im));
      stamp(j, i, c(-y.re, -y.im));
    } else if (comp.kind === "I") {
      // A current source pushes current from a into b.
      if (i >= 0) z[i] = sub(z[i], c(comp.value));
      if (j >= 0) z[j] = add(z[j], c(comp.value));
    }
  }

  // Each voltage source adds one unknown (its current) and one equation
  // (the voltage it enforces between its two nodes).
  vSources.forEach((src, k) => {
    const row = n + k;
    const i = at(src.a);
    const j = at(src.b);
    if (i >= 0) {
      A[row][i] = add(A[row][i], c(1));
      A[i][row] = add(A[i][row], c(1));
    }
    if (j >= 0) {
      A[row][j] = sub(A[row][j], c(1));
      A[j][row] = sub(A[j][row], c(1));
    }
    z[row] = c(src.value);
  });

  const x = gaussian(A, z);
  if (!x) return null;

  const nodes: Record<string, C> = { "0": c(0) };
  net.nodes.forEach((name, i) => (nodes[name] = x[i]));
  const currents: Record<string, C> = {};
  vSources.forEach((src, k) => (currents[src.name] = x[n + k]));
  return { nodes, currents };
}

/** Gaussian elimination with partial pivoting over complex numbers. */
function gaussian(A: C[][], z: C[]): C[] | null {
  const size = z.length;
  const M = A.map((row, i) => [...row, z[i]]);

  for (let col = 0; col < size; col++) {
    // Pivot on the largest magnitude, or a singular matrix silently produces
    // nonsense instead of failing.
    let best = col;
    for (let r = col + 1; r < size; r++) {
      if (magnitude(M[r][col]) > magnitude(M[best][col])) best = r;
    }
    if (magnitude(M[best][col]) < 1e-15) return null;
    [M[col], M[best]] = [M[best], M[col]];

    for (let r = 0; r < size; r++) {
      if (r === col) continue;
      const f = div(M[r][col], M[col][col]);
      if (magnitude(f) === 0) continue;
      for (let k = col; k <= size; k++) M[r][k] = sub(M[r][k], mul(f, M[col][k]));
    }
  }

  return M.map((row, i) => div(row[size], M[i][i]));
}

/** Sweep a frequency range, returning |V| at one node in dB relative to input. */
export function acSweep(
  net: Netlist,
  outNode: string,
  fromHz: number,
  toHz: number,
  points = 60,
): { f: number; db: number; phase: number }[] {
  const out: { f: number; db: number; phase: number }[] = [];
  const logFrom = Math.log10(Math.max(0.01, fromHz));
  const logTo = Math.log10(Math.max(fromHz * 10, toHz));
  const source = net.components.find((k) => k.kind === "V");
  const vin = source?.value ?? 1;

  for (let i = 0; i <= points; i++) {
    const f = 10 ** (logFrom + ((logTo - logFrom) * i) / points);
    const r = solve(net, f);
    const v = r?.nodes[outNode];
    if (!v) continue;
    const mag = magnitude(v) / (vin || 1);
    out.push({
      f,
      db: 20 * Math.log10(Math.max(1e-9, mag)),
      phase: phaseDeg(v),
    });
  }
  return out;
}
