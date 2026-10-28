# PT App — Pediatric Therapy Notes

Local-first documentation app for a school-based pediatric physical therapist.
Single user, no backend: all data lives in browser localStorage. The core loop is:
pick a patient → document a SOAP session in a step wizard → export the note to
PDF/DOCX for the district/clinic.

## Commands

- `npm start` — dev server on :3000 (`.claude/launch.json` has a `pt-app` preview config)
- `CI=true npx react-scripts test --watchAll=false` — unit tests (store, date and wizard-default helpers, and a few screens)
- `CI=true npm run build` — production build; CI mode treats lint warnings as errors
- `npm run audit:phone` — with `npm start` running, drives every screen at 360px in
  headless Edge and fails on sideways scroll, a tap target under 40px, or a page
  error. Screenshots land in `scripts/phone-audit-shots/` (git-ignored).

## Architecture

- `src/data/store.js` — pure data layer. Every function takes the full data object
  `{version, patients, sessions, schools}` and returns a new one; persists via
  `saveToStorage`. No React.
- `src/context/PatientDataContext.js` — provider wrapping the store. Holds a
  `dataRef` (live copy) + reducer state. Actions call `getFullData()` and commit
  with `applyData(type, newData)`.
- `src/screens/*` — one file per route. `src/App.js` has the route table.
- `src/utils/sessionFormatting.js` — shared date/time/phone formatting.
- `src/utils/exportNotes.js` — PDF (pdfmake) and DOCX (docx) note exports.
- `src/utils/sessionDefaults.js` — wizard defaults: session times from the copied or
  last note before the clock, and TherEx/TherAct minutes from those notes before an
  even split of the session length.
- `src/components/AppHeader.js`, `BottomNav.js`, `BackLink.js` — the app shell. Below
  Tailwind's `sm:` (640px) there is a one-line top bar and a bottom tab bar; from
  `sm:` up the nav sits in the top bar.
- `package.json` `jest.moduleNameMapper` points React Router 7 at its CommonJS build
  and `setupTests.js` polyfills TextEncoder. Without both, any test that renders a
  router fails to load under CRA's Jest 27.
- Storage keys: `ptAppData` (schema v1.4), `pt-app-profile` (provider info),
  `pt-app-meta` (backup timestamps), `ptAppSessionDraft` (wizard draft).

## Invariants — do not break these (each guards a fixed data-loss bug)

1. **Never persist a partial data object.** Store functions must receive/return the
   complete `{patients, sessions, schools}` shape; `saveToStorage` always writes all
   keys + `version`. Context actions must use `getFullData()`/`applyData()`, never
   read `state.*` directly (stale closures broke bulk operations).
2. **Dates are local calendar dates.** `sessionDate` and `dob` are stored as plain
   `'YYYY-MM-DD'`. Parse with `parseAppDate`, display with `formatDate`/
   `formatShortDate`, fill inputs with `toDateInputValue`. Never `new Date('YYYY-MM-DD')`
   directly and never `date.toISOString().split('T')[0]` (UTC off-by-one). Date input
   `onChange` must ignore empty values (Invalid Date crashed the app).
3. **`loadFromStorage` repairs, it doesn't reject.** Storage missing `schools`/
   `version` is healed (schools rebuilt from legacy `patient.school` strings via
   `migratePatientsToSchoolIds`). Only unparseable/shape-wrong data raises
   `STORAGE_CORRUPTED`.
4. **The wizard saves on Review's "Save & Continue"**, before the Complete screen.
   The Complete screen's button only navigates.
5. **Soft-delete bookkeeping:** soft delete decrements `school.patient_count`,
   restore increments, permanently deleting an already-soft-deleted patient must NOT
   decrement again. Patient `lastSessionDate`/`sessionCount` caches must be refreshed
   by every session mutation (`updatePatientCache`).
6. **SOAP completeness** (all four sections + ≥1 objective category) is enforced on
   wizard save AND session-edit save.
7. Use functional `setState` updaters in `SessionWizard` (`setSoapNote(prev => ...)`).
8. Run the unit tests after touching `store.js` or `sessionFormatting.js` — they are
   regression tests for the corruption/date bugs.

9. **Phone layout.** `sm:` (640px) is the only phone/laptop breakpoint. Every button,
   link, and input is at least 44px (`min-h-[44px]`); reading text is at least 14px
   (`text-sm`, with `text-xs` only on badges); sticky or fixed bottom bars sit above
   the 64px tab bar (`bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0`).
   Run `npm run audit:phone` after touching a screen; it must print PASS.

## Current state & next work

Bug-fix pass (commit `87b30bd`) plus all four roadmap phases are built:
backup/restore + drafts + ConfirmModal (Phase 1), copy-forward + last-note peek
(Phase 2), caseload search/grouping + nav + tablet pass (Phase 3), and schema
1.4 with amendments/goals/visitFrequency (Phase 4). `npm test` = 62 passing
tests; CI build clean.

The mobile pass from `docs/ux-audit-2026-10-28.md` is built (plan:
`docs/superpowers/plans/mobile-audit-fixes-2026-10-28.md`). Phase 2, Supabase sync and
the installable Android app, is designed in
`docs/superpowers/specs/android-cloud-sync-design-2026-10-27.md` and not built yet.

**[docs/ROADMAP.md](docs/ROADMAP.md)** holds the per-feature specs and
acceptance criteria for everything above — the reference when modifying these
features. **[docs/QA-FLOW-AUDIT.md](docs/QA-FLOW-AUDIT.md)** is the
user-perspective walkthrough of every flow with expected behaviors — use it to
regression-test after changes and update it when flows change. Additions to session editing must preserve the amendment trail
(`store.updateSession` snapshots previous content when clinical fields change).
HIPAA/auth/encryption is explicitly deferred by the owner — do not add it unprompted.
