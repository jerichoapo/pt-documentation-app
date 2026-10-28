# Cloud Sync and Android Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the app behind one email-and-password login, keep patients, notes, schools, and the profile in one Supabase row that syncs between her phone and laptop, add Copy note and a Sheets-ready CSV, and make the site installable on Android.

**Architecture:** `store.js` stays pure and keeps writing localStorage, which becomes a cache of one `app_data` row. A new `CloudSyncProvider` sits between the login gate and `PatientDataProvider`: it decides the load path, shows the gate screens, pushes the cached data after every mutation (500 ms coalescing, optimistic `updated_at` check), and listens to Realtime. Screens with unsaved state hold incoming data; a mutation made while data is held runs on the newer cloud data, so a save never conflicts with a change it has not seen.

**Tech Stack:** React 19, CRA 5 (Jest 27), Tailwind 3.4, React Router 7, `@supabase/supabase-js` v2, Supabase CLI 2.122 through `npx`, Vercel CLI 65 through `npx`, Playwright 1.52 with installed Edge.

**Spec:** `docs/superpowers/specs/android-cloud-sync-design-2026-10-27.md`

## Global Constraints

- Supabase project ref `lzswvpkxzkxwwqvudwfq` (East US). Free tiers only: Supabase Free, Vercel Hobby, cron at most daily.
- Never persist a partial data object; `store.js` stays pure and synchronous, and its 37 tests stay unchanged and green.
- React 19 on CRA 5. Do not eject.
- Every route sits behind the login. Public sign-up is off. No localStorage-only mode.
- No offline write queue. Fetch failure at load shows a full-screen error with "Try again"; it never falls back to editing the cache.
- The secret key lives only in Vercel environment variables and `.env*.local` files. It never reaches the client bundle or the repo.
- The service worker never caches API responses and serves navigation network-first.
- `ptAppSessionDraft` and `pt-app-meta` stay per device and unsynced.
- Copy, verbatim from the spec: toast "Updated from your other device"; banner "Changes not saved to the cloud. Check your connection."; first-device counts "This device: 12 patients, 84 notes. Cloud: 30 patients, 210 notes."; migration counts "12 patients, 84 notes, 3 schools on this device".
- CSV columns, in order: `patient_last_name, patient_first_name, dob, school, session_date, start_time, end_time, subjective, objective_categories, objective_notes, assessment, plan, ther_ex_minutes, ther_act_minutes, amended, created_at, updated_at`. Every field quoted, quotes doubled, UTF-8 BOM, soft-deleted notes and patients excluded, newest first. File names `pt-app-notes-YYYY-MM-DD.csv` and `pt-app-notes-<last>-<first>-YYYY-MM-DD.csv`.
- Invariant 9 (phone layout) holds on every new screen: 44px targets, 14px text, `npm run audit:phone` prints PASS.
- No person's name or email in the repo. The test account is `audit@pt-app.test`.

## Review Focus

1. Phone resumes with the wizard open after the laptop saved a note. Saving the wizard keeps both notes (the held row is adopted before the mutation). Test in Task 5.
2. The Realtime echo of this device's own push shows no "Updated from your other device" toast and causes no reload. Test in Task 5.
3. A mutation made while a push is in flight still reaches the cloud: `dirty` stays set and a second push follows. Test in Task 2.
4. Paused project or no network at load shows the error screen, never an empty caseload. Test in Task 4.
5. Sign out with unpushed changes asks first, and after sign-out the device holds no patient data. Test in Task 3.

---

### Task 1: Database schema, auth settings, and the test account

**Files:**
- Create: `supabase/config.toml` (from `npx supabase init`), `supabase/migrations/20261028000000_app_data.sql`
- Modify: `.gitignore` (add `.env*.local`)
- Create, git-ignored: `.env.local`, `.env.audit.local`

**Interfaces:**
- Produces: table `public.app_data (user_id uuid pk, data jsonb, profile jsonb, updated_at timestamptz)`; `updated_at` set by trigger on every update; RLS select/insert/update for the owner; views `patients_view`, `notes_view`, `schools_view` with `security_invoker` and revoked from `anon`, `authenticated`; table in the `supabase_realtime` publication; sign-up disabled.
- Produces: `.env.local` with `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_PUBLISHABLE_KEY`; `.env.audit.local` with `AUDIT_EMAIL`, `AUDIT_PASSWORD`, `SUPABASE_SECRET_KEY`.

- [ ] **Step 1:** Write the migration: the spec's schema, plus `revoke all on app_data from anon`, a `set_updated_at()` trigger function (`security invoker`, `set search_path = ''`) fired `before update`, the three views, and `alter publication supabase_realtime add table app_data`.
- [ ] **Step 2:** `npx supabase init`, set `[auth] enable_signup = false` and `site_url = "https://pt-app-zeta.vercel.app"` in `config.toml`, `npx supabase link --project-ref lzswvpkxzkxwwqvudwfq`, `npx supabase db push`. Fallback if push needs the database password: `npx supabase db query --linked -f <file>`.
- [ ] **Step 3:** Turn sign-up off on the remote project with `npx supabase config push`. Read the diff it prints before accepting; if it would change anything besides auth sign-up and site URL, stop and use the Management API instead.
- [ ] **Step 4:** Write the keys into `.env.local` and `.env.audit.local` straight from `npx supabase projects api-keys -o json`, never printing them. Create `audit@pt-app.test` through the admin API with a random password and `email_confirm: true`.
- [ ] **Step 5: Verify RLS** with a throwaway Node script in the scratchpad.
  Expected: signed in as the audit user, insert own row OK and select returns 1 row; `updated_at` changes on update; an update with a stale `updated_at` filter updates 0 rows; the publishable key alone selects 0 rows; `notes_view` select as the audit user fails with permission denied; `auth.signUp` fails; `npx supabase db advisors` reports no security errors.
- [ ] **Step 6: Commit** `supabase/`, `.gitignore`.

### Task 2: Pure sync logic

**Files:**
- Create: `src/data/syncLogic.js`, `src/data/syncLogic.test.js`

**Interfaces:**
- Produces:
  - `SYNC_META_KEY = 'ptAppSync'`; `readSyncMeta() -> { lastSeen: string|null, dirty: boolean, lastSyncedAt: string|null }`; `writeSyncMeta(patch)`; `clearLocalCache()` removes `ptAppData`, `pt-app-profile`, `ptAppSync`.
  - `readLocalSnapshot() -> { data: object|null, profile: object|null }` (raw parse of the two keys; `null` when missing or unparseable).
  - `countData(data) -> { patients, sessions, schools }` (active only); `hasLocalData(snapshot) -> boolean` (any patient, session, or school including soft-deleted, or a profile with a first name, last name, or license).
  - `chooseLoadPath({ row, localHasData, dirty, lastSeen }) -> 'create-empty'|'migrate'|'apply-row'|'push-cache'|'conflict'|'first-device'`.
  - `createPushQueue({ push, delayMs = 500, retryDelaysMs = [1000, 2000, 4000], onStatus }) -> { schedule(), flushNow(), cancel() }`. `push()` resolves or throws; `onStatus('pending'|'saved'|'failed')`.

- [ ] **Step 1: Write the failing tests:**
  - `chooseLoadPath` table: no row with local data → `migrate`; no row, no data → `create-empty`; row, `lastSeen` null, local data → `first-device`; row, `lastSeen` null, no data → `apply-row`; row, dirty, `row.updated_at === lastSeen` → `push-cache`; row, dirty, different → `conflict`; row, clean → `apply-row`.
  - `hasLocalData`: empty arrays and blank profile → false; one soft-deleted patient → true; profile with only a license → true.
  - `countData` skips soft-deleted items.
  - Push queue with jest fake timers: three `schedule()` calls within 500 ms make one push; a failing push retries after 1000, 2000, 4000 ms and then reports `failed`; `flushNow()` after `failed` pushes at once and reports `saved`; a `schedule()` during an in-flight push makes exactly one more push after it resolves (Review Focus 3).
- [ ] **Step 2:** Run `CI=true npx react-scripts test --watchAll=false src/data/syncLogic.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement. The queue never runs two pushes at once.
- [ ] **Step 4:** Run it again. Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 3: Supabase client, sign-in, and sign-out

**Files:**
- Create: `src/data/supabaseClient.js`, `src/data/cloud.js`, `src/context/AuthContext.js`, `src/components/AuthGate.js`, `src/screens/LoginPage.js`, `src/screens/LoginPage.test.js`, `src/components/AuthGate.test.js`
- Modify: `package.json` (add `@supabase/supabase-js`), `src/index.js`, `src/screens/SettingsPage.js`

**Interfaces:**
- Consumes: `clearLocalCache`, `readSyncMeta` from Task 2.
- Produces:
  - `getSupabase()` creates the client on first call (so importing never throws in tests).
  - `cloud.js`: `fetchRow(userId) -> {data, profile, updated_at}|null`; `insertRow(userId, data, profile) -> updated_at`; `updateRow(userId, data, profile, expectedUpdatedAt) -> updated_at|null` (`null` = row changed underneath); `replaceRow(userId, data, profile) -> updated_at`; `subscribeToRow(userId, onSignal(updatedAt)) -> unsubscribe`. Network or HTTP failures throw.
  - `AuthProvider`, `useAuth() -> { user, isLoading, signIn(email, password) -> Promise<{error}>, signOut() }`. `signOut` clears the local cache through `clearLocalCache()` after `supabase.auth.signOut()`.
  - `AuthGate`: loading → a centered "Loading…"; no user → routes `/login` → `LoginPage`, anything else → `<Navigate to="/login" replace />`; signed in on `/login` → `<Navigate to="/" replace />`; otherwise children.

- [ ] **Step 1: Write the failing tests** with `AuthContext` mocked:
  - `LoginPage`: submitting calls `signIn` with the typed email and password; a returned error shows "Email or password is incorrect."; the button reads "Signing in…" while pending.
  - `AuthGate`: no user at `/patients/p1` renders the sign-in form; a user at `/login` renders the children.
  - Settings sign-out (Review Focus 5): with `ptAppSync` dirty, Sign out asks to confirm and cancelling keeps the user signed in; confirming calls `signOut`.
- [ ] **Step 2:** Run them. Expected: FAIL, modules not found.
- [ ] **Step 3:** Implement. Provider order in `index.js`: `BrowserRouter` → `ToastProvider` → `ConfirmProvider` → `AuthProvider` → `AuthGate` → (Task 4's `CloudSyncProvider`) → `PatientDataProvider` → `ProfileProvider` → `App`. Settings gains an "Account" card with the signed-in email and a Sign out button (44px). The login screen fits a 360px phone.
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Commit.**

### Task 4: Load paths, gate screens, and push on every change

**Files:**
- Create: `src/context/SyncContext.js`, `src/components/CloudSyncProvider.js`, `src/components/SyncScreens.js`, `src/components/SyncBanner.js`, `src/components/CloudSyncProvider.test.js`
- Modify: `src/context/PatientDataContext.js`, `src/context/ProfileContext.js`, `src/index.js`, `src/App.js`, `src/screens/SettingsPage.js`

**Interfaces:**
- Consumes: Task 2's logic, Task 3's `cloud.js` and `useAuth`.
- Produces:
  - `SyncContext.js` (no Supabase import): `useSync() -> { notifyChange(), revision, status, lastSyncedAt, retryPush(), beginEdit(), endEdit(), adoptHeldData() }` with a no-op default so screens render without the provider; `useEditingHold(active: boolean)`.
  - `PatientDataContext`: load effect re-runs on `revision`; `applyData`, `importData`, and `clearAllData` call `notifyChange()`.
  - `ProfileContext`: load effect re-runs on `revision`; `updateProfile` writes `pt-app-profile` synchronously, then calls `notifyChange()`.

- [ ] **Step 1: Write the failing tests** for `CloudSyncProvider` with `cloud.js` and `useAuth` mocked, and localStorage seeded per case:
  - No row and local data: shows "4 patients, 6 notes, 2 schools on this device" and an Upload button; children are not rendered; Upload calls `insertRow` with the cache, then renders children and records `lastSeen`.
  - Row and clean cache: writes the row into `ptAppData` and `pt-app-profile`, renders children.
  - Row, dirty cache, row `updated_at` equals `lastSeen`: calls `updateRow` with the cache and renders children.
  - Row, dirty cache, newer row: shows the conflict screen with a "Download this device's data" button; Continue writes the row and renders children.
  - Row, no `lastSeen`, local data: shows "This device: … Cloud: …" with Keep cloud data and Replace cloud data; Replace calls `replaceRow`.
  - `fetchRow` rejects (Review Focus 4): shows the error screen and a Try again button, no children; Try again refetches.
  - After load, three `notifyChange()` calls within 500 ms make one `updateRow` call with the latest cache and the expected `lastSeen`.
  - `updateRow` failing four times shows the banner "Changes not saved to the cloud. Check your connection."; a successful Retry hides it.
  - `updateRow` returning `null` refetches and shows the conflict screen.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. After `apply-row`, run `store.init()` and push back if it changed the data. Gate screens use the app's card styling, 44px buttons, and work at 360px. Settings: the data card says the data lives in the cloud and is cached on this device; the Account card shows "Last synced 2 minutes ago" or the banner text. Render `SyncBanner` under the header in `App.js`.
- [ ] **Step 4:** Run the full suite. Expected: all pass, `store.test.js` untouched.
- [ ] **Step 5: Commit.**

### Task 5: Realtime, the editing hold, and catching up on resume

**Files:**
- Modify: `src/components/CloudSyncProvider.js`, `src/components/CloudSyncProvider.test.js`, `src/context/PatientDataContext.js`, `src/screens/SessionWizard.js`, `src/screens/SessionDetailPage.js`, `src/components/PatientForm.js`, `src/components/SchoolForm.js`, `src/screens/ProfilePage.js`

**Interfaces:**
- Consumes: `subscribeToRow`, `fetchRow`, Task 4's `useSync`/`useEditingHold`.
- Produces: incoming rules. A signal (Realtime, `visibilitychange` to visible, or `online`) with an `updated_at` equal to `lastSeen` is ignored. A signal during an in-flight push is rechecked after the push. Otherwise fetch the row: equal to `lastSeen` → nothing; newer and no hold → write the cache, set `lastSeen`, bump `revision`, toast "Updated from your other device"; newer during a hold → keep it as the held row. `endEdit()` to zero applies a held row. `adoptHeldData()` writes a held row into the cache, sets `lastSeen`, bumps `revision`, shows the toast, and returns the store-initialized data, or `null` when nothing is held. Every mutating action in `PatientDataContext` calls it before `getFullData()`.

- [ ] **Step 1: Write the failing tests:**
  - A Realtime signal with a newer row and no hold updates the cache and shows the toast.
  - A signal while `beginEdit()` is active leaves the cache untouched; `endEdit()` applies it.
  - Review Focus 1: during a hold with a held row, `adoptHeldData()` returns the row's data and the next push sends `expectedUpdatedAt` equal to the held row's `updated_at`.
  - Review Focus 2: a signal carrying this device's latest `updated_at` triggers no fetch and no toast; a signal during an in-flight push triggers one fetch after it resolves and no toast when the row matches.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Holds: the wizard always; the note page while `isEditing`; the patient form, school form, and profile page while mounted.
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Commit.**

### Task 6: Copy note

**Files:**
- Create: `src/utils/noteContent.js`, `src/utils/noteText.js`, `src/utils/noteText.test.js`, `src/utils/clipboard.js`
- Modify: `src/utils/exportNotes.js`, `src/screens/SessionDetailPage.js`

**Interfaces:**
- Produces: `buildNoteContent(session, patient, provider)` (moved from `exportNotes.js`'s `formatSOAPContent`, unchanged output except no trailing ", " when credentials are empty), `formatTime`, `getObjectiveCategoryLabels(categories) -> string[]`; `formatNoteAsText(session, patient, provider) -> string`; `copyText(text) -> Promise<boolean>` (Clipboard API, then a hidden-textarea `execCommand('copy')` fallback).

- [ ] **Step 1: Write the failing tests** for `formatNoteAsText` with a full note: the output starts with the patient name, has "Date of service:", the time range, TherEx and TherAct minutes, active goals numbered, the headings SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN in order, "Objective categories: Balance & Coordination", the provider line, the license line, the amendment line when amended, and ends with "Electronically signed". A provider with no credentials yields "Provider: Jordan Lee" with no trailing comma.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `exportNotes.js` imports the moved helpers; PDF and DOCX output is otherwise unchanged. The note page gets a Copy button first in its action row (44px, `Copy` icon) that toasts "Note copied" or "Couldn't copy the note".
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Commit.**

### Task 7: CSV export for Google Sheets

**Files:**
- Create: `src/utils/notesCsv.js`, `src/utils/notesCsv.test.js`
- Modify: `src/screens/SettingsPage.js`, `src/screens/PatientDetailPage.js`, `src/components/ExportFormatModal.js`

**Interfaces:**
- Consumes: `getObjectiveCategoryLabels` from Task 6.
- Produces: `buildNotesCsv({ sessions, patients, schools }) -> string`; `csvFileName({ patient, now }) -> string`; `downloadTextFile(filename, text, mimeType)`.

- [ ] **Step 1: Write the failing tests:**
  - The header row equals the Global Constraints column list; the output starts with `﻿`.
  - A note with a quote and a newline in `subjective` round-trips as `"He said ""hi""` + newline + `bye"`.
  - Soft-deleted notes and notes of soft-deleted patients are excluded; rows are newest first by date, then start time.
  - `school` resolves from `schoolId`, falling back to the legacy `patient.school`; `amended` is `yes` or `no`; `objective_categories` are joined with `; `; `created_at` reads `YYYY-MM-DD HH:MM` in local time.
  - `csvFileName` gives `pt-app-notes-2026-10-28.csv` and `pt-app-notes-martinez-ava-2026-10-28.csv`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Settings gets "Export all notes (CSV)". The patient page's download modal gets a third choice, "Spreadsheet (CSV)", described as "Opens in Google Sheets".
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Commit.**

### Task 8: Installable app, keep-alive, and Vercel settings

**Files:**
- Create: `public/service-worker.js`, `src/serviceWorkerRegistration.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon.png`, `api/keep-alive.js`
- Modify: `public/manifest.json`, `public/index.html`, `vercel.json`, `src/index.js`
- Delete: `public/logo192.png`, `public/logo512.png` (CRA's React logos)

**Interfaces:**
- Produces: manifest with `name` and `short_name` "PT Notes", `start_url` and `scope` `/`, `display: standalone`, `theme_color` `#ffffff` (the header), `background_color` `#f3f4f6`, icons with `any` and `maskable`. `index.html` gets `viewport-fit=cover` and the new theme color and icons. The service worker caches only same-origin GETs: navigation network-first with the cached shell as fallback, `/static/` cache-first, other assets stale-while-revalidate, and it ignores every cross-origin request. Registration runs in production only. `GET /api/keep-alive` reads `app_data` with `SUPABASE_SECRET_KEY` and returns `{ ok: true, rows: N }`. `vercel.json` excludes `api/`, `icons/`, and `service-worker.js` from the SPA rewrite and adds a daily cron.

- [ ] **Step 1:** Generate the icons from an inline SVG (white "PT" on the app's blue, rounded, with a safe-zone version for maskable) with Playwright screenshots.
- [ ] **Step 2:** Implement the manifest, HTML, worker, registration, function, and `vercel.json`.
- [ ] **Step 3: Verify** against `CI=true npm run build` served by `npx serve -s build` with Playwright and Edge.
  Expected: the build compiles with zero warnings; the worker reaches `activated`; CDP `Page.getInstallabilityErrors` returns none; a second load with the network blocked for Supabase still renders the shell and the error screen; no request to `supabase.co` is answered from the worker's cache.
- [ ] **Step 4:** Set the Vercel env vars with `npx vercel env add` from the `.env` files without printing them: `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY` for production, preview, and development, and `SUPABASE_SECRET_KEY` for production and preview.
- [ ] **Step 5: Commit.**

### Task 9: Phone audit sign-in, docs, and the end-to-end check

**Files:**
- Modify: `scripts/phone-audit.js`, `CLAUDE.md`, `README.md`, `docs/QA-FLOW-AUDIT.md`, `docs/superpowers/specs/android-cloud-sync-design-2026-10-27.md` (owner's steps), `package.json` (`audit:phone` loads `.env.audit.local`)

- [ ] **Step 1:** The audit seeds localStorage, checks the login screen, signs in as the audit user, takes the first-device or migration screen (choosing to put this device's seed data in the cloud), checks that screen, then runs every existing route and flow. It exits 1 if the audit env vars are missing.
- [ ] **Step 2:** Run `npm run audit:phone` with `npm start` up. Expected: PASS.
- [ ] **Step 3: End-to-end check** (throwaway script in the scratchpad, dev server plus the real project, the audit account, two Playwright contexts as phone and laptop). Expected:
  - Migration upload works.
  - The second device sees the data.
  - A note saved on one device appears on the other with the toast.
  - An open patient form is not reset by an incoming change, and saving it keeps both changes.
  - Going offline and saving shows the banner, and coming back online clears it.
  - The dirty-cache conflict shows the backup offer and the other device's note wins.
  - A blocked Supabase domain shows the error screen.
  - Sign out returns to the login screen and leaves no `ptAppData`.
- [ ] **Step 4:** Docs. `CLAUDE.md` gets the sync layer, the new storage key, the rewritten single-user and auth lines, the env files, and the audit's sign-in. The README's "Data & privacy" covers the Supabase setup for anyone who clones the repo. The QA flows cover sign-in, migration, two-device sync, copy, and CSV. The design doc's owner steps match what was done.
- [ ] **Step 5:** Run the full suite and `CI=true npm run build`. Expected: all tests pass, and the build compiles with zero warnings.
- [ ] **Step 6: Commit.**
