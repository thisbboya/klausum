import { useState, useMemo } from "react";

type Mat = number[][];

function det2(m: Mat) { return m[0][0] * m[1][1] - m[0][1] * m[1][0]; }
function det3(m: Mat) {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}
function transpose(m: Mat): Mat { return m[0].map((_, c) => m.map((r) => r[c])); }
function add(a: Mat, b: Mat): Mat { return a.map((r, i) => r.map((v, j) => v + b[i][j])); }
function sub(a: Mat, b: Mat): Mat { return a.map((r, i) => r.map((v, j) => v - b[i][j])); }
function mul(a: Mat, b: Mat): Mat {
  const n = a.length;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => a[i].reduce((s, _, k) => s + a[i][k] * b[k][j], 0)));
}
function inv2(m: Mat): Mat | null { const d = det2(m); if (!d) return null; return [[m[1][1] / d, -m[0][1] / d], [-m[1][0] / d, m[0][0] / d]]; }
function inv3(m: Mat): Mat | null {
  const d = det3(m); if (!d) return null;
  const cof: Mat = [
    [m[1][1] * m[2][2] - m[1][2] * m[2][1], -(m[1][0] * m[2][2] - m[1][2] * m[2][0]), m[1][0] * m[2][1] - m[1][1] * m[2][0]],
    [-(m[0][1] * m[2][2] - m[0][2] * m[2][1]), m[0][0] * m[2][2] - m[0][2] * m[2][0], -(m[0][0] * m[2][1] - m[0][1] * m[2][0])],
    [m[0][1] * m[1][2] - m[0][2] * m[1][1], -(m[0][0] * m[1][2] - m[0][2] * m[1][0]), m[0][0] * m[1][1] - m[0][1] * m[1][0]],
  ];
  return transpose(cof).map((r) => r.map((v) => v / d));
}

function makeMat(size: number): Mat { return Array.from({ length: size }, () => Array(size).fill(0)); }

export function MatrixCalc() {
  const [size, setSize] = useState(2);
  const [op, setOp] = useState("add");
  const [A, setA] = useState<Mat>(() => [[1, 2], [3, 4]]);
  const [B, setB] = useState<Mat>(() => [[5, 6], [7, 8]]);

  function changeSize(s: number) {
    setSize(s);
    setA(makeMat(s).map((r, i) => r.map((_, j) => (i === j ? 1 : 0))));
    setB(makeMat(s).map((r, i) => r.map((_, j) => (i === j ? 1 : 0))));
  }

  function setCell(which: "A" | "B", i: number, j: number, v: string) {
    const num = parseFloat(v) || 0;
    const target = which === "A" ? A : B;
    const next = target.map((r) => [...r]);
    next[i][j] = num;
    (which === "A" ? setA : setB)(next);
  }

  const result = useMemo(() => {
    try {
      if (op === "addM") return add(A, B);
      if (op === "subM") return sub(A, B);
      if (op === "mulM") return mul(A, B);
      if (op === "tA") return transpose(A);
      if (op === "tB") return transpose(B);
      if (op === "detA") return [[size === 2 ? det2(A) : det3(A)]];
      if (op === "detB") return [[size === 2 ? det2(B) : det3(B)]];
      if (op === "invA") return size === 2 ? inv2(A) : inv3(A);
      if (op === "invB") return size === 2 ? inv2(B) : inv3(B);
      return null;
    } catch { return null; }
  }, [A, B, op, size]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs uppercase text-muted-foreground">Size:</span>
        {[2, 3].map((s) => (
          <button key={s} onClick={() => changeSize(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${size === s ? "bg-primary text-primary-foreground" : "border border-border"}`}>{s}×{s}</button>
        ))}
        <select value={op} onChange={(e) => setOp(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm ml-2">
          <option value="addM">A + B</option>
          <option value="subM">A − B</option>
          <option value="mulM">A × B</option>
          <option value="tA">transpose(A)</option>
          <option value="tB">transpose(B)</option>
          <option value="detA">det(A)</option>
          <option value="detB">det(B)</option>
          <option value="invA">inverse(A)</option>
          <option value="invB">inverse(B)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MatGrid title="A" m={A} onChange={(i, j, v) => setCell("A", i, j, v)} />
        <MatGrid title="B" m={B} onChange={(i, j, v) => setCell("B", i, j, v)} />
      </div>

      <div>
        <div className="text-xs uppercase text-muted-foreground mb-2">Result</div>
        {result ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 inline-block">
            <table className="font-mono text-sm">
              <tbody>
                {result.map((r, i) => (
                  <tr key={i}>{r.map((v, j) => <td key={j} className="px-3 py-1 text-primary">{Number(v.toPrecision(6))}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-rose-400">No result (singular matrix?)</div>
        )}
      </div>
    </div>
  );
}

function MatGrid({ title, m, onChange }: { title: string; m: Mat; onChange: (i: number, j: number, v: string) => void }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground mb-1">{title}</div>
      <div className="inline-block rounded-lg border border-border p-2 bg-card/40">
        {m.map((r, i) => (
          <div key={i} className="flex gap-1">
            {r.map((v, j) => (
              <input key={j} type="number" value={v} onChange={(e) => onChange(i, j, e.target.value)} className="w-14 rounded border border-border bg-background px-1.5 py-1 font-mono text-xs text-center" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
