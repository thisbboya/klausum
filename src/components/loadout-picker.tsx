// The choice half of Core Drive 3. Shown before a session starts, so the
// student decides how the session will run rather than being handed one.
//
// Two slots, not five: a menu where you take everything is a settings page,
// and settings pages are not decisions. Having to give something up is what
// makes the pick mean anything.
import { Check, Swords } from "lucide-react";
import {
  TACTICS,
  MAX_TACTICS,
  loadoutMultiplier,
  type TacticId,
} from "@/lib/loadout";

export function LoadoutPicker({
  selected,
  onChange,
  onStart,
  dueCount,
}: {
  selected: TacticId[];
  onChange: (ids: TacticId[]) => void;
  onStart: () => void;
  dueCount: number;
}) {
  const mult = loadoutMultiplier(selected);
  const full = selected.length >= MAX_TACTICS;

  function toggle(id: TacticId) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (!full) onChange([...selected, id]);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="text-center">
        <Swords className="mx-auto h-9 w-9 text-primary" />
        <h1 className="mt-2 font-display text-2xl font-extrabold">Pick your loadout</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {dueCount} card{dueCount === 1 ? "" : "s"} waiting. Take up to {MAX_TACTICS} tactics —
          each makes the session harder and the XP bigger. Or take none.
        </p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {TACTICS.map((t) => {
          const on = selected.includes(t.id);
          const locked = full && !on;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              disabled={locked}
              className={`relative rounded-2xl border-2 p-3 text-left transition ${
                on
                  ? "border-primary bg-primary/10"
                  : locked
                    ? "border-border bg-card opacity-40"
                    : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.tone}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold">{t.name}</span>
                    <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-success">
                      ×{t.mult}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold leading-snug">{t.desc}</p>
                  {/* The downside is stated as loudly as the reward. A tactic
                      that only advertises its multiplier is a trap, not a
                      choice. */}
                  <p className="mt-1 text-[11px] font-semibold leading-snug text-muted-foreground">
                    {t.risk}
                  </p>
                </div>
                {on && (
                  <span className="shrink-0 rounded-full bg-primary p-1 text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card p-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
            XP multiplier
          </div>
          <div className="font-display text-2xl font-extrabold tabular-nums text-success">
            ×{mult.toFixed(2).replace(/\.?0+$/, "")}
          </div>
        </div>
        <button
          onClick={onStart}
          className="btn-3d rounded-xl bg-primary px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-primary-foreground"
        >
          Start session
        </button>
      </div>
    </div>
  );
}
