## Slice 9 — Code Lab depth

Turn the Code Lab into a full coding workbench: persistent snippets, AI test generation, AI code explanation, and a tabbed Engineering Calculator with 6 widgets.

### 1. Snippets Library (persistent)

New table `code_snippets`:
- `id`, `user_id`, `title`, `language`, `code`, `tags[]`, `is_favorite`, `created_at`, `updated_at`
- RLS: users own their snippets

UI on `/codelab`:
- Collapsible left rail listing the user's saved snippets (title + language chip + star)
- "Save snippet" button in the editor toolbar — opens a small dialog (title, optional tags) and stores current `code` + `lang`
- Click a snippet → loads it into the editor
- Inline rename, delete, favorite-toggle
- Search input filters by title/tag

### 2. Generate Tests (AI)

New server fn `generateTests` in `src/lib/lab.functions.ts`:
- Input: `language`, `code`
- Output: `{ tests: string, framework: string, notes: string }`
- Uses an idiomatic framework per language (pytest, vitest/jest, JUnit, Catch2, Go testing, Rust `#[test]`)

UI: "Generate tests" button in the editor toolbar. Result shown in a side panel with:
- Copy-to-clipboard
- "Open in editor" (replaces editor with combined code+tests so the user can run)

### 3. Explain Code (AI)

New server fn `explainCode`:
- Input: `language`, `code`
- Output: structured explanation `{ summary, line_by_line: [{lines, explanation}], complexity, suggestions[] }`

UI: "Explain" button next to "Run". Result rendered as collapsible sections under the existing AI panel.

### 4. Engineering Calculators (tabbed widget below editor)

New component `src/components/codelab/EngineeringCalculators.tsx` with a tab strip:

1. **Unit converter** — length, mass, temperature, time, volume, pressure, energy, data. Two-column input/output with live conversion (pure JS, no AI).
2. **Ohm's law** — V/I/R/P solver: enter any 2, get the other 2. Includes formula display and worked-step output.
3. **Resistor decoder** — 4-band and 5-band color picker → resistance ± tolerance. Visual resistor with selectable color bands.
4. **Logic gates** — truth-table builder. User picks gate (AND/OR/NOT/NAND/NOR/XOR/XNOR) and number of inputs (2–4); table renders live. Bonus: small expression evaluator (`A & B | !C`).
5. **Statistics** — paste comma/newline-separated numbers → mean, median, mode, range, variance, stdev, quartiles, min/max, count.
6. **Matrix** — 2×2 and 3×3 operations: add, subtract, multiply, transpose, determinant, inverse. Editable grid inputs.

All calculators are pure client-side, no AI calls, no DB. Reuse existing semantic tokens.

### 5. Layout reshape

Restructure `/codelab` into a 3-pane responsive layout:
```text
+----------------+----------------------------------+
| Snippets rail  |  Editor (Monaco)                 |
| (collapsible)  |  + toolbar: Run / Save / Tests / |
|                |    Explain                       |
|                +----------------------------------+
|                |  stdin | output                  |
|                +----------------------------------+
|                |  AI panel (debug/explain/tests)  |
+----------------+----------------------------------+
| Engineering Calculators (full-width tabs below)   |
+---------------------------------------------------+
```

On viewports < 768px the snippets rail becomes a top accordion and calculator tabs scroll horizontally.

### Files

**Created**
- `supabase/migrations/<ts>_code_snippets.sql` — new table + RLS
- `src/components/codelab/SnippetsRail.tsx`
- `src/components/codelab/EngineeringCalculators.tsx`
- `src/components/codelab/calc/UnitConverter.tsx`
- `src/components/codelab/calc/OhmsLaw.tsx`
- `src/components/codelab/calc/ResistorDecoder.tsx`
- `src/components/codelab/calc/LogicGates.tsx`
- `src/components/codelab/calc/StatsCalc.tsx`
- `src/components/codelab/calc/MatrixCalc.tsx`

**Edited**
- `src/lib/lab.functions.ts` — add `generateTests` and `explainCode` server fns
- `src/routes/_authenticated/codelab.tsx` — new layout, integrate snippets rail, new toolbar buttons, calculator tabs

### Out of scope (deferred)
- Multi-file projects / package installs in the runner
- Real test execution (we generate, user runs)
- Saving calculator results (kept stateless for now)

After approval I'll ship this in one pass and then move to Slice 10 (Notes + Formulas polish: KaTeX in Cornell, PDF exports, AI Reference Sheet).