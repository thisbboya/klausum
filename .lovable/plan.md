# Slice 10 — Notes + Formulas polish

Make Cornell notes and the Formula Library feel like real study artifacts: live math rendering, polished PDF exports, and an AI-generated reference sheet per subject.

## 1. KaTeX in Cornell notes

Cornell notes already accept Markdown + `$LaTeX$` in the prompt, but render as raw text. Add live preview rendering across the three columns.

- Add a per-column "Edit / Preview" toggle in the Cornell editor (`src/routes/_authenticated/notes.tsx`).
- Preview mode renders Markdown + inline `$...$` and block `$$...$$` math via `react-markdown` + `remark-math` + `rehype-katex` (already have `katex` installed for the Formula Library).
- Defaults: Cue + Summary columns open in preview, Notes column opens in edit. Click toggles. Edit mode keeps the existing textarea behavior.
- Same renderer used in Formula Library's `SafeMath` is reused, plus inline math support.

## 2. PDF exports

Two export entry points, both client-side via `jspdf` + `html2canvas` (no server fns, no extra storage).

a. **Cornell note → PDF**
   - "Export PDF" button in the note editor toolbar.
   - Renders a hidden printable layout: title + subject header, 3-column Cornell grid (Cue 25% / Notes 75%), summary band at the bottom, page footer with date.
   - Preserves KaTeX rendering (uses the preview HTML, not raw text).
   - Filename: `{title}-cornell.pdf`.

b. **Formula Library → PDF reference sheet**
   - "Export PDF" button on `/formulas` (next to "Add formula").
   - Honors current subject filter + search query (exports the visible set).
   - Layout: 2-column grid, each formula = name + rendered KaTeX + subject chip + description. Auto page-breaks.
   - Filename: `formulas-{subject}.pdf`.

## 3. AI Reference Sheet (per subject)

New server fn `generateReferenceSheet` in a new file `src/lib/formulas.functions.ts`:

- Input: `subject` (string), optional `topic` hint.
- Pulls the user's existing formulas for that subject as seed context (server-side via `serviceSupabase`), asks Lovable AI (`google/gemini-2.5-flash`) to produce a curated 1-page reference sheet: 8–15 formulas with `name`, `latex`, `description`, `category`, `tags[]`.
- Returns structured JSON validated with Zod.
- UI: "Generate Reference Sheet" button on `/formulas` opens a dialog (subject dropdown of existing subjects + free-text override + optional topic). On generate, shows preview list with rendered KaTeX, each row has a checkbox; "Add selected" inserts into `formulas` table for the user.

## 4. Files

**Created**
- `src/lib/formulas.functions.ts` — `generateReferenceSheet` server fn
- `src/components/notes/MarkdownMath.tsx` — shared markdown+KaTeX renderer
- `src/components/notes/CornellPdfExport.tsx` — printable layout + export trigger
- `src/components/formulas/FormulasPdfExport.tsx` — printable formula sheet
- `src/components/formulas/ReferenceSheetDialog.tsx` — AI generation dialog

**Edited**
- `src/routes/_authenticated/notes.tsx` — column edit/preview toggles, Export PDF button
- `src/routes/_authenticated/formulas.tsx` — Export PDF + Reference Sheet buttons, swap `SafeMath` to use shared renderer

**New deps**
- `react-markdown`, `remark-math`, `rehype-katex`, `jspdf`, `html2canvas`

## Out of scope
- DOCX export (PDF only)
- Server-side PDF rendering
- Sharing reference sheets between users
- Editing formulas inline in the AI preview (user can edit after insert)

After approval I'll ship in one pass and then move to Slice 11 (PWA + offline).
