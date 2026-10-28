# PT App on Android with a shared database

Design written 2026-10-27. Read `CLAUDE.md` first for the architecture and the
invariants; this document builds on both.

## Intent

The app's one user is a school-based pediatric PT. Today it runs in a browser on
one device and keeps everything in that browser's localStorage. She now needs it
on her Samsung Galaxy phone at school sites and on her laptop at home, with the
same patients and notes on both. The owner (her spouse) wants the notes to live
in a database he manages, on a free tier, where he can see every row.

Two things change:

1. The app installs on Android and runs full screen like a native app.
2. Patients, notes, schools, and the provider profile live in a hosted database
   and sync between her devices.

She also needs to copy a note's text out and export notes in a form that opens
in Google Sheets, which is where her other notes live.

## Goals

- She opens the app from an icon on her phone's home screen and on her laptop,
  signs in once per device, and sees the same data on both.
- A note saved on one device shows up on the other without a manual step.
- The owner can open a dashboard and see every patient and note as rows.
- Nothing she has already entered is lost in the move.
- A "Copy note" action puts a whole note's text on the clipboard.
- A CSV export opens cleanly in Google Sheets.
- Everything runs on free tiers: Vercel for hosting and Supabase for the
  database.

## Non-goals

- Offline editing and conflict merging. She has a stable connection when she
  uses the app. The app may show a clear "no connection" state; it does not
  queue writes.
- A second user, roles, or sharing between accounts.
- The Google Play Store, or a signed APK. The install path is the browser.
- A direct push to the Google Sheets API. CSV import into Sheets is two clicks
  and avoids a Google Cloud project.
- Changing the note wizard, the exports, the amendment trail, or the trash.

## Anti-goals

- Losing or silently overwriting a note. A sync bug that drops a save is worse
  than no sync.
- Making her sign in every time she opens the app.
- Data from the other device appearing mid-edit and wiping the note she is
  typing.
- A second copy of the data model. The store stays the single place that knows
  the shape of the data.

## Constraints

- One account, one user. The hosted app becomes hers alone: every route sits
  behind the login, public sign-up is off, and there is no localStorage-only
  mode for other visitors. The repo stays MIT and the README tells anyone
  who clones it to create their own Supabase project.
- Free tiers only. Supabase pauses a free project after seven days without
  activity. A daily keep-alive (below) prevents that during school breaks,
  and the app must still show a readable error if the project is paused
  rather than an empty caseload.
- These are children's therapy notes with names in them. The owner has
  decided to host them on Supabase for a personal tool. The app does not add
  encryption beyond what Supabase provides. `CLAUDE.md` currently says auth
  and HIPAA work are deferred and must not be added unprompted; that line is
  now superseded for auth, which this design needs. Update `CLAUDE.md` as part
  of the work.
- Keep every invariant in `CLAUDE.md`. In particular, never persist a partial
  data object, and keep `store.js` pure and synchronous.
- React 19 on Create React App 5. Do not eject.

## Phase 1: the mobile audit fixes

Added 2026-10-28. The owner read `docs/ux-audit-2026-10-28.md` and decided
that all 23 findings ship first, as phase 1, before the cloud sync and the
install work below. The audit is the spec for that phase: each numbered
finding states the problem and the fix. Where a finding says "my
recommendation" (the bottom tab bar in item 4, the patient page order in
item 16, the time defaults in item 14), that recommendation is the owner's
decision now. Phase 1 changes no data shape and no storage key, so it can
ship on its own and the `CLAUDE.md` invariants hold unchanged.

Phase 1 also decides two things the later phases rely on:

- The note page's action row (audit item 1) is laid out with room for the
  "Copy note" button that phase 2 adds.
- The Settings page gains nothing yet; the sign-out, cloud status, and CSV
  export land in phase 2.

## How it works

### Delivery on Android: an installable web app

The app stays a web app on its current Vercel deployment. Add what Chrome on
Android needs to offer "Add to Home screen" and launch full screen: a complete
web app manifest (name, icons, `start_url` of `/`, `display: standalone`,
`theme_color` matching the header), and a minimal service worker that caches
the app shell so the install prompt is reliable. The service worker must never
cache API responses; data always comes from the database.

Owner's call: no Capacitor or APK. Nothing in the app needs a native API, and a
web install means every deploy reaches both devices with no file to hand over.

Builder's choice: how to produce the service worker (Workbox through CRA's PWA
template files, or a short hand-written worker). It must not serve a stale
`index.html` after a deploy; use a network-first strategy for navigation.

### Where the data lives: one Supabase project

The owner asked for a free database and left the vendor choice to the
designer. The data is all text and small: a caseload of 40 to 60 students and
a few hundred notes a year is well under a megabyte. My call: Supabase.

Why Supabase over the alternatives considered:

- It ships sign-in, a database, a REST API, and live change notifications in
  one free project with no server code to write or host. The app stays a
  static site on Vercel.
- The database is Postgres with a table view in the dashboard, which is what
  "I can see every note as a row" needs, and the dashboard exports CSV.
- It has a command-line tool, so the schema lives in the repo as migrations
  and the designer can apply them and create her user without clicking
  through the dashboard.
- Firebase (Firestore plus Firebase Auth) was the runner-up: also free with
  no pausing, but its console shows nested documents rather than rows, has no
  CSV export, and its security rules are a second language to maintain.
- Plain hosted Postgres (Neon, Render) would need a backend for sign-in and
  an API, which is more to build and host for no gain here.
- Google Sheets as the database was rejected: no sign-in story without a
  Google Cloud project, and the API is slow and rate-limited for an app that
  saves on every tap.

Free-tier limits that matter: 500 MB of database storage, 50,000 monthly
active users, and 2 GB of egress. This app will use a fraction of a percent
of each. The one real limit is the seven-day inactivity pause, handled
below.

**Keep-alive.** Add a Vercel cron job (free on the Hobby plan at daily
precision) that calls a small serverless function in the repo, which reads
one row through the Supabase secret key. That counts as activity and
keeps the project from pausing over a summer break. The secret key
lives only in Vercel's environment variables, never in the client bundle.

**Who sets it up.** The owner creates the Supabase account and an empty
project in the dashboard (name, region, database password) and runs
`supabase login` once; everything after that is the designer's job through
the CLI: schema migrations committed under `supabase/migrations/`, the user
account, the Vercel environment variables, and verification. The owner keeps
the dashboard login and the database password.

Owner's call on shape: the app's full data object is stored as one JSON
document per user, not spread across normalized tables. This keeps `store.js`
and all 37 existing tests unchanged, and keeps the "never persist a partial
object" invariant true by construction. The owner still gets rows to look at
through SQL views that unnest the document.

Schema:

```sql
create table app_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,            -- {version, patients, sessions, schools}
  profile    jsonb not null default '{}'::jsonb,  -- {firstName, lastName, credentials, license}
  updated_at timestamptz not null default now()
);

alter table app_data enable row level security;

create policy "owner reads own row" on app_data
  for select using (auth.uid() = user_id);
create policy "owner writes own row" on app_data
  for insert with check (auth.uid() = user_id);
create policy "owner updates own row" on app_data
  for update using (auth.uid() = user_id);

-- Read-only views so the dashboard shows rows, not one JSON blob.
-- `security_invoker` makes the views run as the caller so the table's
-- row-level security applies; without it a view owned by `postgres` would
-- show every row to the anon key. The app never reads the views, so revoke
-- them from the API roles and read them only from the dashboard.
create view patients_view with (security_invoker = true) as
  select user_id,
         p->>'id'         as id,
         p->>'firstName'  as first_name,
         p->>'lastName'   as last_name,
         p->>'dob'        as dob,
         p->>'diagnosis'  as diagnosis,
         p->>'schoolId'   as school_id,
         p->>'deleted_at' as deleted_at
  from app_data, jsonb_array_elements(data->'patients') p;

create view notes_view with (security_invoker = true) as
  select user_id,
         s->>'id'            as id,
         s->>'patientId'     as patient_id,
         s->>'sessionDate'   as session_date,
         s->>'startTime'     as start_time,
         s->>'endTime'       as end_time,
         s->>'subjective'    as subjective,
         s->>'objectiveNotes' as objective_notes,
         s->>'assessment'    as assessment,
         s->>'plan'          as plan,
         s->>'therExMinutes' as ther_ex_minutes,
         s->>'therActMinutes' as ther_act_minutes,
         s->>'deleted_at'    as deleted_at
  from app_data, jsonb_array_elements(data->'sessions') s;

revoke select on patients_view, notes_view from anon, authenticated;
```

Add a `schools_view` on the same pattern, with the same `security_invoker`
option and revoke. The builder may adjust column lists; the views exist for
reading and for the dashboard's CSV export, and the app never reads them.

Enable Supabase Realtime on `app_data` so the other device can hear about
changes.

Secrets: `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY` come from
Vercel environment variables in production and `.env.local` in development.
The publishable key is public by design; row-level security is what protects the
data. `SUPABASE_SECRET_KEY` is set only in Vercel for the keep-alive
function and never read by the React app. Document all three in the README.

The schema above is the first migration file under `supabase/migrations/`,
applied with `supabase db push`, so a fresh project can be rebuilt from the
repo.

### Sign-in

Email and password through Supabase Auth. Her account is created through the
CLI or the dashboard during setup, and public sign-up is turned off in the
project's auth settings. `supabase-js` keeps the session in
localStorage and refreshes it, so she signs in once per device and stays
signed in. A `/login` screen is the only route an unauthenticated visitor can
reach; every other route redirects there. Sign out lives on the Settings page.

### Sync: how the app talks to the database

The data layer stays as it is: `store.js` is pure, synchronous, and still
writes to localStorage. localStorage becomes a local cache of the database
row, and the context becomes the place that moves data between the cache and
the database. The flow:

The sync layer keeps two small facts in localStorage beside the cache: the
`updated_at` of the last row this device pushed or received (`lastSeen`), and
a `dirty` flag set in `applyData` and cleared when a push is confirmed. These
are what let the load step tell a clean cache from one with an unpushed save.

**On load.** After sign-in, the context fetches the user's `app_data` row.

- Row exists and the cache is clean: write `data` into localStorage under
  `ptAppData` and `profile` under `pt-app-profile`, then run `store.init()`
  as today (migrations and the 30-day purge still happen here). If
  `store.init()` changed the data, push it back.
- Row exists and the cache is dirty (a save was made, then the app was closed
  before the push landed): if the row's `updated_at` equals `lastSeen`,
  nothing else changed in the meantime, so push the cache and continue. If
  the row is newer than `lastSeen`, both sides changed. My call: the row wins,
  and before applying it the app shows a screen that says this device has
  changes that never reached the cloud and offers to download them as a JSON
  backup. She can restore that backup later through Settings if the lost
  change matters. The app does not try to merge the two.
- Row exists and this device has local data but no `lastSeen` (a device that
  was used before sync existed, signing in for the first time): show a
  screen with both counts ("This device: 12 patients, 84 notes. Cloud: 30
  patients, 210 notes.") and two choices: keep the cloud data (with a backup
  download of this device's data first), or replace the cloud data with this
  device's. Nothing is overwritten until she chooses.
- No row, and localStorage has data: this is the one-time migration. Show a
  screen that says what was found ("12 patients, 84 notes, 3 schools on this
  device") with one button to upload it. On confirm, insert the row. Until the
  upload succeeds, the app does not proceed, so there is no window where she
  could add a note that the migration then overwrites.
- No row, and no local data: insert an empty row and start fresh.
- Fetch fails (paused project, no network): show a full-screen message that
  names the likely cause and offers "Try again." Do not fall back to editing
  the local cache; that is how two devices diverge.

**On every mutation.** `applyData` runs as today, then schedules a push of the
complete data object to the row. Push is `update ... where user_id = me`
with `updated_at = now()`. Coalesce pushes within a short window (my call:
500 ms) so a bulk restore is one write. If a push fails, retry a few times
with backoff, and if it still fails, show a persistent banner ("Changes not
saved to the cloud. Check your connection.") that clears on the next
successful push. The local cache keeps the change so she can see it; the
banner is what tells her the other device will not.

**From the other device.** Subscribe to Realtime changes on the row. When a
change arrives whose `updated_at` is newer than the last one this device
pushed or received, replace local state with it and show a short toast
("Updated from your other device"). Exception: while anything is being
edited, hold the incoming data and apply it when the edit ends. My call: the
context exposes an "editing" flag that every screen with unsaved local state
sets on mount and clears on unmount or save: the session wizard, the note
detail page in edit mode, the patient form, and the school form. A
wizard-only check would leave the other three editors open to the same
mid-edit wipe. The wizard draft itself (`ptAppSessionDraft`) stays per
device and is not synced.

**Conflicts.** One person cannot type on two devices at once, so the design is
last write wins, with the Realtime refresh keeping both devices current.
Builder's choice: whether to send the last-seen `updated_at` on push and
re-fetch when the server row is newer, which costs little and catches the
case where the Realtime message was missed.

The profile syncs the same way through its own column. `pt-app-meta` (backup
timestamps) stays local; it is per device by nature.

Backup and restore stay. A restore writes the imported data to the row like
any other mutation.

### Copy a note

A "Copy note" button on the note detail page puts the full note on the
clipboard as plain text: patient name, date and times, the four SOAP sections
with headings, the checked objective categories, TherEx and TherAct minutes,
the goals shown in exports, the amendment line if any, and the signature line
from the profile. Builder's choice on exact layout; it should read well pasted
into a Google Sheets cell or an email. Use `navigator.clipboard.writeText`
with a fallback for browsers that refuse it, and confirm with a toast.

The plain-text formatter is a pure function in `src/utils/` with unit tests.
Reuse whatever the PDF and DOCX exports already compute (goals, amendment line,
signature) rather than duplicating it.

### Export to CSV

Two entry points: "Export all notes (CSV)" on Settings and "Export notes (CSV)"
on a patient's page. One row per note, newest first, with these columns:

`patient_last_name, patient_first_name, dob, school, session_date,
start_time, end_time, subjective, objective_categories, objective_notes,
assessment, plan, ther_ex_minutes, ther_act_minutes, amended, created_at,
updated_at`

`objective_categories` is the checked categories' labels joined with
semicolons. Dates stay `YYYY-MM-DD`. Quote every field, escape quotes by
doubling, and keep newlines inside quoted fields; Google Sheets handles them.
Write a UTF-8 byte order mark at the start so Excel reads accents correctly.
Soft-deleted notes and patients are excluded. The formatter is a pure function
with unit tests. File name `pt-app-notes-YYYY-MM-DD.csv`, or
`pt-app-notes-<last>-<first>-YYYY-MM-DD.csv` for one patient.

### Settings page additions

- Signed-in email and a Sign out button.
- Cloud status line: "Last synced 2 minutes ago" or the failure banner's
  detail.
- The CSV export button beside the existing JSON backup.

### Documentation changes

- `CLAUDE.md`: architecture section gains the sync layer and the Supabase
  schema; "Single user, no backend" and the HIPAA/auth deferral line are
  rewritten to match this design; storage keys section notes that
  localStorage is now a cache.
- `README.md`: the "Data & privacy" section changes to say data lives in the
  owner's Supabase project; add setup steps for the environment variables and
  the one-time SQL.
- `docs/QA-FLOW-AUDIT.md`: add flows for sign-in, first-run migration, sync
  between two devices, copy note, and CSV export.

## Verification

- All existing tests stay green: `CI=true npx react-scripts test --watchAll=false`.
- New unit tests for the plain-text formatter, the CSV formatter, and the pure
  parts of the sync logic (deciding whether an incoming row is newer, holding
  updates while something is being edited, and choosing the load path from
  the row, the cache, `dirty`, and `lastSeen`).
- Manual, dirty cache: save a note on the phone with wifi off, close the app,
  turn wifi on, reopen, confirm the note reaches the laptop. Then the
  conflict case: save on the phone with wifi off, close it, save a different
  note on the laptop, turn the phone's wifi on, reopen, confirm the backup
  offer appears and the laptop's note wins.
- `CI=true npm run build` with zero warnings.
- Manual, on two devices: sign in on both; add a note on the phone and watch it
  appear on the laptop; edit on the laptop and watch the phone; open the wizard
  on the phone, save a note on the laptop, confirm the phone's draft survives
  and the new note appears after the wizard closes; turn off wifi on the phone,
  save, confirm the banner; turn wifi on, confirm it clears.
- Manual, Android: Chrome offers "Add to Home screen"; the icon launches full
  screen; after a deploy, a fresh launch shows the new build.
- Manual, Supabase dashboard: `notes_view` shows the notes; a CSV download from
  the dashboard opens in Sheets.
- Keep-alive: trigger the cron function by hand from the Vercel dashboard and
  confirm it returns 200 and a row count; confirm the schedule shows in
  Vercel's cron list.

## Left to the builder

- Service worker tooling and caching strategy, within the rules above.
- Exact plain-text note layout.
- Whether to add the optimistic `updated_at` check on push.
- How the login screen looks. It should match the app's Tailwind styling and
  work at phone width.
- Whether the sync layer lives inside `PatientDataContext` or in a new
  `src/data/cloud.js` module the context calls. A separate module is easier to
  test.
- Order of work. A sensible order: the Supabase project and migration first
  (so there is something to test against), then login and the data row with
  load and push (the app works on one device against the database), then
  Realtime, then the migration and conflict screens, then copy and CSV, then
  the PWA files and keep-alive, then docs.

## What the owner does by hand

1. Create a free account at supabase.com and a new project. Pick a US region,
   set a database password, and keep it somewhere safe.
2. Create her login in the dashboard (**Authentication** > **Users** > **Add
   user**, with **Auto Confirm User** checked) using a password chosen with her,
   so the password never passes through the designer. There is no in-app
   password change; reset it from the same dashboard page.
3. Approve the Supabase CLI and Vercel CLI sign-ins once (`npx supabase login`
   and `npx vercel login`). Everything else runs from the repo.
4. After the build: on the device that holds her current notes, sign in first
   and upload them. Then sign in on the other device, and on the phone use
   Chrome's **Add to Home screen**.

Updated 2026-10-28 to match what was done: the owner created the login in the
dashboard, the designer finished both CLI sign-ins from the repo with the
owner's approval in Chrome, and the env vars use Supabase's newer key names
(`REACT_APP_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`).
