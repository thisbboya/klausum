## Slice 7 — Knowledge Gaps: adaptive remediation loop

Right now `/gaps` lists weak topics with an Explain button and a manual Close. This slice closes the loop so each gap becomes actionable practice that automatically lowers in severity (or resolves) when the user demonstrates mastery.

### What you'll get

1. **Auto-promote severity** based on age and re-occurrence
   - When a quiz attempt is saved and a wrong answer maps to an existing open gap, increment a hit counter and bump severity (`low → moderate → critical`).
   - When a correct answer matches an open gap's topic, raise `confidence` and auto-resolve at ≥80%.

2. **One-click practice paths** on each gap card
   - **Mini-quiz (5 Qs)** — generate a focused quiz on just that topic via the existing AI quiz pipeline, tagged so its result feeds back into the gap.
   - **Flashcards** — generate a 6-card deck for the topic (front = sub-concept, back = explanation) and drop it into the user's decks.
   - **Tutor it** — open `/tutor` pre-seeded with a Socratic prompt about the topic.

3. **Severity & filter UI**
   - Filter chips: All / Critical / Moderate / Low / Closed.
   - Sort by severity then age. Show "X days open" on each card.
   - Empty/celebration state when 0 critical gaps remain.

4. **Gap → Schedule** (small)
   - "Add 25-min review block" button creates a `schedule_blocks` row tomorrow morning for that topic.

### Technical notes

- Add a `hit_count` integer column to `knowledge_gaps` (nullable, default 0) via migration. Existing RLS already covers it.
- New server fn `generateGapPractice` in `src/lib/coach.functions.ts` that takes `{ topic, subject, mode: "quiz" | "deck" }` and returns 5 MCQs or 6 cards using the same Lovable AI Gateway prompt style as the existing quiz/flashcard generators.
- Client writes go through the existing browser `supabase` client (RLS by user_id).
- On quiz attempt save (`quizzes.$id.results.tsx`), add a post-submit pass that:
  - reads open gaps for the user
  - for each wrong question, fuzzy-matches its topic/concept against open gaps (lowercase substring match on `topic`)
  - increments `hit_count` and escalates severity
  - for each correct question matching a gap, +15 confidence; resolve at ≥80
- `/gaps` page gains the filter chips and three new buttons per card; navigation uses TanStack `Link`/`useNavigate`.

### Files touched

- `supabase/migrations/<ts>_gap_hit_count.sql` (add column)
- `src/lib/coach.functions.ts` (add `generateGapPractice` server fn)
- `src/routes/_authenticated/gaps.tsx` (filters, action buttons, severity badges)
- `src/routes/_authenticated/quizzes.$id.results.tsx` (post-submit gap reconciliation)

### Out of scope

- Cross-material concept graph linking (Phase 3).
- Notifications / email reminders for stale gaps.

After this, remaining candidates: voice-notes polish, formula library polish, dashboard "today" focus widget, or settings/profile polish. I'll ask you to pick once Slice 7 lands.
