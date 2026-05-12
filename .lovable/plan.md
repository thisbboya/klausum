# Fix all non-working buttons & tools

I went page by page. Here's what's actually broken vs. what only feels broken, and the fix for each.

## 1. Dark mode is hardcoded (the big one)

**Problem:** `src/routes/__root.tsx` renders `<html className="dark">` literally — the `dark_mode` checkbox in Settings → Preferences saves to the DB but **nothing reads it**. Toggling does nothing visible.

**Fix:**
- New `src/components/theme-provider.tsx` with `ThemeProvider` + `useTheme()`. On mount it reads `localStorage("klausum-theme")` (fallback: `"dark"`), then keeps `<html>`'s `class` (`dark` / removed) in sync. Mount it in `RootComponent`.
- New `src/components/theme-toggle.tsx` — sun/moon icon button. Place it in:
  - the desktop sidebar footer (next to "Sign out")
  - the mobile top bar
- `Settings → Preferences` "Dark mode" checkbox now writes to BOTH the profile (so it follows the user across devices) AND the `useTheme()` setter, so it takes effect instantly.
- On login / when profile loads, if `profile.dark_mode` differs from local theme, sync local → profile value (so the device picks up the saved preference).
- Remove the literal `className="dark"` from the `<html>` shell so the provider can control it.

## 2. Mobile nav is mostly missing

`MobileTopBar` only links to Dashboard/Materials/Review/Tutor + Sign out. No Quizzes, Code Lab, Admin, Settings, etc. — which is why on mobile most things "don't respond" (you can't reach them).

**Fix:** Replace the inline strip with a hamburger ⇒ slide-in `Sheet` containing the SAME nav list as the desktop sidebar (including the conditional `Admin` link and the new theme toggle + Sign out).

## 3. Admin tab

The hook + server fns are correct, but two practical issues:

- The `useIsAdmin` query never runs until the user is loaded, and during that gap the sidebar Admin link briefly disappears/reappears. **Fix:** keep query enabled but show the link only when `data` resolved with admin (no flash).
- "Make admin / Remove admin" buttons fire `setRoleFn` with no loading state; on slow networks the user double-clicks → toast spam. **Fix:** add `disabled` while pending and per-row spinner.
- Confirm `adminListUsers` returns; if `auth.admin.listUsers` errors (e.g. cold start), the table renders empty with no message. **Fix:** surface error toast and an inline retry button.
- Admin link still hidden on mobile — fixed by item 2.

## 4. Code Lab

The page itself works but two things make people say "doesn't work":

- **"Run" calls public Piston API** (`emkc.org`) — sometimes blocked / rate-limited. On failure we show "Run failed: …" but no hint. **Fix:** show a clear toast + an inline note ("Public sandbox is busy — try again or use Explain/Tests"). No backend change required.
- **AI buttons (Explain / Tests / Hint)** silently fail when the session expired. They go through `getAccessToken()` already — we'll wrap each in a `try/catch` that on `Unauthorized` redirects to `/login` with a returnTo, instead of a silent toast.
- **Snippets rail "Save"** — verify the save button writes to `code_snippets` and refreshes the list (read `SnippetsRail.tsx` and patch if the insert path is broken).

## 5. Quizzes

Generation and Take pages look wired correctly. Two real bugs:

- The "Take" link from the list uses `search={{ timer: 0 }}` but the `validateSearch` only accepts `number` — that works. However when generation finishes we navigate with `timer: timer ? 30 : 0` — if `timer === false` it's `0`, OK. The actual failure people hit: **`generateQuiz` server fn occasionally returns < 1 question and we still insert** → "Take" page renders empty and looks frozen. **Fix:** if `r.questions.length === 0` toast an error and don't insert/navigate.
- **"Bloom Normalize" button** on advanced panel rounds to integers and can land at 99% or 101%, then "Generate" rejects. **Fix:** fix the rounding so the last bucket absorbs the remainder; also make the validator accept ±3% (already ±2 — bump and self-correct).
- **Per-row "Take" button** works; no change.

## 6. Sweep of remaining buttons

I'll do a fast pass through every authenticated route and verify each button does what its label says. Known suspects to confirm/repair:

- `materials.tsx` — "Process again" / retry on a failed material (current page only shows status, no retry). Add a "Retry" button that re-runs `processMaterial` for the failed row.
- `materials.$id.tsx` — "Generate quiz from this" / "Generate flashcards" buttons (verify they navigate correctly).
- `notes.tsx`, `mindmaps.tsx`, `formulas.tsx`, `voice.tsx` — verify create/save/delete buttons all hit Supabase and refetch. Patch any that don't invalidate queries (so the UI updates without a refresh).
- `rooms.tsx` / `rooms.$id.tsx` — "Create room", "Join", "Leave", "Send" — verify Realtime subscription is wired; fix any handler that's a no-op.
- `schedule.tsx` — "Mark complete" toggle, drag-resize handles.
- `exams.tsx`, `gaps.tsx`, `progress.tsx` — verify all action buttons.
- `videos.tsx` — search/play buttons.
- `tutor.tsx` — Send button + "New chat" button.

For each, the fix pattern is the same: if the handler is missing, add it; if the mutation succeeds but UI doesn't update, add `qc.invalidateQueries`; if it throws, surface a toast.

I won't list every individual repair in this plan — I'll do them in the implementation pass and report a checklist at the end.

## Out of scope (not changing)

- Auth flow, RLS policies, edge functions, AI prompts, file-upload pipeline (already fixed last round).
- Visual redesign — only the new theme toggle and mobile sheet add UI.
- The DB schema — no migration needed.

## Files I'll touch

**New:**
- `src/components/theme-provider.tsx`
- `src/components/theme-toggle.tsx`
- `src/components/mobile-nav.tsx` (Sheet-based drawer)

**Edited:**
- `src/routes/__root.tsx` (remove hardcoded dark class, mount ThemeProvider)
- `src/routes/_authenticated.tsx` (sidebar footer toggle, swap MobileTopBar for MobileNav)
- `src/routes/_authenticated/settings.tsx` (Preferences dark-mode wired to ThemeProvider)
- `src/routes/_authenticated/admin.tsx` (loading/disabled states, error toast)
- `src/routes/_authenticated/codelab.tsx` (better Run failure UX, auth-expired handling)
- `src/routes/_authenticated/quizzes.tsx` (empty-quiz guard, normalize rounding fix)
- `src/components/codelab/SnippetsRail.tsx` (verify save flow)
- `src/routes/_authenticated/materials.tsx` (Retry on failed)
- Targeted patches in any other route page where I find a dead button during the sweep.

After implementation I'll list, in chat, every button I touched and confirm it now does what its label promises.
