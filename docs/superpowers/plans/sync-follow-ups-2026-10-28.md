# Sync Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 13 minor issues the phase 2 review left for later, so every failure the app can meet tells her what happened and never costs her data.

**Architecture:** Most fixes live in the sync layer: `syncLogic.js` gains a check for an unreadable cache and an order-blind comparison of data, `CloudSyncProvider` gains an unreadable-cache screen and clearer errors, and catch-up checks read only `updated_at` before downloading the row. The rest are small edits to the auth gate, the backups, the service worker, the keep-alive function, and the README.

**Tech Stack:** React 19, CRA 5 (Jest 27), supabase-js 2.118, Supabase CLI and Vercel CLI through `npx`, Playwright 1.52 with installed Edge.

**Spec:** `docs/superpowers/specs/android-cloud-sync-design-2026-10-27.md`, plus the 13 issues below, which are the "Deferred minors" from the phase 2 final review (ledger of `docs/superpowers/plans/cloud-sync-and-install-2026-10-28.md`):

1. A damaged unsent copy on a device shows the "can't reach" error on every retry (and an unreadable profile is pushed as `{}`).
2. If a save's reply is lost on the way back, she sees the conflict screen for her own change.
3. Every load error is described as a connection problem or a paused database, including a duplicate insert when two devices migrate at once.
4. Sign out on the error screen gives no message when she's offline.
5. Opening the app offline with an expired sign-in shows the sign-in screen instead of the error screen.
6. Damaged data from before sync is replaced without the old offer to export it first.
7. The damaged-data screen's only reset empties the cloud copy.
8. The backups offered on the conflict and first-device screens leave out the profile.
9. Opening the daily job's address in a browser could become the saved offline page.
10. The daily job's address is open to anyone.
11. Each save sends the whole data set several times.
12. One sync case is covered by a lower-level test but not a full-app test.
13. The README's setup step would push this project's site address if someone else copied the repo.

## Global Constraints

- Work on the `cloud-sync` branch, on top of phase 2. Nothing is merged or pushed without the owner's go-ahead.
- Every `CLAUDE.md` invariant holds, especially 1 (never persist a partial data object) and 10 (never push a missing cache, never edit without the cloud).
- `store.js` and `store.test.js` stay unchanged.
- Throwaway live checks touch only the audit account's row (`user_id=eq.<audit uid>`), read as the audit user where possible, and never use a filter that can match another row.
- No new dependencies.
- Copy is plain and specific. Every new screen meets invariant 9, and `npm run audit:phone` prints PASS.
- The suite (149 tests at the start) stays green after every task. `CI=true npm run build` compiles with no warnings at the end.

## Review Focus

1. A dirty cache that can't be read must never be pushed, and its raw text must be offered for download before the cloud copy replaces it. Test in Task 1.
2. An order-blind comparison must treat jsonb's reordered keys as equal, but a real difference, even one array item out of order, as different. Test in Task 3.
3. A duplicate insert from two devices migrating at once must land on the first-device choice, never on an error loop. Test in Task 2.
4. The version-first catch-up must still download and apply the row when `updated_at` differs, including during a hold. Test in Task 6.
5. The keep-alive must refuse a call without the secret, and the Vercel cron must still pass. Verify in Task 7.

---

### Task 1: The unreadable-cache screen (issues 1 and 6)

**Files:**
- Modify: `src/data/syncLogic.js`, `src/data/syncLogic.test.js`, `src/data/cloud.js`, `src/components/CloudSyncProvider.js`, `src/components/CloudSyncProvider.test.js`, `src/components/SyncScreens.js`

**Interfaces:**
- Produces:
  - `readLocalSnapshot() -> { data, profile, dataRaw, dataUnreadable, profileUnreadable }`. `dataUnreadable` is true when `ptAppData` exists but doesn't parse or lacks `patients` and `sessions` arrays. `profileUnreadable` is true when `pt-app-profile` exists but doesn't parse.
  - `chooseLoadPath` takes `localUnreadable` and returns `'unreadable-cache'` first when it is true, whether or not the cache is dirty.
  - `updateRow(userId, data, profile, expected)` and `replaceRow` leave the `profile` column untouched when `profile` is `undefined`.

- [ ] **Step 1: Write the failing tests:**
  - `readLocalSnapshot` flags `'{not json'` and `{"patients":"x"}` as unreadable and keeps the raw text; it doesn't flag a missing key.
  - `chooseLoadPath({ localUnreadable: true, ... })` is `'unreadable-cache'` for a dirty or a clean cache, with or without a row.
  - Provider: a dirty cache of `'{not json'` shows "This device's saved data can't be read" with "Download it" (saves the raw text) and "Continue with the cloud data", and `updateRow` is never called. Continue with a row applies it; with no row, it creates an empty row.
  - Provider: a ready app with an unreadable `pt-app-profile` pushes with `profile` `undefined`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. The push skips when `dataUnreadable` and sends `profile: undefined` when `profileUnreadable`. "Continue" re-runs the path choice with the local data treated as empty.
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Commit.**

### Task 2: Errors that say what happened (issues 3 and 4)

**Files:**
- Modify: `src/data/syncLogic.js`, `src/data/syncLogic.test.js`, `src/components/CloudSyncProvider.js`, `src/components/CloudSyncProvider.test.js`, `src/components/SyncScreens.js`

**Interfaces:**
- Produces: `describeLoadError(error) -> 'offline' | 'signed-out' | 'refused'`.
  - `'signed-out'`: HTTP 401, or PostgREST code `PGRST301`/`PGRST303` (JWT expired or invalid).
  - `'refused'`: any other error with a PostgREST or Postgres `code`.
  - `'offline'`: everything else (fetch failures, no status).
  - The error screen's copy per kind:
    - `'offline'`: the current text.
    - `'signed-out'`: "Your sign-in has expired" with Sign in again, which signs out.
    - `'refused'`: "The cloud didn't accept this device's data", followed by the code, with Try again and Sign out.

- [ ] **Step 1: Write the failing tests:**
  - `describeLoadError` maps a `TypeError('Failed to fetch')`, a `{ status: 401 }`, a `{ code: 'PGRST301' }`, and a `{ code: '23502' }` to the expected kinds.
  - Provider, Review Focus 3: Upload with `insertRow` rejecting `{ code: '23505' }` re-runs the load and lands on the first-device screen.
  - Provider: on the error screen, Sign out with `signOut` resolving `{ error }` shows the toast "Couldn't sign out. Check your connection and try again."
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. The gate keeps the error kind (`{ kind: 'error', reason }`). A `23505` from `insertRow` calls `load()` instead of showing an error.
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Commit.**

### Task 3: A lost reply is not a conflict (issue 2)

**Files:**
- Modify: `src/data/syncLogic.js`, `src/data/syncLogic.test.js`, `src/components/CloudSyncProvider.js`, `src/components/CloudSyncProvider.test.js`

**Interfaces:**
- Produces: `sameContent(a, b) -> boolean`. Object key order is ignored. Array order, values, and types count.

- [ ] **Step 1: Write the failing tests:**
  - Review Focus 2: `sameContent` is true for `{a:1,b:[{x:1,y:2}]}` against `{b:[{y:2,x:1}],a:1}`. It is false when array items swap, a value changes, or `1` is compared with `'1'`. Null and undefined are handled.
  - Provider: `updateRow` resolves `null`, and `fetchRow` returns a row whose data and profile match the cache with keys reordered. The result is no conflict screen, with `lastSeen` and `dirty: false` taken from that row.
  - Provider: the same with a row that really differs still shows the conflict screen.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement it in `showConflictWithFreshRow`. It applies to the load-time push-cache path too.
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Commit.**

### Task 4: Offline with an expired sign-in (issue 5)

**Files:**
- Modify: `src/context/AuthContext.js`, `src/context/AuthContext.test.js`, `src/components/AuthGate.js`, `src/components/AuthGate.test.js`

**Interfaces:**
- Produces: `useAuth()` gains `isOffline: boolean` and `retry()`. `isOffline` is true when `getSession` returns an error for which supabase-js `isAuthRetryableFetchError` is true. The stored session stays, so the app resumes on reconnect. `AuthGate` shows "You're offline" with Try again instead of the login form when `isOffline`.

- [ ] **Step 1: Write the failing tests:**
  - `getSession` resolves `{ data: { session: null }, error: <retryable> }`. Then `isOffline` is true, and `AuthGate` shows "You're offline" and no Sign in button.
  - Try again calls `getSession` again. A session then shows the app.
  - An `online` event retries on its own.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4: Verify live.** Run a throwaway Playwright script against the dev server and the audit account:
  1. Sign in.
  2. Set the stored session's `expires_at` to the past.
  3. Go offline and reload.
  Expected: "You're offline" appears, and going online and pressing Try again reaches Caseload.
- [ ] **Step 5:** Run the full suite. Expected: all pass.
- [ ] **Step 6: Commit.**

### Task 5: Backups keep the profile, and the damaged-data screen reloads first (issues 7 and 8)

**Files:**
- Modify: `src/components/CloudSyncProvider.js`, `src/components/CloudSyncProvider.test.js`, `src/screens/SettingsPage.js`, `src/screens/SettingsPage.test.js`, `src/components/ErrorModal.js`, `src/App.js`, `src/context/SyncContext.js`

**Interfaces:**
- Produces:
  - Backups (`pt-app-device-backup-*.json` and Settings' `pt-app-backup-*.json`) carry a `profile` key beside the data.
  - Settings' import restores `profile` through `updateProfile` when the file has one, and says so in its confirm.
  - `useSync()` gains `reloadFromCloud()`. It clears `ptAppData` and the sync meta, then re-runs the load.
  - The corruption modal shows "Reload from the cloud" first. Its wording makes plain that "Delete everything" also empties the cloud.

- [ ] **Step 1: Write the failing tests:**
  - The conflict screen's download includes the device's `profile`.
  - Settings' Download Backup includes `profile`.
  - Importing a file with a profile updates the profile.
  - A file without one leaves the profile alone.
  - `reloadFromCloud()` refetches and applies the row.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. `store.exportData` stays untouched. Callers add `profile` to the parsed object.
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Commit.**

### Task 6: Fewer full downloads, and the missing full-app test (issues 11 and 12)

**Files:**
- Modify: `src/data/cloud.js`, `src/components/CloudSyncProvider.js`, `src/components/CloudSyncProvider.test.js`, `src/context/PatientDataContext.test.js` (mocks)

**Interfaces:**
- Produces: `fetchRowVersion(userId) -> updated_at | null` (`select('updated_at')`). Catch-up checks call it first and call `fetchRow` only when the result differs from `lastSeen`. The load path still uses `fetchRow`.

- [ ] **Step 1: Write the failing tests:**
  - A visibility check whose version equals `lastSeen` calls `fetchRowVersion` and not `fetchRow`.
  - Review Focus 4: a differing version downloads and applies the row, or holds it during an edit.
  - Issue 12: a `notifyChange()` made while a push is in flight keeps `dirty` true after that push. A second `updateRow` then sends the newer cache against the first push's `updated_at`.
- [ ] **Step 2:** Run them. Expected: the version tests FAIL. The issue 12 test may pass on arrival. If so, keep it, and note it in the ledger as a regression test, not a fix.
- [ ] **Step 3:** Implement. Update the mocks in both test files.
- [ ] **Step 4:** Run the full suite. Expected: all pass.
- [ ] **Step 5: Verify live** with the two-device script (scoped to the audit row): a note saved on the phone still reaches the laptop with the toast.
- [ ] **Step 6: Commit.**

### Task 7: Service worker, keep-alive secret, and README (issues 9, 10, and 13)

**Files:**
- Modify: `public/service-worker.js`, `api/keep-alive.js`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Produces:
  - The worker caches a navigation response as the shell only when it is `ok` and its `content-type` includes `text/html`, and it skips `/api/` paths entirely.
  - `GET /api/keep-alive` returns 401 unless `Authorization` is `Bearer ${CRON_SECRET}`, and 500 with "CRON_SECRET is missing" when the variable is unset.
  - The README tells someone cloning the repo to edit `site_url` and the redirect URLs in `supabase/config.toml` and run `npx supabase config diff` before `config push`.

- [ ] **Step 1: Verify the worker** with Playwright on `CI=true npm run build` served by `npx serve -s build`, in a persistent Edge profile:
  1. Load `/`.
  2. Navigate to `/manifest.json`.
  3. Go offline and navigate to `/patients`.
  Expected: before the fix the offline page is the manifest JSON. After the fix it is the app shell.
- [ ] **Step 2: Verify the function locally** with `node` and env from `.env.audit.local`. Expected:
  - No header gets 401.
  - A wrong secret gets 401.
  - The right secret gets 200 `{ ok: true, rows: N }`.
  - An unset `CRON_SECRET` gets 500.
- [ ] **Step 3:** Generate a random `CRON_SECRET`. Add it to Vercel (production and preview, sensitive) and to `.env.audit.local`, without printing it.
- [ ] **Step 4:** Update the README and `CLAUDE.md`: the keep-alive secret, and the clone steps for `config.toml`.
- [ ] **Step 5:** Run the full suite, `CI=true npm run build`, and `npm run audit:phone`. Expected: all pass, no warnings, PASS.
- [ ] **Step 6: Commit.**
