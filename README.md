# PT App — Pediatric Therapy Notes

A documentation app for a school-based pediatric physical therapist. Pick a
student, document a SOAP session in a guided wizard, and export a signed note to
PDF or DOCX for the district or clinic. One person signs in with email and
password, and her patients and notes sync between her phone and laptop through
a Supabase database.

**Live app:** https://pt-app-zeta.vercel.app (sign-in required; see
[Data & privacy](#data--privacy)).

## Features

- **Guided SOAP wizard** — Subjective → Objective → Assessment → Plan → Review,
  with school-based objective categories (Balance & Coordination, Gross Motor
  Skills, Therapeutic Activities, Transfers & Positioning, Classroom Mobility).
  Completeness (all four sections + at least one category) is enforced before a
  note can be saved.
- **Sync between devices** — a note saved on the phone shows on the laptop
  within seconds, with an "Updated from your other device" message. While a form
  or the wizard is open, changes from the other device wait until it closes.
- **Installs on Android** — open the site in Chrome, then Add to Home screen. It
  launches full screen from its own icon.
- **Copy note** — puts the whole note on the clipboard as plain text.
- **CSV export** — every note, or one patient's notes, as a spreadsheet that
  opens in Google Sheets (Settings, or a patient's Download All Notes).
- **Copy-forward & last-note peek** — start a new note prefilled from the last
  session, and glance at the previous note's text per SOAP step while writing.
- **Draft autosave** — get interrupted mid-note and the wizard offers to resume
  where you left off, even after a browser restart.
- **Therapy goals & visit frequency** — per-patient goals with status and target
  dates, shown on the Assessment step and in exports. A weekly visit frequency
  drives "Due" badges on the caseload.
- **Caseload views** — Home groups patients by school (itinerant-friendly) with
  search and an A–Z toggle; the Patients list filters by school and diagnosis.
- **Amendment trail** — editing a saved note's clinical content records a
  timestamped snapshot of the previous version; notes show an "Amended" badge,
  an expandable history, and an amendment line in exports.
- **Exports** — one note or every note for a patient, as PDF or DOCX, signed with
  the provider profile and including TherEx/TherAct minutes, goals, and categories.
- **Recently Deleted** — a 30-day trash for patients, notes, and schools.
  Restoring a patient brings their notes back with them.
- **Backup & restore** — one-click JSON backup download and validated import,
  with a backup-age nudge on Home.
- **Session defaults** — a new note's times come from the last note, and
  TherEx/TherAct minutes from the last note or an even split of the session
  length. Saving with zero minutes asks first.
- **Tablet & phone friendly** — a bottom tab bar on phones, card layouts, 44px
  tap targets, a sticky wizard bar, and no horizontal scroll on a phone.

## Getting started

The app needs a Supabase project to sign in to. To set one up for your own copy:

1. Create a free project at supabase.com.
2. From this folder, run `npx supabase login`, then
   `npx supabase link --project-ref <your-project-ref>` and
   `npx supabase db push` to create the table, its access rules, and the views.
   `npx supabase config push` turns public sign-up off.
3. Create your login in the Supabase dashboard under **Authentication** >
   **Users** > **Add user**, with **Auto Confirm User** checked.
4. Put the project URL and publishable key in `.env.local`:

   ```
   REACT_APP_SUPABASE_URL=https://<your-project-ref>.supabase.co
   REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

Then:

```bash
npm install
npm start          # dev server on http://localhost:3000
```

Other commands:

```bash
CI=true npx react-scripts test --watchAll=false   # unit tests (138 tests)
CI=true npm run build                             # production build; CI mode fails on lint warnings
npm run audit:phone                               # with npm start running: phone-width layout check
```

`npm run audit:phone` signs in as a separate test account so it never touches
real data. Put that account in `.env.audit.local` (git-ignored):

```
AUDIT_EMAIL=audit@pt-app.test
AUDIT_PASSWORD=...
```

## Data & privacy

**Where data lives:** patients, notes, schools, and the provider profile live in
one row of the `app_data` table in the owner's Supabase project, as one JSON
document per user. Row-level security lets a signed-in user read and write only
their own row; public sign-up is off. The dashboard's `notes_view`,
`patients_view`, and `schools_view` show the data as rows and download as CSV.

**On each device:** the browser keeps a copy in localStorage (`ptAppData`,
`pt-app-profile`, and `ptAppSync` for sync bookkeeping) so the app opens
quickly. That copy is replaced from the cloud on every load, and signing out
removes it. The wizard draft (`ptAppSessionDraft`) and backup timestamps
(`pt-app-meta`) stay on the device and don't sync.

**How sync behaves:**

- Every change is sent within half a second. If it can't be sent, a banner says
  so and a Retry button sends it again; the change is kept on the device.
- If one device has a change that never reached the cloud and the other device
  saved since, the app shows the cloud version and offers to download this
  device's data first.
- If the database can't be reached when the app opens, the app shows an error
  with Try again rather than an empty caseload.
- The first sign-in on a device that already has data asks before anything is
  replaced.

Supabase pauses a free project after seven days without activity. A Vercel cron
job (`api/keep-alive.js`, daily) reads the table so that never happens. The
secret key it uses lives only in Vercel's environment variables.

The app adds no encryption beyond what Supabase provides.

Old data is upgraded automatically — `loadFromStorage` walks a 1.0 → 1.4 migration
chain rather than rejecting anything it doesn't recognise.

## Architecture

- `src/data/store.js` — the data layer. Every function takes the whole
  `{version, patients, sessions, schools}` object and returns a new one, so
  persistence always writes a complete shape.
- `src/context/PatientDataContext.js` — React provider over the store.
- `src/components/CloudSyncProvider.js` — moves data between the localStorage
  cache and the Supabase row: the load paths, the push after every change, and
  Realtime updates. `src/data/syncLogic.js` holds its pure decisions.
- `src/context/AuthContext.js` and `src/components/AuthGate.js` — sign-in and
  the login-only routing.
- `src/screens/*` — one file per route; the route table is in `src/App.js`.
- `src/utils/sessionFormatting.js` — dates are plain local `'YYYY-MM-DD'` strings
  end to end, with no UTC conversion anywhere.
- `src/utils/noteContent.js` — what every export shows; `exportNotes.js` (PDF and
  DOCX), `noteText.js` (Copy note), and `notesCsv.js` (CSV) build on it.
- `supabase/` — the database schema as migrations, and the project settings.

Built with Create React App (react-scripts 5), React 19, react-router v7,
Tailwind CSS 3, lucide-react icons, pdfmake, docx, and supabase-js.

## Deployment

Hosted on Vercel. [vercel.json](vercel.json) rewrites non-asset paths to
`index.html` so react-router deep links survive a refresh, and schedules the
daily keep-alive. Vercel needs three environment variables:
`REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY` (public by
design; row-level security protects the data) and `SUPABASE_SECRET_KEY` (for the
keep-alive only, never sent to the browser).

## Disclaimer

This is a personal project, not a certified medical device, an approved
electronic health record, or a validated system of record. It has not been
evaluated against HIPAA, FERPA, or any district or clinic compliance
requirement. Anyone considering it for real documentation is responsible for
confirming it meets their own regulatory and record-retention obligations.

## License

Released under the MIT License. See [LICENSE](LICENSE).
