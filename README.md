# PT App — Pediatric Therapy Notes

A local-first documentation app for a school-based pediatric physical therapist.
Pick a student, document a SOAP session in a guided wizard, and export a signed
note to PDF or DOCX for the district or clinic. All data lives in the browser's
localStorage — there is no backend, no login, and nothing leaves the device.

**Live app:** https://pt-app-zeta.vercel.app (only the app code is hosted —
your data never touches the server; see [Data & privacy](#data--privacy)).

## Features

- **Guided SOAP wizard** — Subjective → Objective → Assessment → Plan → Review,
  with school-based objective categories (Balance & Coordination, Gross Motor
  Skills, Therapeutic Activities, Transfers & Positioning, Classroom Mobility).
  Completeness (all four sections + at least one category) is enforced before a
  note can be saved.
- **Copy-forward & last-note peek** — start a new note prefilled from the last
  session, and glance at the previous note's text per SOAP step while writing.
- **Draft autosave** — interrupted mid-note? The wizard offers to resume exactly
  where you left off, even after a browser restart.
- **Therapy goals & visit frequency** — per-patient goals with status and target
  dates (shown on the Assessment step and in exports), plus a weekly visit
  frequency that drives amber "Due" badges on the caseload.
- **Caseload views** — Home groups patients by school (itinerant-friendly) with
  search and an A–Z toggle; the Patients list filters by school and diagnosis.
- **Amendment trail** — editing a saved note's clinical content records a
  timestamped snapshot of the previous version; notes show an "Amended" badge,
  an expandable history, and an amendment line in exports.
- **Exports** — single note or all notes per patient, as PDF (pdfmake) or DOCX
  (docx), signed with the provider profile (name, credentials, license) and
  including TherEx/TherAct minutes, goals, and categories.
- **Recently Deleted** — 30-day trash for patients, notes, and schools with
  restore (including cascade restore of a patient's notes), permanent delete,
  bulk operations, and orphaned-note handling.
- **Backup & restore** — one-click JSON backup download and validated import,
  with a backup-age nudge on Home.
- **Tablet & phone friendly** — card layouts, 44px tap targets, sticky wizard
  navigation, no horizontal scroll at 375px/768px.

## Getting started

```bash
npm install
npm start          # dev server on http://localhost:3000
```

Other commands:

```bash
CI=true npx react-scripts test --watchAll=false   # unit tests (37 tests)
CI=true npm run build                             # production build; CI mode fails on lint warnings
```

## Data & privacy

**Where data lives:** everything (patients, notes, drafts, provider profile) is
stored in the browser's localStorage on the device you're using, under the keys
`ptAppData` (schema v1.4), `pt-app-profile`, `pt-app-meta`, and
`ptAppSessionDraft`. The Vercel deployment serves only static app code — the
app makes no network calls after loading, so nothing you type ever reaches a
server. Exports (PDF/DOCX) and backups (JSON) are generated on-device and only
become shareable files when you save them somewhere.

**What that means in practice:**

- **Every browser is a separate silo.** Notes typed in Chrome don't exist in
  Safari, and phone data ≠ laptop data. There is no sync; the backup file
  (Settings → Your Data → Download/Import Backup) is the only way to move data,
  and importing is a wholesale replace, not a merge. Pick one primary device.
- **On iPhone/iPad, "Add to Home Screen" gets its own storage container**,
  separate from regular Safari tabs. Use the home-screen icon from day one —
  it's also exempt from iOS Safari's ~7-day storage eviction for sites you
  haven't visited, which can otherwise silently delete localStorage.
- **Clearing browser data deletes everything** ("Clear History and Website
  Data" on iOS, clearing site data in any browser, or deleting the home-screen
  icon). There is no server copy to recover from — download a backup regularly;
  the app nudges you after 7 days without one.

The app has no authentication or encryption of its own (a deliberate scope
decision for a single-user tool); rely on device-level protections such as OS
login and disk encryption.

Old data is migrated automatically: `loadFromStorage` repairs and upgrades
legacy shapes through a sequential 1.0 → 1.4 migration chain rather than
rejecting them.

## Architecture

- `src/data/store.js` — pure data layer. Every function takes the full
  `{version, patients, sessions, schools}` object and returns a new one;
  persistence always writes the complete shape.
- `src/context/PatientDataContext.js` — React provider over the store. Keeps a
  synchronous `dataRef` so sequential awaited actions compose safely.
- `src/screens/*` — one file per route (route table in `src/App.js`).
- `src/utils/sessionFormatting.js` — date/time/phone formatting. Dates are plain
  local `'YYYY-MM-DD'` strings end to end (no UTC conversions).
- `src/utils/exportNotes.js` — PDF and DOCX note builders.

Built with Create React App (react-scripts 5), React 19, react-router v7,
Tailwind CSS 3, lucide-react icons, pdfmake, and docx.

## Deployment

The app is hosted on Vercel at https://pt-app-zeta.vercel.app as a static
build. [vercel.json](vercel.json) rewrites all non-asset paths to `index.html`
so react-router deep links survive refresh. Deploys are pushed manually via the
CLI (`npx vercel deploy --prod`) — pushing to GitHub does **not** auto-deploy
unless the repo is connected to Vercel's Git integration in the dashboard.

## Project docs

- [CLAUDE.md](CLAUDE.md) — architecture, commands, and the hard invariants that
  guard previously fixed data-loss bugs. Read before changing `store.js`.
- [docs/ROADMAP.md](docs/ROADMAP.md) — per-feature specs and acceptance criteria
  for everything shipped.
- [docs/QA-FLOW-AUDIT.md](docs/QA-FLOW-AUDIT.md) — user-perspective QA
  walkthrough of every flow; use it to regression-test after changes.
- [docs/ONE-PAGER.md](docs/ONE-PAGER.md) — product one-pager for a physical
  therapist audience.

## Testing

Unit tests cover the store (corruption/migration/soft-delete regression tests)
and date formatting (`src/data/store.test.js`,
`src/utils/sessionFormatting.test.js`). After touching either module, run the
tests — they exist because those bugs happened.
