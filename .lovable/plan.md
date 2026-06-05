# Anara-Style Research Workspace (v9 Part 2)

A new `/research` area where students collect multiple sources (PDF / URL / YouTube / pasted text) into a project, view them side-by-side with annotations, and chat with an AI that cites the exact source + page for every claim.

## 1. Database (one migration)

Four new tables, all RLS-scoped to `auth.uid()`, with explicit GRANTs to `authenticated` + `service_role`.

- `research_projects` — id, user_id, title, description, subject, color, source_count, timestamps
- `research_sources` — id, project_id, user_id, title, source_type (`pdf|url|text|youtube|note`), file_url, raw_url, extracted_text, page_count, word_count, summary, key_claims jsonb, processing_done, created_at
- `research_annotations` — id, source_id, user_id, page_number, selected_text, note, color, tag, position jsonb, created_at
- `research_chat_sessions` — id, project_id, user_id, messages jsonb, timestamps

Trigger to keep `research_projects.source_count` and `updated_at` in sync when sources change. Reuse the existing `materials` Storage bucket for PDF uploads (no new bucket).

## 2. Server functions (`src/lib/research.functions.ts`)

All protected with `requireSupabaseAuth`, JSON validated with Zod, AI calls routed through existing `ai-gateway` + `generateObjectSafe`.

- `listProjects` / `createProject` / `updateProject` / `deleteProject`
- `listSources(projectId)` / `getSource(id)` / `deleteSource`
- `addSourceFromPdf` — accepts base64, uploads to `materials` bucket, kicks off processing
- `addSourceFromUrl` — server-side fetch + simple Readability-style strip
- `addSourceFromYoutube` — reuse existing youtube transcript path
- `addSourceFromText` — plain paste
- `processSource` — extract text → 300-word summary → key claims `[{claim, page, confidence}]`, sets `processing_done`
- `listAnnotations(sourceId)` / `createAnnotation` / `deleteAnnotation`
- `chatResearch({ projectId, scope: 'source'|'project', sourceId?, message, history })` — builds the scoped system prompt from v9 spec; always returns text with inline `[p.N]` (single-source) or `[Source Name, p.N]` (multi-source) citations
- `generateReference({ sourceId, style })` — APA/MLA/Chicago/Harvard/Vancouver/IEEE
- `exportProjectMarkdown(projectId)` — returns a `.md` string with sources, annotations, chat, references

## 3. Routes & components

```
src/routes/_authenticated/research.tsx          # layout w/ <Outlet />
src/routes/_authenticated/research.index.tsx    # projects grid + create modal
src/routes/_authenticated/research.$projectId.tsx  # three-panel workspace

src/components/research/
  ProjectCard.tsx
  CreateProjectDialog.tsx
  SourcesPanel.tsx          # add source modal (PDF/URL/YT/text), list, rename/delete/summarise
  SourceViewer.tsx          # PDF (reuse existing PDFViewer), URL/text/youtube fallbacks
  AnnotationLayer.tsx       # selection popover: Annotate / Explain / Flashcard / Copy; coloured highlights overlay
  ResearchChatPanel.tsx     # scope toggle, message list, citation chips, quick actions, references button
  CitationChip.tsx          # clickable [Source N, p.M] → switches viewer + page
  GenerateReferencesDialog.tsx
```

Reuse: existing `PDFViewer.tsx` for PDF rendering + selection plumbing, existing `MarkdownMath` for messages, existing `safeParseJSON`/`generateObjectSafe`.

Sidebar (`src/components/mobile-nav.tsx` and any desktop nav): add "Research" entry below AI Tutor with a flask icon.

## 4. Behaviour details

- **Citation chips** are parsed from the rendered AI text; clicking sets the active source and jumps the viewer to that page (same mechanism as the existing reader `[p.N]` chips).
- **Scope = "This source only"**: chunk extracted text (~12k chars) around current page; prompt forbids outside knowledge.
- **Scope = "All sources"**: inject titles + 300-word summaries for up to 8 sources; prompt requires per-source citation + explicit "sources disagree" handling.
- **Quick actions** (empty chat): 6 preset prompts from spec.
- **Annotations** render as coloured rectangles over the PDF page using stored `position` (x/y/w/h normalised to page size).
- **Mobile**: three-tab switcher (Sources / Document / Chat) instead of three panels.
- **Export**: client downloads the `.md` blob returned by `exportProjectMarkdown`.

## 5. Out of scope (separate v9 batches)

Parts 3 (Duolingo rebuild), 4 (photo-math), 5 (labs), 6 (polish pack), 7 (security), 8 (perf). The Piston→Judge0→AI fallback chain stays as-is per your decision. No new heavy npm packages in this batch — `react-pdf` and the citation chip logic already exist in the reader.

## Technical notes

- New tables follow project convention: `CREATE TABLE` → `GRANT SELECT,INSERT,UPDATE,DELETE TO authenticated` + `GRANT ALL TO service_role` → `ENABLE RLS` → policies.
- `research_chat_sessions.messages` stored as `jsonb` array of `{role, content, citations}`; matches existing `tutor_sessions` pattern.
- PDF processing reuses the existing Gemini base64 extraction path from `processMaterial` so we don't duplicate logic — `addSourceFromPdf` calls a shared helper.
- All AI calls go through `withGeminiRetry` + `generateObjectSafe` so multi-key pooling and JSON fence stripping apply automatically.
