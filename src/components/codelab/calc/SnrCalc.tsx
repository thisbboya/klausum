import { useState } from "react";

export function SnrCalc() {
  const [ps, setPs] = useState("10");
  const [pn, setPn] = useState("0.1");
  const psn = parseFloat(ps);
  const pnn = parseFloat(pn);
  const snr = !isNaN(psn) && !isNaN(pnn) && pnn > 0 ? 10 * Math.log10(psn / pnn) : NaN;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">SNR (dB) = 10·log₁₀(Pₛ / Pₙ)</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Signal power Pₛ" v={ps} setV={setPs} />
        <Field label="Noise power Pₙ" v={pn} setV={setPn} />
      </div>
      <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-3">
        <div className="text-[10px] uppercase text-muted-foreground">SNR</div>
        <div className="font-mono text-lg text-primary">
          {isNaN(snr) ? "—" : `${snr.toFixed(2)} dB`}
        </div>
      </div>
    </div>
  );
}

function Field({ label, v, setV }: { label: string; v: string; setV: (s: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
      />
    </div>
  );
}
