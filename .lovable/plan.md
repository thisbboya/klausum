## What I'll build

A focused rebuild of the **material reader + AI chat**, the **quiz pipeline**, and the **engagement loop**, plus the missing **PowerPoint upload** path and **proper Gemini key rotation** across your 5+ keys.

I grouped the work into 6 themes. Each item maps to a real symptom you described.

---

### 1. AI key rotation actually works (your 5 Gemini keys + Lovable fallback)

Right now `resolveModel` only reads `GEMINI_API_KEY` and ignores `GEMINI_API_KEY_2..8`. The rotating pool file (`gemini-keys.server.ts`) exists but nothing calls it.

- Rewrite `src/lib/ai-gateway.ts` so `resolveModel` calls `pickGeminiKey()` from the pool — Round-robin by lowest call count, soft cap 15 req/min/key.
- Wrap every AI call (`generateText`, `generateObject`) with a retry helper that on 429/quota/permission errors calls `blockGeminiKey(key, 60s)` and re-resolves with the next key. Fall back to Lovable AI Gateway when the whole pool is blocked.
- Apply the helper everywhere we generate: material processing, quiz generation, material chat, formulas, voice, video-quiz, transcribe.

### 2. PDF reader fixes (size + AI awareness + scanned-PDF OCR fallback)

- **Bigger viewer.** Switch the reader layout to `h-[calc(100vh-7rem)]`, drop the outer card padding inside the read tab, and use a 70/30 split on desktop (PDF on left, AI panel on right). On mobile, the reader takes full height.
- **Fit-to-width by default**, with a "Fit page / Fit width / Actual" toggle next to the +/- zoom. Persist last zoom per user in localStorage.
- **Page-aware AI for real.** Today the page text gets sent, but flaky on first paint because chat mounts before the first render finishes. I'll make `onPageChange` fire synchronously with the cached page text and gate the chat send button until at least page 1 text is captured. Add a small "AI is reading p.X" indicator so it's visible.
- **Scanned PDFs.** If pdf.js extracts <500 chars / <100 letters for a page, call a new server fn `ocrPdfPage` that streams the page image to Gemini Vision and stores the OCR text in `pdf_ocr_pages` (cached per material+page). Chat then uses the OCR text transparently.
- **Highlight-to-explain** (Anara): the "Ask AI about this" pill that pops above a selection already exists — I'll wire a second action "Explain this passage" that sends a pre-built prompt with definition + example + analogy, plus stores the highlight as a yellow underline overlay you can revisit.
- **Citations**: AI replies already emit `[p.N]` jump chips. I'll also have the model return a short quoted snippet for each citation and render it as a hoverable tooltip.

### 3. Quizzes — bigger text, pick the section, generate from material, generate from PDF pages

- **Typography:** question text bumped to `text-xl md:text-2xl leading-relaxed`, options to `text-base md:text-lg`, with bigger tap targets (min-h 56px) and a focus ring. Same for the per-question feedback panel.
- **"Quiz this material" button** in `materials/$id` — pre-fills the quiz generator with the material AND opens the new section picker.
- **Section/page-range picker** in the quiz creation form. When a material is chosen:
   - For PDFs we use the indexed page map already collected by the reader. The picker shows: "All pages", "Current page only", "Pages X–Y", and (if the material has `key_concepts`) a multi-select of concepts.
   - For text materials we use the chunked pages from `chunkTextPages`.
   - The selected text becomes the `context` sent to `generateQuiz`, and the picked range is also saved on the quiz row so you can rerun it.
- **Bloom Q&A → quiz**: in the material reader's Bloom Q&A tab, each level gets a one-click "Make a 5-question quiz from L3" button.
- **Server fix**: pass full `extracted_text` (we already store it on materials) for binary uploads — current path uses `original_content` which can be empty for PDFs, which is why "no questions from material" was happening.

### 4. PowerPoint upload + better extraction

- Accept `.ppt, .pptx` in the file input.
- Server-side `processMaterial` already accepts `mimeType` — I'll add `application/vnd.openxmlformats-officedocument.presentationml.presentation` and `application/vnd.ms-powerpoint` to the allowlist and forward the file directly to Gemini as `file` content (Gemini natively reads PPTX). For very large decks (>20 MB) we surface a friendly error.
- Same path opens the door for `.docx` (already in the accept attribute but mime wasn't allowlisted) and `.xlsx`.

### 5. Anara-style reader upgrades

Concrete subset implemented (you can flag any to skip when you approve):

- **Voice mode**: a mic button in the AI chat that records, transcribes via your existing `/api/transcribe`, and speaks the AI reply with the Web Speech API. Reuses the rotating Gemini pool.
- **Audio recap**: from the material header, a "🎧 Listen to recap" button generates a 2-minute spoken summary of `ai_summary + key_concepts` using Web Speech with proper pacing; queued so it plays slide-by-slide if you change pages.
- **Smart questions panel**: under the AI chat, 4 dynamically generated follow-up questions pulled from the page you're on (regenerated when the page changes).
- **Multi-page synthesis**: an "Explain across pages X–Y" command — picks a page range from the indexed text and asks the AI to synthesise without losing citations.
- **Pinned snippets**: any highlight can be saved as a card on a right-hand "Pins" tray; pins are sent as additional context in subsequent chats.
- **Notes side tab**: a markdown notes pane per material that persists to `material_notes` (new table), with a "Save AI reply as note" button on every assistant message.

### 6. Duolingo-style engagement loop

- **Streak save dialog**: when you load any authenticated page and missed yesterday, show a 1-tap "Use a streak freeze" sheet (table already supports this).
- **Daily goal ring** on the dashboard with a satisfying fill animation when you cross the daily XP target, plus a small confetti burst.
- **Combo multipliers in quizzes**: 3 in a row = 1.5×, 5 = 2× XP. Shows a side rail with the current combo and breaks on a wrong answer.
- **Perfect-quiz chest**: 100% on a 5+ question quiz drops a chest with gems via the capped `grant_rewards` RPC.
- **League promotion toast**: when your weekly XP crosses a threshold, throw a "You're now in Gold!" celebration.
- **Achievement badges**: 10 new ones — First Quiz, First Material, 7-Day Streak, 30-Day Streak, Bloom Champion, Night Owl, Speed Demon, Perfectionist, Polyglot, Sage. Persisted in a new `user_achievements` table.
- **Weekly Wrapped**: extend the existing `/wrapped` route with charts of XP per day, hardest concept, best subject.

---

### Technical notes (skip if not interested)

- All AI keys stay server-only. The rotation helper lives in `src/lib/ai-gateway.ts` next to `resolveModel`.
- OCR cache table:
  ```text
  pdf_ocr_pages (material_id, page_number, text, created_at)
  PK (material_id, page_number); RLS scoped via materials owner
  ```
- New tables: `material_notes`, `material_pins`, `user_achievements`. All RLS-scoped to `auth.uid()` and granted to `authenticated` + `service_role`.
- The `material_chat_messages` RLS already covers chat history; no schema change there.
- Quiz `questions` JSON shape unchanged → no migration; only the form + take page evolve.
- `processMaterial` will get a new `mimeType` allowlist and a longer `maxOutputTokens` for PPTX (decks need more headroom).
- Server-fn rate-limit handling will return a typed `{ error: "rate_limited" | "credits" | "unknown" }` so the client toasts cleanly.

### Out of scope (call out and confirm)

- I'm not adding a public Anara-style "drop a URL" web import this round — say the word and I'll bolt it on next.
- "Anara features" is broad — I picked the most-cited ones (highlight-to-explain, citations, voice mode, audio recap, pins, multi-page synthesis). If you want anything else (e.g. cross-document chat across all your materials), flag it before approval.
- I'll keep the existing color tokens and dark theme; no visual redesign of the rest of the app.

When you approve I'll execute in this order so each step is independently usable: **(a)** Gemini rotation → **(b)** reader layout + AI awareness fixes → **(c)** PPTX + extraction fixes → **(d)** quiz section picker + typography → **(e)** Anara additions → **(f)** engagement loop. Each migration runs only after the code that uses it is staged.
