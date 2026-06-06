## Klausum bug-fix batch (6 confirmed bugs + YouTube transcript)

Minimum-change fixes, scoped to the components and server functions named in the brief. No refactors.

### Bug 1 — Formulas tab renders "undefined"
- `src/routes/_authenticated/materials.$id.tsx` → `FormulasTab`:
  - Resolve `latex` defensively: `f.latex ?? f.formula ?? f.expression ?? f.equation ?? f.content ?? ""`.
  - Resolve name: `f.name ?? f.title ?? "Formula"`.
  - Use resolved string for both KaTeX render and `Copy LaTeX` handler.
  - When resolved string is empty, render an "Formula could not be rendered" card with a `Regenerate` button that calls the new server fn below.
- `src/lib/materials.functions.ts`:
  - Tighten the extraction prompt so each formula MUST use the key `latex` (explicit "not formula/expression/equation").
  - In `normalizeProcessed`, normalise each formula to `{ name, latex, variables, subject }` using the same fallback chain so stored rows always have `latex`.

### Bug 2 — Gemini keys / disabled GCP projects (code-side improvements)
The actual enable-API step is user action in GCP. Code side:
- `src/lib/ai-gateway.ts` / `withGeminiRetry`:
  - Detect `403` + message containing `not been used in project` / `SERVICE_DISABLED` → **permanently** block that key (long TTL, e.g. 24h) via `blockGeminiKey`, and tag the error as `GEMINI_API_DISABLED` with the offending project id so callers can surface it.
  - Do not retry on this class of error (kept retry for 429/quota only).
- New server fn `checkGeminiKeys` in `src/lib/admin.functions.ts` (admin-gated): pings `…/v1beta/models?key=…` for every pooled key and returns `{ key: lastEightChars, ok, projectId? }`. Used by Settings.
- `src/components/settings/SecurityTab.tsx` (or a small new "AI Keys" card on Settings): button "Check Gemini key health" → renders table + deep links to `console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=<id>` for any disabled key.

### Bug 3 — Research source "Error" badge
- `src/components/research/SourcesPanel.tsx`:
  - Badge logic: red `Upload failed` only when `source_type === 'pdf' && !file_url`; yellow `Processing…` when `!processing_done && !processing_error`; amber `AI Error` + `Retry` button when `processing_error`; green `Ready` otherwise.
- `src/lib/research.functions.ts`: add `reprocessSource({ sourceId })` server fn → clears `processing_error` + `processing_done=false`, re-runs the existing processing pipeline. Wire to the Retry button.

### Bug 4 — Per-page chat "I had trouble responding"
- `src/components/reader/MaterialAIChat.tsx`: in the catch branch, inspect `err.message` and show:
  - `GEMINI_API_DISABLED` → "⚠️ AI service isn't configured. Check Settings → AI keys."
  - `429`/rate-limit → "⏱ The AI is busy. Wait a minute and try again."
  - otherwise the existing generic line.
- Same treatment in `src/components/research/ResearchChatPanel.tsx`.

### Bug 5 — Summary key-ideas all identical
- `src/lib/materials.functions.ts` `normalizeProcessed`:
  - Remove the synthetic `key_concepts[0] = { concept: title, definition: summary, … }` fallback. Leave the array empty when Gemini gave nothing real.
  - Remove the per-item fallback `definition: firstSentences(summary, 1)` — keep only items that have a real definition.
- `src/routes/_authenticated/materials.$id.tsx` `SummaryTab`:
  - When `key_concepts` is missing/empty, render an honest empty state with `↺ Extract Key Concepts` button.
  - Button calls new server fn `regenerateKeyConcepts({ materialId })` (uses `generateObjectSafe` + Gemini Flash, prompt explicitly requires 8–12 *different* concept-specific definitions, persists to `study_materials.key_concepts`).
  - Suppress any concept whose `definition === material.ai_summary` (defensive against legacy rows).

### Bug 6 — Bloom Q&A generic template
- `src/lib/materials.functions.ts`: drop the `bloom_questions[level].push({ question: \`${level}: What should you understand…\` })` fallback. Leave levels empty when Gemini returned nothing.
- `src/routes/_authenticated/materials.$id.tsx` `BloomTab`:
  - Compute `hasRealQuestions` (any level has an item whose question doesn't include "What should you understand about").
  - If false, render empty state + `↺ Generate Bloom Questions`.
  - Server fn `regenerateBloomQuestions({ materialId })` with the prompt from the brief; persist to `study_materials.bloom_questions`.

### YouTube transcript (secondary fix)
Stack rule: no Supabase Edge Functions. Implement as a TanStack server fn.
- New `fetchYoutubeTranscriptServer({ videoId })` in `src/lib/research.functions.ts` (uses Worker-safe `fetch`, regex extraction of `captionTracks` → timedtext XML → plain text; falls back to title + `shortDescription`). Reused by `addSourceFromYoutube` instead of the current oembed-only path.
- `src/components/research/SourceViewer.tsx`: when a YouTube source has no transcript, render the "no transcript" card with "Watch on YouTube ↗".

### Files touched
- Edited: `src/routes/_authenticated/materials.$id.tsx`, `src/lib/materials.functions.ts`, `src/lib/research.functions.ts`, `src/lib/ai-gateway.ts`, `src/lib/admin.functions.ts`, `src/components/reader/MaterialAIChat.tsx`, `src/components/research/ResearchChatPanel.tsx`, `src/components/research/SourcesPanel.tsx`, `src/components/research/SourceViewer.tsx`, `src/components/settings/SecurityTab.tsx`.
- No new tables, no new packages, no migrations.

### Out of scope
- Actually enabling the GCP APIs (user action).
- Any refactor not listed above.
