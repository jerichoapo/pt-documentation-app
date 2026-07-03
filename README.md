# PT App — Pediatric Therapy Notes

A local-first documentation app for a school-based pediatric physical therapist.
Pick a student, document a SOAP session in a guided wizard, and export a signed
note to PDF or DOCX for the district or clinic. All data lives in the browser's
localStorage — there is no backend, no login, and nothing leaves the device.

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

All data is stored in this browser profile only, under the localStorage keys
`ptAppData` (schema v1.4), `pt-app-profile`, `pt-app-meta`, and
`ptAppSessionDraft`. There is no sync, server, or account. The JSON backup file
(Settings → Your Data) is the recovery mechanism — download one regularly, since
clearing browser data deletes everything.

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
