## Problems found

**1. "Not signed in" on PDF/DOCX upload**
`runProcess()` inserts the row into `study_materials` *before* calling `getAccessToken()`. If the Supabase session is mid-refresh (common right after focus, or after a slow base64 conversion of a 5–20 MB file), `getSession()` momentarily returns no token and the helper throws `Not authenticated` — yet the DB row is already created and stuck in `processing`. We also don't `await supabase.auth.getSession()` *before* the insert, so the insert itself can race the refresh and 401.

**2. "Never the content but rather the file"**
For non-text uploads, `original_content` is hard-coded to the placeholder `[binary file: filename.pdf]`. The AI handler returns rich extracted text inside `summary` / `adapted_*` / `cornell_notes`, but `original_content` (what the material detail page shows as "Original") stays as that placeholder string. The extracted text from the PDF is never persisted.

**3. Admin role + admin page** — does not exist yet.

## Fix plan

### A. Upload reliability (`src/routes/_authenticated/materials.tsx` + `src/lib/materials.functions.ts`)

- Grab the access token **first** (before the DB insert). If missing, surface a friendly toast and stop — no orphan row.
- Wrap `getAccessToken()` to call `supabase.auth.refreshSession()` once if `getSession()` returns null, then retry. Prevents the transient "Not authenticated" mid-flow.
- Have `processMaterial` also return `extracted_text` (the raw text the model read out of the file/text). Persist it to `original_content` after success so the detail page shows real content for PDFs/DOCX/images.
- For binary uploads, insert the row with `original_content = ""` initially (placeholder removed), then update with the real extracted text on success.
- Mark row `processing_status = "failed"` with the error message in the catch block, so failed uploads don't sit forever as "processing".

### B. Roles system (migration)

Create the canonical secure roles setup:

- `app_role` enum: `'admin' | 'user'`
- `user_roles` table (`user_id`, `role`, unique pair) with RLS
- `has_role(uuid, app_role)` SECURITY DEFINER helper
- RLS on `user_roles`:
  - Users can read their own roles
  - Only admins can insert/update/delete roles (`has_role(auth.uid(),'admin')`)
- Seed: insert `('<sadick uid>', 'admin')` after looking up his auth user id.

### C. Admin page (`/admin`)

- New layout route `src/routes/_authenticated/_admin.tsx` with `beforeLoad` that calls a server fn `requireAdmin(token)` (uses `has_role`); non-admins redirect to `/dashboard`.
- New page `src/routes/_authenticated/_admin/index.tsx` showing:
  - **Users tab** — list every `user_profiles` row joined with email + roles, search, and a "Make admin / Remove admin" toggle.
  - **Stats tab** — total users, total materials, flashcards, quizzes, voice notes, study rooms (counts).
  - **Recent materials tab** — last 50 `study_materials` with owner email, status, created_at; "View" link.
- Server functions in `src/lib/admin.functions.ts` (all gated by `requireAdmin`) using `supabaseAdmin`:
  - `listUsers`, `setUserRole({ userId, role, enabled })`, `getStats`, `listRecentMaterials`.
- Sidebar link "Admin" appears only when the current user has the `admin` role (fetched via a `useIsAdmin` hook that calls a tiny `getMyRoles` server fn and caches in React Query).

### D. Nothing else changes

- No edits to login/signup, auth flow, RLS on existing tables, edge functions, or other pages.
- Existing routes and buttons keep working.

## Technical notes

- `processMaterial` schema gets one new field: `extracted_text: string` (model-extracted plain text of the source).
- Token-first ordering in `runProcess` eliminates the orphan-row failure mode.
- `has_role` is `SECURITY DEFINER` so RLS on `user_roles` doesn't recurse.
- Admin server fns never trust the client — they re-check `has_role` server-side.
- Sidebar gating is cosmetic; real protection lives in `_admin.tsx` `beforeLoad` + every admin server fn.
