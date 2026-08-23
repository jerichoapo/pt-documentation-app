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
- **Tablet & phone friendly** — card layouts, 44px tap targets, sticky wizard
  navigation, and no horizontal scroll on a phone.

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

Old data is upgraded automatically — `loadFromStorage` walks a 1.0 → 1.4 migration
chain rather than rejecting anything it doesn't recognise.

## Architecture

- `src/data/store.js` — the data layer. Every function takes the whole
  `{version, patients, sessions, schools}` object and returns a new one, so
  persistence always writes a complete shape.
- `src/context/PatientDataContext.js` — React provider over the store.
- `src/screens/*` — one file per route; the route table is in `src/App.js`.
- `src/utils/sessionFormatting.js` — dates are plain local `'YYYY-MM-DD'` strings
  end to end, with no UTC conversion anywhere.
- `src/utils/exportNotes.js` — the PDF and DOCX builders.

Built with Create React App (react-scripts 5), React 19, react-router v7,
Tailwind CSS 3, lucide-react icons, pdfmake, and docx.

## Deployment

Hosted on Vercel as a static build. [vercel.json](vercel.json) rewrites non-asset
paths to `index.html` so react-router deep links survive a refresh.


## Disclaimer

This is a personal project, not a certified medical device, an approved
electronic health record, or a validated system of record. It has not been
evaluated against HIPAA, FERPA, or any district or clinic compliance
requirement. Anyone considering it for real documentation is responsible for
confirming it meets their own regulatory and record-retention obligations.

## License

Released under the MIT License. See [LICENSE](LICENSE).
