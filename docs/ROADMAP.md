# UX Roadmap — Phased Implementation Plan

Written 2026-07-02 after a full bug-fix pass (commit `87b30bd`) and a UX review.
This document is self-contained: a fresh session should be able to build any phase
from this file plus `CLAUDE.md` (architecture + invariants). Ship phases in order —
each phase makes the next one safer. Do not combine phases into one release.

**Owner decisions on scope:** HIPAA/authentication/encryption is deferred — do not
build it. No backend/sync — the app stays local-first on localStorage.

## Context: who this is for

A school-based pediatric PT with a caseload of roughly 40–60 students across
multiple schools. Sessions are weekly and repetitive (same child, similar note),
documentation happens between sessions and is constantly interrupted, and the
exported PDF/DOCX note is the deliverable of record (billing/IEP compliance,
TherEx/TherAct minutes map to CPT 97110/97530).

## Data model reference (schema v1.3, storage key `ptAppData`)

```
patient: { id, firstName, lastName, dob 'YYYY-MM-DD', diagnosis, guardianName,
           guardianPhone (10 digits), notes, grade, schoolId|null,
           school (legacy name string), createdAt, updatedAt,
           lastSessionDate (cache), sessionCount (cache),
           deleted_at?, permanently_deleted_at? }

session: { id, patientId, sessionDate 'YYYY-MM-DD' (legacy full-ISO still parseable),
           startTime 'HH:MM', endTime 'HH:MM', subjective,
           objectiveCategories { balance, motorSkills, therapeuticActivities,
                                 transfers, classroomMobility } (booleans),
           objectiveNotes, assessment, plan, therExMinutes, therActMinutes,
           createdAt, updatedAt, deleted_at?, permanently_deleted_at?,
           deleted_with_patient_id? }

school:  { id, name, street_address, city, state, zip_code, point_of_contact,
           phone, email, notes, created_at, updated_at, patient_count (cache),
           deleted_at?, permanently_deleted_at? }
```

Profile (separate key `pt-app-profile`): `{ firstName, lastName, credentials[], license }`.
Soft-deleted items are retained 30 days (`permanently_deleted_at`), purged in `store.init`.

## Verification workflow (use for every phase)

1. `npm start` (preview config `pt-app`, port 3000) and exercise flows in the browser;
   inspect `localStorage.ptAppData` after each mutation — it must always contain
   `version, patients, sessions, schools`.
2. `CI=true npx react-scripts test --watchAll=false` — keep the 22 existing tests
   green; add tests for new store logic.
3. `CI=true npm run build` — must compile with zero warnings.
4. Regression staples: add patient → document session → reload (no corruption
   modal); delete + restore patient (no white screen); pick a date and confirm the
   displayed calendar day matches everywhere.

---

# Phase 1 — "Never lose work"

Theme: protection. No schema changes (new data uses separate storage keys).
Build the Settings page first; other items hang off it.

## 1.1 Settings page with Backup & Restore

- New route `/settings` (add to header nav; the profile page can become a tab or
  link from here — keep `/settings/profile` working).
- **Download backup**: button calling the context `exportData()` (already returns
  complete JSON) → download as `pt-app-backup-YYYY-MM-DD.json`. Record the
  timestamp under a new localStorage key `pt-app-meta` → `{ lastBackupAt }`.
- **Import backup**: file input → parse JSON → validate through the same
  shape-check/repair logic as `loadFromStorage` (reuse/extract it — do not
  duplicate) → styled confirmation modal ("Replaces all current data: X patients,
  Y notes, Z schools → will become A/B/C") → on confirm, write to storage and
  reload app state. Reject unparseable files with a clear error toast.
- Move the "Export All Data" concept out of the error modal era: the error modal
  keeps working, but Settings is the primary home.
- **Backup nudge**: dismissible banner on Home when there is ≥1 patient AND
  (`lastBackupAt` missing OR older than 7 days). Text like "Last backup: 12 days
  ago — download a backup." Dismissal suppresses it for the session, not forever.

Acceptance: backup file round-trips through import losslessly; importing garbage
never corrupts existing data; nudge appears/disappears correctly.

## 1.2 Session draft autosave

- Persist wizard state (SOAP fields, categories, date, times, TherEx/TherAct,
  current step) to localStorage key `ptAppSessionDraft` as
  `{ patientId, savedAt, state }`, debounced ~500ms. One draft at a time is fine.
- On wizard entry for a patient with a matching draft: styled prompt
  "Resume unsaved note from 2:14 PM?" → Resume (restore state incl. step) or
  Discard (delete draft, start fresh).
- Clear the draft on successful save and on explicit discard. A draft for
  patient A must never leak into patient B's wizard.

Acceptance: kill the tab mid-note → reopen → resume restores every field;
saving clears the draft; discard starts clean.

## 1.3 Replace native dialogs with a ConfirmModal

- One reusable `ConfirmModal` component (title, body, confirm label, danger
  variant, cancel). Replace every `window.confirm`/`window.alert`:
  patient delete (PatientDetailPage, PatientActionsMenu), session delete
  (SessionDetailPage), RecentlyDeletedPage (restore / permanent delete / bulk /
  empty trash), the three Deleted*DetailPage screens, PatientForm duplicate-patient
  prompt, App.js clear-all-data.
- Keep exact consequence language ("Move X and 3 session notes to Recently
  Deleted?"). Danger styling for permanent deletes.

Acceptance: zero `window.confirm`/`window.alert` calls remain (grep);
all flows still complete and cancel correctly.

## 1.4 Profile completion nudge

- If `profile.firstName` is empty: small banner on Home — "Add your provider info
  so exported notes are signed" → links to profile.
- Pre-export check: when opening the export modal with an empty profile, show an
  inline warning in the modal ("This note will read 'Provider: N/A'") with a link
  to the profile page. Do not block the export.

---

# Phase 2 — "Document faster"

Theme: speed inside the SessionWizard. Read-only over existing data; no schema
changes. Build after Phase 1 so drafts logic is settled before touching wizard
initialization again.

## 2.1 Copy-forward ("Start from last session")

- Secondary button on PatientDetailPage next to "Start New Session" (only when
  ≥1 session exists). Navigates to the wizard with a `copyFrom=<sessionId>` query
  param (the wizard already reads query params for `referrer`/`date`).
- Wizard prefills from that session: subjective, objectiveCategories,
  objectiveNotes, assessment, plan, therExMinutes, therActMinutes.
  **Date and start/end times are NOT copied** — date defaults to today/`?date=`,
  times keep the existing now-based default behavior.
- Precedence rule: an existing draft outranks copy-forward — show the resume
  prompt; "Discard" then applies the copy-forward prefill.

Acceptance: prefilled note saves as a new session; source session untouched;
draft precedence works.

## 2.2 Last-note peek in the wizard

- On steps Subjective/Objective/Assessment/Plan, a collapsed strip under the
  patient header: "Last session — Mon, Jun 15" that expands to show the same
  section's text (and category chips on the Objective step) from the most recent
  session. Read-only. Hidden when the patient has no prior sessions.
- Uses `getSessionsForPatient` (already sorted desc). Collapse state can reset
  per step; no persistence needed.

## 2.3 Minutes vs. duration soft warning

- On the Review step, if `therExMinutes + therActMinutes` exceeds the computed
  start–end duration (when duration > 0), show a non-blocking amber hint:
  "Combined minutes (75) exceed session length (60)." Never blocks saving.

---

# Phase 3 — "Scale the caseload"

Theme: structure and navigation. Pure UI; no storage changes.

## 3.1 Home caseload view

- Add a search box (name or diagnosis — same matching as PatientsListPage).
- Group patient cards by school (group headers = school name via `schoolId`,
  fall back to legacy `patient.school` string; "No school" group last), with an
  A–Z flat toggle. Within groups sort by name.
- Keep "Start Session" as the card's primary action and the session-date picker
  behavior (it feeds `?date=` — already wired).

## 3.2 Navigation rehierarchy

- Header nav becomes: Home, Patients, Schools, My Profile (or Settings), + Add
  Patient. Remove "Recently Deleted" from the header; link it from the Settings
  page and as a quiet footer link on the Patients page.
- All existing routes keep working (deep links must not break).

## 3.3 School profile lists its patients

- On SchoolProfilePage, add an "Assigned patients (N)" section using
  `getPatientsForSchool(schoolId)`: name, grade, last session; each row links to
  the patient. Empty state: "No patients assigned."

## 3.4 Tablet pass

- Target iPad widths (768/1024). Tables (PatientsListPage, SchoolsListPage,
  RecentlyDeletedPage) collapse to card lists below ~md. Row action tap targets
  ≥44px. Wizard Back/Continue buttons stick to the bottom on short viewports.
  Verify no horizontal scroll anywhere at 768px.

---

# Phase 4 — "Upgrade the record" (single schema bump 1.3 → 1.4)

Theme: the only phase that changes the data model. One migration adds all three
fields; write the migration first, with tests, before any UI.

**Migration 1.3 → 1.4** (in `store.init`, chained after existing migrations, and
the repair path should land on 1.4): every session gains `amendments: []`; every
patient gains `goals: []` and `visitFrequency: null`. Migration must be
idempotent and covered by unit tests against a seeded 1.3 payload.

## 4.1 Amendment trail

- In `store.updateSession`, when any content field changes (SOAP fields, date,
  times, minutes — not cache-only churn), push
  `{ amendedAt: ISO, previous: { sessionDate, startTime, endTime, subjective,
  objectiveCategories, objectiveNotes, assessment, plan, therExMinutes,
  therActMinutes } }` onto `session.amendments`.
- SessionDetailPage: "Amended Jun 20, 2026" badge when history exists; expandable
  read-only history (most recent first).
- Exports: append an "Amendment history: originally documented <createdAt>;
  amended <dates>" line when history exists.

## 4.2 Patient goals

- `goals: [{ id, text, targetDate 'YYYY-MM-DD'|null, status: 'active'|'met'|
  'discontinued', createdAt }]`.
- Manage on PatientForm (add/edit/remove rows) and display on PatientDetailPage.
- Wizard Assessment step: read-only chips listing active goals above the textarea
  ("Goals: ① Ascend stairs with rail ② ...") as a writing reference.
- Exports: "Goals" block listing active goals after the patient header.

## 4.3 Visit frequency + "due" indicator

- `visitFrequency: { timesPerWeek: number } | null`, set via PatientForm
  (optional select 1–5, default none).
- Caseload views (Home cards, Patients list): a subtle "Due" badge when the
  patient has frequency set and fewer sessions this calendar week (Mon–Sun,
  local) than `timesPerWeek`. No badge when frequency is null.

---

## Deferred / out of scope

- HIPAA, authentication, at-rest encryption, device lock — owner deferred.
- Backend, sync, multi-device, multi-user.
- Full scheduling/calendar (frequency badge in 4.3 is the intentionally cheap version).

## Known nits (fold into whichever phase touches the file)

- SessionWizard's review header computes age with a 365.25-day approximation —
  use the shared `calculateAge` pattern if editing that header anyway.
- PatientsListPage empty-state message when a school filter is active says
  "No patients match your search criteria" — could mention the school filter.
