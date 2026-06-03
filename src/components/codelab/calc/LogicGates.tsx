import { useState } from "react";

const GATES: Record<string, (vs: boolean[]) => boolean> = {
  AND: (v) => v.every(Boolean),
  OR: (v) => v.some(Boolean),
  NAND: (v) => !v.every(Boolean),
  NOR: (v) => !v.some(Boolean),
  XOR: (v) => v.filter(Boolean).length % 2 === 1,
  XNOR: (v) => v.filter(Boolean).length % 2 === 0,
  NOT: (v) => !v[0],
};

export function LogicGates() {
  const [gate, setGate] = useState<keyof typeof GATES>("AND");
  const [n, setN] = useState(2);
  const inputCount = gate === "NOT" ? 1 : n;
  const rows = 1 << inputCount;
  const labels = "ABCD".slice(0, inputCount).split("");

  const [expr, setExpr] = useState("A & B | !C");
  const exprResult = (() => {
    try {
      // Strict allow-list: only A-Z, &, |, !, (, ), and whitespace
      if (!/^[A-Z&|!()\s]*$/.test(expr)) throw new Error("Invalid characters");
      const vars = Array.from(new Set(expr.match(/[A-Z]/g) ?? []));
      // Safe recursive-descent boolean evaluator (no eval / new Function)
      const evalExpr = (env: Record<string, boolean>): boolean => {
        let i = 0;
        const s = expr.replace(/\s+/g, "");
        const peek = () => s[i];
        const eat = (c: string) => { if (s[i] !== c) throw new Error("Parse error"); i++; };
        // grammar: or := and ('|' and)*  ; and := not ('&' not)* ; not := '!' not | atom ; atom := VAR | '(' or ')'
        const parseOr = (): boolean => {
          let v = parseAnd();
          while (peek() === "|") { eat("|"); v = parseAnd() || v; }
          return v;
        };
        const parseAnd = (): boolean => {
          let v = parseNot();
          while (peek() === "&") { eat("&"); v = parseNot() && v; }
          return v;
        };
        const parseNot = (): boolean => {
          if (peek() === "!") { eat("!"); return !parseNot(); }
          return parseAtom();
        };
        const parseAtom = (): boolean => {
          const c = peek();
          if (c === "(") { eat("("); const v = parseOr(); eat(")"); return v; }
          if (c && /[A-Z]/.test(c)) { i++; return !!env[c]; }
          throw new Error("Parse error");
        };
        const result = parseOr();
        if (i !== s.length) throw new Error("Trailing tokens");
        return result;
      };
      const out: { row: Record<string, number>; result: number }[] = [];
      for (let i = 0; i < (1 << vars.length); i++) {
        const row: Record<string, number> = {};
        const env: Record<string, boolean> = {};
        vars.forEach((v, idx) => {
          const bit = (i >> (vars.length - idx - 1)) & 1;
          row[v] = bit;
          env[v] = !!bit;
        });
        out.push({ row, result: evalExpr(env) ? 1 : 0 });
      }
      return { vars, out, error: null as string | null };
    } catch (e: any) {
      return { vars: [], out: [], error: e.message };
    }
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={gate} onChange={(e) => setGate(e.target.value as keyof typeof GATES)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
          {Object.keys(GATES).map((g) => <option key={g}>{g}</option>)}
        </select>
        {gate !== "NOT" && (
          <>
            <label className="text-xs text-muted-foreground">Inputs:</label>
            <select value={n} onChange={(e) => setN(parseInt(e.target.value))} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm">
              {[2, 3, 4].map((i) => <option key={i}>{i}</option>)}
            </select>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs font-mono">
          <thead className="bg-muted/40">
            <tr>{labels.map((l) => <th key={l} className="px-3 py-2 border-r border-border">{l}</th>)}<th className="px-3 py-2 text-primary">Out</th></tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => {
              const vs = labels.map((_, idx) => Boolean((i >> (inputCount - idx - 1)) & 1));
              const out = GATES[gate](vs);
              return (
                <tr key={i} className="border-t border-border/40">
                  {vs.map((v, idx) => <td key={idx} className="px-3 py-1.5 text-center border-r border-border/40">{v ? 1 : 0}</td>)}
                  <td className={`px-3 py-1.5 text-center font-bold ${out ? "text-emerald-400" : "text-rose-400"}`}>{out ? 1 : 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase text-muted-foreground">Expression evaluator</label>
        <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="A & B | !C" className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm" />
        <div className="text-[10px] text-muted-foreground">Operators: <code>&amp;</code> AND, <code>|</code> OR, <code>!</code> NOT. Variables: A-Z.</div>
        {exprResult.error ? (
          <div className="text-xs text-rose-400">Invalid expression</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs font-mono">
              <thead className="bg-muted/40"><tr>{exprResult.vars.map((v) => <th key={v} className="px-3 py-2 border-r border-border">{v}</th>)}<th className="px-3 py-2 text-primary">Out</th></tr></thead>
              <tbody>
                {exprResult.out.map((r, i) => (
                  <tr key={i} className="border-t border-border/40">
                    {exprResult.vars.map((v) => <td key={v} className="px-3 py-1.5 text-center border-r border-border/40">{r.row[v]}</td>)}
                    <td className={`px-3 py-1.5 text-center font-bold ${r.result ? "text-emerald-400" : "text-rose-400"}`}>{r.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
