# Anara-Style Reader Upgrades

Four tightly scoped additions to the PDF reader + AI chat. No backend schema changes required (uses existing `material_notes` if present; otherwise adds a tiny table).

## 1. Highlight-to-Ask Popup (PDFViewer)

In `src/components/reader/PDFViewer.tsx`:
- Listen for `mouseup`/`selectionchange` inside the PDF text layer.
- When a non-empty selection exists, render a small floating popup anchored to the selection rect with two buttons:
  - **Explain this** → calls existing `onSelection(text, page)` prop (already wired to `MaterialAIChat` selection chip) and auto-sends an "Explain this passage" message.
  - **Add to notes** → appends `> "{text}" — p.N` to the material's notes (Notes tab on `materials.$id`).
- Popup auto-dismisses on click-away or new selection.
- Mobile: same popup, larger tap targets, positioned above selection.

## 2. Page-Cited AI Responses (chip rendering)

Already partially done — `ReplyWithJumps` in `MaterialAIChat.tsx` renders `[p.N]` tokens as jump chips.
- Update `chatWithMaterial` system prompt (`src/lib/material-chat.functions.ts`) to **require** every answer end with a `Sources:` line listing `[p.N]` chips for each page used.
- Strengthen the rule: "If you used the current page, cite it. If you referenced other pages from the index, cite each. Never answer without at least one citation when document content was used."
- Render the trailing `Sources:` line as a distinct chip row (small, muted, right-aligned) below the markdown body.

## 3. Document Summary + TOC on Open

New server fn `summarizeMaterial` in `src/lib/materials.functions.ts`:
- Input: `materialId`, `accessToken`.
- Reads `extracted_text` + `page_index` (already stored), calls Gemini via `withGeminiRetry` for:
  - `summary`: 3–5 sentence overview.
  - `toc`: array of `{ title, page }` detected from headings (regex pre-pass + LLM cleanup).
- Caches result to a new column `ai_summary jsonb` on `materials` (single migration: `ALTER TABLE materials ADD COLUMN ai_summary jsonb`). Cache hit returns immediately; no re-spend.

In `materials.$id`:
- On mount, fetch summary. Show it as the **first AI bubble** in `MaterialAIChat` (pinned, labeled "📄 Document overview").
- Render TOC in a new collapsible left rail (above the PDF or as a `Sheet` on mobile). Each row is a button → calls `onJumpToPage(page)`.

## 4. Notes Append Plumbing

If `material_notes` table already exists (per earlier plan), reuse it. Otherwise add:
```
material_notes(id, user_id, material_id, content text, created_at)
```
with RLS scoped to `auth.uid()` and standard GRANTs. "Add to notes" appends a markdown blockquote with page citation.

## Files touched

- `src/components/reader/PDFViewer.tsx` — selection popup, expose selection rect.
- `src/components/reader/MaterialAIChat.tsx` — pinned summary bubble, citation row rendering, auto-send "Explain this" on popup action.
- `src/lib/material-chat.functions.ts` — stricter citation rule in system prompt.
- `src/lib/materials.functions.ts` — new `summarizeMaterial` + `appendMaterialNote` server fns.
- `src/routes/_authenticated/materials.$id.tsx` — TOC rail, fetch summary on open, wire popup actions.
- 1 migration: `ai_summary jsonb` on `materials` (+ `material_notes` if missing).

## Out of scope

- Voice mode, audio recap, multi-page synthesis, pinned snippets panel, engagement badges, quiz redesign, key rotation changes — all already shipped or covered by separate plans.
- Cross-document chat.

Ready to implement on approval.