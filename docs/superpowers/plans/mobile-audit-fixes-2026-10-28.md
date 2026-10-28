# Mobile Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship all 23 findings in `docs/ux-audit-2026-10-28.md` so the app works on a 360 px Android phone as well as it does on a laptop, with no data shape or storage key changes.

**Architecture:** Tailwind's `sm` breakpoint (640 px) is the one switch between phone and laptop layouts. Three small shared components (`AppHeader`, `BottomNav`, `BackLink`) replace the hand-written header and the twelve "Back to X" links. Two helpers in `sessionFormatting.js` (`calculateAge`, `formatMediumDate`) replace the per-screen age math and the long weekday dates. Every layout change is checked by a Playwright script that asserts no page overflows the phone viewport.

**Tech Stack:** React 19, React Router 7 (`NavLink`), Tailwind 3, lucide-react, Jest + React Testing Library (already installed), Playwright (new devDependency, uses the installed Edge, no browser download).

**Spec:** `docs/superpowers/specs/android-cloud-sync-design-2026-10-27.md`, section "Phase 1: the mobile audit fixes", which points at `docs/ux-audit-2026-10-28.md` as the spec for each numbered finding. Read both.

## Global Constraints

- `CLAUDE.md` invariants hold. In particular: dates are `'YYYY-MM-DD'` and go through `parseAppDate`; never `new Date('YYYY-MM-DD')`; never persist a partial data object. No task here touches `store.js`.
- No schema, storage key, or data shape change.
- Tap targets are 44 px minimum (`min-h-[44px]`, `min-w-[44px]`) for every button, link, and icon control.
- 14 px (`text-sm`) is the floor for any text she has to read; `text-xs` stays only on badges.
- Phone is `< 640px` (Tailwind default, below `sm:`); laptop is `sm:` and up.
- `CI=true npm run build` must finish with zero warnings after every task (CRA treats lint warnings as errors in CI mode).
- `CI=true npx react-scripts test --watchAll=false` must stay green; 37 tests exist now.
- Commit messages name no person (roles only).
- House style for any prose (docs, commit messages): no em dashes, no "just."

## Review Focus

Behaviors the audit implies but no task's unit tests cover, most likely to bite first. Each has a check pinned to the owning task.

1. The bottom tab bar covers the last item on a scrolled page, or the wizard's sticky Continue bar sits under it. Expected: content and the wizard bar always clear the tab bar. Checked in Task 2 (main padding) and Task 9 (wizard bar offset), and by the overflow script's bottom-of-page screenshot.
2. A patient whose `schoolId` points at a deleted or missing school. Expected: the patient page falls back to the legacy `patient.school` string, then "Not specified," and never crashes. Test in Task 6.
3. A session with no `startTime` or `endTime` (older notes). Expected: the wizard's "last session" time default skips it and uses the clock; the note page shows "N/A" as today. Test in Task 9.
4. Copy-forward from a note where minutes were 0. Expected: minutes prefill from the session length split, not 0, and the zero-minutes confirm still fires if she clears them. Test in Task 9.
5. A dismissed backup banner, a long name like "Noah Johnson-Williams," and a 13-year-old with a long diagnosis on one Home card. Expected: no overflow and the three-dot menu stays tappable. Checked by the overflow script in Task 1 with that seed.

---

### Task 1: Phone audit script that fails on overflow

The P0 bugs are horizontal overflow. This script is the failing test for them and the regression check for every later layout task.

**Files:**
- Create: `scripts/phone-audit.js`
- Create: `scripts/phone-audit-seed.json`
- Modify: `package.json` (devDependency `playwright@1.52.0`, script `"audit:phone": "node scripts/phone-audit.js"`)
- Modify: `.gitignore` (add `/scripts/phone-audit-shots/`)

**Interfaces:**
- Produces: `npm run audit:phone` which expects the dev server on `http://localhost:3000`, seeds localStorage from `phone-audit-seed.json`, visits the routes below at 360 by 780 with `isMobile: true`, screenshots each to `scripts/phone-audit-shots/<name>.png`, and exits 1 if any page's `document.documentElement.scrollWidth > clientWidth` or any `button, a, input, select` with a visible box is under 40 px tall or wide. It also drives the wizard: click "Start Session" if present, then fill the first textarea and click the last button matching `/continue|save/i` through to the Review step, screenshotting each step, and opens the note page's edit mode and export modal.

- [ ] **Step 1: Write the seed**

`scripts/phone-audit-seed.json` holds `{ "data": {version:"1.4", patients, sessions, schools}, "profile": {...}, "meta": {lastBackupAt} }` with: 2 schools; 3 patients including `"Noah Johnson-Williams"` (visitFrequency `{timesPerWeek: 1}`, 1 session 9 days ago) and `"Ava Martinez"` (2 goals, one `active` one `met`, visitFrequency `{timesPerWeek: 2}`, 3 sessions, the second with one entry in `amendments`); a 13-year-old with diagnosis `"Down syndrome"`; one session with `startTime: null, endTime: null`; one soft-deleted session (`deleted_at` set); `lastBackupAt` 12 days ago. Dates are `'YYYY-MM-DD'` relative to a fixed anchor of `2026-10-28` so screenshots are stable.

- [ ] **Step 2: Write the script**

Routes: `/`, `/patients`, `/patients/p1`, `/patients/new`, `/patients/p1/edit`, `/sessions/s1`, `/sessions/s2`, `/sessions/new/p1/subjective?referrer=home`, `/schools`, `/schools/sch1`, `/schools/new`, `/settings`, `/settings/profile`, `/recently-deleted`. Launch with `chromium.launch({ channel: 'msedge', headless: true })`. Print one line per screen: `name  ok` or `name  OVERFLOW <scrollWidth>` or `name  SMALL <tag "text" WxH>`. Collect `pageerror` events and fail on any.

- [ ] **Step 3: Install and run it to see it fail**

Run: `npm install --save-dev playwright@1.52.0`, then in one terminal `BROWSER=none npm start`, in another `npm run audit:phone`
Expected: exit 1, with `OVERFLOW` on `session-detail` (450), `session-edit-mode` (502), `patient-detail` (450), and `SMALL` lines for the header links (24 px tall), "Patient actions" (28 px), "Dismiss backup reminder" (18 px), and "View →" (36 px).

- [ ] **Step 4: Commit**

```bash
git add scripts/phone-audit.js scripts/phone-audit-seed.json package.json package-lock.json .gitignore
git commit -m "Add a phone-width audit script that fails on overflow and small tap targets"
```

---

### Task 2: App shell: compact header and bottom tab bar (audit 4, 5, 6, 23)

**Files:**
- Create: `src/components/AppHeader.js`
- Create: `src/components/BottomNav.js`
- Create: `src/components/BackLink.js`
- Create: `src/components/AppHeader.test.js`
- Create: `src/components/BackLink.test.js`
- Modify: `src/App.js:50-98` (replace the `<header>` block; wrap `<main>`)

**Interfaces:**
- Produces: `AppHeader` (no props): on phone a 56 px bar with the text "PT Notes" linking to `/`; on `sm:` and up the same bar plus `NavLink`s Home, Patients, Schools, Settings (gear icon) and the "+ Add Patient" link, each `min-h-[44px]` with `px-3`. The tagline "Structured session documentation system" is gone.
- Produces: `BottomNav` (no props): `fixed bottom-0 inset-x-0 h-16 sm:hidden` with four `NavLink`s (Home, Patients, Schools, Settings) using lucide `Home`, `Users`, `Building2`, `Settings` at size 22 over an 11 px label (`text-[11px]`, the one allowed exception, since it is a label under an icon, not reading text). Active link is `text-blue-600`, others `text-gray-500`. `pb-[env(safe-area-inset-bottom)]`.
- Produces: `BackLink({ to, label })`: a `Link` with `ArrowLeft` and `min-h-[44px]`; text is `Back to {label}` on `sm:` and up and `Back` below (`<span className="hidden sm:inline">`, `<span className="sm:hidden">`). Later tasks use this on every page that has a back link.
- `NavLink` active class: `({ isActive }) => isActive ? 'text-blue-600' : 'text-gray-600'`. `/` must use `end` so Home is not active on every route.

- [ ] **Step 1: Write the failing tests**

`AppHeader.test.js`, rendering inside `MemoryRouter` with `initialEntries`:
- `test('highlights the current route, not Home')`: at `/patients`, the link named "Patients" has class `text-blue-600` and the link named "Home" does not.
- `test('Home is active only at the root')`: at `/`, "Home" has `text-blue-600`.
- `test('does not render the tagline')`: `queryByText(/structured session documentation/i)` is null.

`BackLink.test.js`:
- `test('renders both labels')`: `BackLink to="/patients" label="Patients"` renders text "Back to Patients" inside an element with class `hidden sm:inline` and text "Back" inside one with `sm:hidden`; the link's `href` is `/patients`.

- [ ] **Step 2: Run them to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false src/components`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the three components and wire `App.js`**

In `App.js`: replace the `<header>` with `<AppHeader />`; give `<main>` `className="py-6 px-4 pb-24 sm:pb-8"` so content clears the 64 px tab bar on phone; render `<BottomNav />` after `<main>`. Remove the now-unused `Settings` and `Link` imports from `App.js`.

- [ ] **Step 4: Run tests and build**

Run: `CI=true npx react-scripts test --watchAll=false` then `CI=true npm run build`
Expected: all tests pass (37 + 4), build has zero warnings.

- [ ] **Step 5: Run the phone audit**

Run: `npm run audit:phone`
Expected: no `SMALL` lines for Home, Patients, Schools, Settings links. Overflow lines for the three P0 pages remain (fixed in Tasks 4 to 6).

- [ ] **Step 6: Commit**

```bash
git add src/App.js src/components/AppHeader.js src/components/BottomNav.js src/components/BackLink.js src/components/AppHeader.test.js src/components/BackLink.test.js
git commit -m "Replace the tall header with a compact bar, a bottom tab bar on phones, and an active nav state"
```

---

### Task 3: Toasts and shared date helpers (audit 9, 10, 21)

**Files:**
- Modify: `src/components/ToastContainer.js:8`
- Modify: `src/utils/sessionFormatting.js` (add two exports)
- Modify: `src/utils/sessionFormatting.test.js`

**Interfaces:**
- Produces: `formatMediumDate(date) => string`, "Tue, Oct 27, 2026" via `toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })`, "Unknown date" on invalid input. Replaces `formatDate` on every in-app screen in Tasks 4 to 9. `formatDate` stays for exports.
- Produces: `calculateAge(dob, now = new Date()) => { years: number, months: number } | null` using `parseAppDate`; null on invalid input.
- Produces: `formatAge(dob, now = new Date()) => string`: `"4 y 3 m"` when years < 6, `"8 years"` otherwise, `"Unknown"` on invalid input.

- [ ] **Step 1: Write the failing tests** in `sessionFormatting.test.js`

```js
describe('formatMediumDate', () => {
  test('short weekday and month, no UTC shift', () => {
    expect(formatMediumDate('2026-10-27')).toBe('Tue, Oct 27, 2026');
  });
});
describe('calculateAge / formatAge', () => {
  const now = new Date(2026, 9, 28); // local Oct 28, 2026
  test('counts whole years and months', () => {
    expect(calculateAge('2018-03-14', now)).toEqual({ years: 8, months: 7 });
  });
  test('does not shift a day across UTC', () => {
    expect(calculateAge('2018-10-28', now)).toEqual({ years: 8, months: 0 });
    expect(calculateAge('2018-10-29', now)).toEqual({ years: 7, months: 11 });
  });
  test('formats months for young children only', () => {
    expect(formatAge('2022-07-01', now)).toBe('4 y 3 m');
    expect(formatAge('2018-03-14', now)).toBe('8 years');
    expect(formatAge('garbage', now)).toBe('Unknown');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false src/utils`
Expected: FAIL, functions undefined.

- [ ] **Step 3: Implement the three exports** in `sessionFormatting.js`, and change `ToastContainer`'s wrapper to `fixed z-50 space-y-2 inset-x-4 bottom-20 sm:inset-x-auto sm:bottom-auto sm:top-4 sm:right-4 sm:w-96`.

- [ ] **Step 4: Run tests**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/sessionFormatting.js src/utils/sessionFormatting.test.js src/components/ToastContainer.js
git commit -m "Add medium date and age helpers and move toasts above the phone tab bar"
```

---

### Task 4: Note page layout (audit 1, 2, 9, 23)

**Files:**
- Modify: `src/screens/SessionDetailPage.js:173-320`

**Interfaces:**
- Consumes: `BackLink`, `formatMediumDate` from Tasks 2 and 3.

- [ ] **Step 1: Restructure the header**

Lines 173 to 227: the outer div becomes `flex flex-wrap items-center justify-between gap-3 mb-6`. The back link becomes `<BackLink to={`/patients/${patient.id}`} label={`${patient.firstName} ${patient.lastName}`} />`. The button group becomes `flex flex-wrap gap-2 w-full sm:w-auto`; each button gets `min-h-[44px]` and `flex-1 sm:flex-initial`. Delete's label is "Delete" below `sm:` and "Delete Note" at `sm:` and up (same two-span pattern as `BackLink`); same for "Download" / "Download Note". Leave room for a fifth button: the group must still fit four buttons at 360 px, which `flex-wrap` guarantees.

- [ ] **Step 2: Stack the date and time rows in edit mode**

Line 237: `flex items-center gap-4` becomes `flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4`. Line 262's inner time row becomes `flex flex-wrap items-center gap-2` and each `type="time"` input gets `min-h-[44px]`. The `type="date"` input gets `min-h-[44px]`. Line 289's TherEx/TherAct row becomes `flex flex-wrap gap-4`.

- [ ] **Step 3: Medium dates**

Line 248: `formatDate(session.sessionDate)` becomes `formatMediumDate(...)`. Update the import; remove `formatDate` from it if unused.

- [ ] **Step 4: Verify**

Run: `npm run audit:phone`
Expected: `session-detail` and `session-edit-mode` print `ok`; the script's click on Delete succeeds. Run `CI=true npm run build`: zero warnings.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SessionDetailPage.js
git commit -m "Wrap the note page actions and stack the edit fields so nothing overflows on a phone"
```

---

### Task 5: Patient page order and header (audit 3, 6, 9, 16, 20, 21, 23)

**Files:**
- Modify: `src/screens/PatientDetailPage.js:29-40, 116-250, 280-315`
- Create: `src/screens/PatientDetailPage.test.js`

**Interfaces:**
- Consumes: `BackLink`, `formatMediumDate`, `formatAge`; `getSchoolById` from `usePatientData()`.

- [ ] **Step 1: Write the failing test** `PatientDetailPage.test.js`

Render the page inside `MemoryRouter` at `/patients/p1` with `PatientDataProvider` and `ToastProvider`/`ConfirmProvider` after seeding `localStorage.ptAppData` with: school `{id:'sch1', name:'Lincoln Elementary', ...}`, patient `p1` with `schoolId:'sch1', school:'Old Name'`, patient `p2` with `schoolId:'missing', school:'Legacy School'`, patient `p3` with no school fields, and two sessions for `p1` (assessment text "Progressing toward goal 1").
- `test('shows the school by id, not the legacy string')`: at `/patients/p1`, text "Lincoln Elementary" is present and "Old Name" is not.
- `test('falls back to the legacy string, then Not specified')`: at `/patients/p2` "Legacy School"; at `/patients/p3` "Not specified".
- `test('session history comes before details')`: `getByText(/session history/i)` appears before `getByText(/parent\/guardian/i)` in document order (`compareDocumentPosition`).
- `test('history rows preview the assessment')`: "Progressing toward goal 1" is in the document.

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false src/screens/PatientDetailPage`
Expected: FAIL on the school and order assertions.

- [ ] **Step 3: Implement**

- Delete the local `calculateAge` (lines 29 to 40); use `formatAge(patient.dob)` where it rendered "N years".
- Header (116 to 134): `BackLink to="/patients" label="Patients"`; the Edit and Delete buttons get `min-h-[44px]`, and Delete's label is "Delete" on phone, "Delete Patient" on `sm:`.
- Info card (136 to 165): the name row becomes `flex flex-col gap-4`: `<h1>` on its own line, then the start buttons in `flex flex-col sm:flex-row gap-3` with each button `w-full sm:w-auto min-h-[44px] justify-center`. Diagnosis as a `<p className="text-lg text-gray-700">` under the name.
- Page order after the info card: Session History card, then Therapy Goals card (move the goals block out of the details), then a `<details className="bg-white rounded-lg shadow-md"><summary className="px-6 py-4 min-h-[44px] cursor-pointer font-semibold">Details</summary>...</details>` holding the Age, Parent/Guardian, DOB, Phone, Grade, School, and Additional Notes rows. `open` by default on `sm:` is not possible with `<details>`, so leave it closed on both; the laptop loses nothing important.
- School row: `const school = patient.schoolId ? getSchoolById(patient.schoolId) : null;` then `school?.name || patient.school || 'Not specified'`.
- History rows (280 to 315): date via `formatMediumDate`; add `<p className="text-sm text-gray-600 mt-2 line-clamp-2">{session.assessment}</p>` (add the `line-clamp` utility if the Tailwind version lacks it; Tailwind 3.3+ has it built in); "View →" button gets `min-h-[44px]`.

- [ ] **Step 4: Run tests, build, audit**

Run: `CI=true npx react-scripts test --watchAll=false`; `CI=true npm run build`; `npm run audit:phone`
Expected: PASS; zero warnings; `patient-detail` prints `ok` with no `SMALL` line.

- [ ] **Step 5: Commit**

```bash
git add src/screens/PatientDetailPage.js src/screens/PatientDetailPage.test.js
git commit -m "Lead the patient page with notes and start buttons, fix the school lookup, and fit the header on a phone"
```

---

### Task 6: Home caseload (audit 6, 7, 9, 17, 19)

**Files:**
- Modify: `src/screens/HomePage.js:110-125, 137-160, 212-295`
- Modify: `src/components/PatientActionsMenu.js:73`
- Modify: `src/utils/sessionFormatting.js` (add `visitsThisWeek`)
- Modify: `src/utils/sessionFormatting.test.js`

**Interfaces:**
- Produces: `visitsThisWeek(patient, sessions, now = new Date()) => number`, the count `isPatientDueThisWeek` already computes internally; refactor so `isPatientDueThisWeek` calls it.
- Produces: `sortDueFirst(patients, sessions, now) => Patient[]`, stable: due patients first, then the existing order.

- [ ] **Step 1: Write the failing tests**

```js
describe('visitsThisWeek / sortDueFirst', () => {
  test('counts this week only', () => { /* 2 sessions this week, 1 last week => 2 */ });
  test('due patients come first, order otherwise preserved', () => {
    // [a (not due), b (due), c (due)] => [b, c, a]
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false src/utils`
Expected: FAIL.

- [ ] **Step 3: Implement the helpers**, then in `HomePage.js`:

- Replace the "Select Patient & Session" `<h2>` and the Session Date card (137 to 160) with one row: `<p className="text-sm text-gray-700">Documenting for <strong>{formatMediumDate(selectedDate)}</strong></p>` and a "Change" button (`min-h-[44px] text-blue-600`) that toggles an inline `type="date"` input (same `onChange` guard as today: ignore empty values). The `<h2>` becomes "Caseload".
- Due badge: add `title={`${visitsThisWeek(patient, sessions)} of ${patient.visitFrequency.timesPerWeek} visits this week`}` and the same text in `aria-label`.
- Within each school group and in the A–Z list, render `sortDueFirst(group, sessions)`.
- Line 221 group count and line 269 "Last session" become `text-sm`.
- "Last session:" uses `formatShortDate` already; keep.
- Dismiss button (118): `min-h-[44px] min-w-[44px] flex items-center justify-center`.
- "View ↗" and "Start Session" buttons: `min-h-[44px]`.
- `PatientActionsMenu.js:73`: `p-1 rounded-full` becomes `min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full`.

- [ ] **Step 4: Run tests, build, audit**

Run: `CI=true npx react-scripts test --watchAll=false`; `CI=true npm run build`; `npm run audit:phone`
Expected: PASS; zero warnings; `home` has no `SMALL` line, and "Noah Johnson-Williams" (due) is listed before "Ava Martinez"? No: both are due in the seed, so order within Lincoln stays alphabetical-by-existing-order; confirm the non-due patient in that school, if any, sorts last.

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomePage.js src/components/PatientActionsMenu.js src/utils/sessionFormatting.js src/utils/sessionFormatting.test.js
git commit -m "Shrink the Home date card to one line, explain the Due badge, and sort due patients first"
```

---

### Task 7: Patients list, Schools, Recently Deleted, remaining back links (audit 7, 11, 12, 19, 23)

**Files:**
- Modify: `src/screens/PatientsListPage.js:137-156, 188-192`
- Modify: `src/screens/SchoolsListPage.js:97`
- Modify: `src/screens/RecentlyDeletedPage.js:329-341`
- Modify: `src/screens/SettingsPage.js`, `src/screens/ProfilePage.js`, `src/screens/SchoolProfilePage.js`, `src/screens/DeletedPatientDetailPage.js`, `src/screens/DeletedSessionDetailPage.js`, `src/screens/DeletedSchoolDetailPage.js`, `src/components/PatientForm.js`, `src/components/SchoolForm.js` (each "Back to X" link)

- [ ] **Step 1: Implement**

- `PatientsListPage`: `text-xs` on the "Last session" line (154) becomes `text-sm`; Due badges get the same `title` as Home (import `visitsThisWeek`).
- `SchoolsListPage:97`: placeholder becomes `"Search schools..."`.
- `RecentlyDeletedPage:329-341`: the wrapper becomes `flex flex-col gap-3 mb-6`; `BackLink to="/" label="Home"`; the `<h1>` on its own line. Tab buttons get `min-h-[44px]`.
- Every remaining "Back to X" `Link` becomes `<BackLink to=... label=... />` with the same destination. Grep `Back to ` across `src/` afterwards: the only hits left are inside `BackLink.js`, the wizard's "Back to Edit" button, and the "Back to Home" buttons inside empty states (those are fine).

- [ ] **Step 2: Build and audit**

Run: `CI=true npm run build`; `npm run audit:phone`
Expected: zero warnings; `recently-deleted`, `schools`, `patients` print `ok`; `grep -rn "Back to " src/screens src/components | grep -v BackLink | grep -v "Back to Edit" | grep -v "Back to Home"` returns nothing.

- [ ] **Step 3: Commit**

```bash
git add src/screens src/components
git commit -m "Use the shared back link everywhere, stack the Recently Deleted header, and drop the stray search emoji"
```

---

### Task 8: Patient form (audit 18, 21)

**Files:**
- Modify: `src/components/PatientForm.js:118-130, 431-505, 670-740`

- [ ] **Step 1: Implement**

- Delete the local `calculateAge` (118); under the DOB input render `<p className="mt-1 text-sm text-gray-600">Age: {formatAge(formData.dob)}</p>` only when `formData.dob` is set. Remove the read-only Age input and its grid cell; DOB takes the full row.
- Move the Parent/Guardian Name and Contact Phone fields (around 676 to 712) up to directly after DOB, so the order is First, Last, DOB, Guardian name, Phone, then Diagnosis, Grade, School, Visit Frequency, Goals, Additional Notes.
- Submit row (727): `flex justify-end pt-4` becomes `pt-4`; the button gets `w-full sm:w-auto justify-center min-h-[44px]`.
- Every input and select gets `min-h-[44px]` (most are 42 px today at `py-2`; `min-h` makes it exact).

- [ ] **Step 2: Build and audit**

Run: `CI=true npm run build`; `npm run audit:phone`
Expected: zero warnings; `patient-new` and `patient-edit` print `ok`; in the `patient-new` screenshot the first five fields are the required ones and no "Age will be calculated" box exists.

- [ ] **Step 3: Commit**

```bash
git add src/components/PatientForm.js
git commit -m "Group the required patient fields first and show age as text under the birth date"
```

---

### Task 9: Session wizard (audit 8, 13, 14, 15, 21)

**Files:**
- Modify: `src/screens/SessionWizard.js:50-62, 84-115, 213-250, 462-512, 540-548, 602-612 (and the four sibling sticky bars), 805-900, 995-1030`
- Create: `src/utils/sessionDefaults.js`
- Create: `src/utils/sessionDefaults.test.js`
- Modify: `src/App.js:106` (route)

**Interfaces:**
- Produces in `sessionDefaults.js`:
  - `defaultSessionTimes({ copyFrom, lastSession, now = new Date() }) => { startTime: 'HH:MM', endTime: 'HH:MM' }`: `copyFrom`'s times if both set, else `lastSession`'s if both set, else `now - 30 min` to `now`.
  - `splitMinutes(startTime, endTime) => { therExMinutes, therActMinutes }`: duration split evenly, the odd minute to TherEx, `{0, 0}` when duration is 0 or inverted.
  - `defaultMinutes({ copyFrom, lastSession, startTime, endTime })`: `copyFrom`'s minutes if their sum > 0, else `lastSession`'s if their sum > 0, else `splitMinutes(startTime, endTime)`.
- Consumes: `useConfirm` (already in the wizard), `formatAge`, `formatMediumDate`, `formatShortDate`.

- [ ] **Step 1: Write the failing tests** `sessionDefaults.test.js`

```js
test('times: copyFrom wins, then last session, then the clock', ...)  // three cases; the clock case uses now = 11:40 => 11:10-11:40
test('times: a session missing endTime is skipped', ...)              // lastSession {startTime:'09:00', endTime:null} => clock
test('splitMinutes halves a 30 min session and gives the odd minute to TherEx', ...) // 30 => 15/15; 45 => 23/22; inverted => 0/0
test('minutes: copyFrom with zeros falls through to the split', ...)  // copyFrom {0,0}, 09:30-10:00 => 15/15
```

- [ ] **Step 2: Run to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false src/utils/sessionDefaults`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `sessionDefaults.js`**, then in the wizard:

- **Skip step 0 (13):** `useState(1)` at line 50 regardless of `section`. In `App.js:106` keep the route; add `<Route path="/sessions/new/:patientId" element={<Navigate to="subjective" replace />} />` before it so a bare URL lands on Subjective (import `Navigate`). Remove the `case 0` render and the "Select Patient & Session" block (516 to 570); the `steps` array keeps index 0 so the draft's saved `currentStep` numbers stay valid.
- **Time and minutes defaults (14, 15):** delete `getCurrentTimeDefaults` and the `timesInitialized` effect (84 to 115). Add one effect that runs once when `patient` and (if `copyFromId`) `copyFromSource` are loaded and no draft was resumed: `lastSession = getSessionsForPatient(patientId)[0] || null`; set times from `defaultSessionTimes` and minutes from `defaultMinutes`. Keep the copy-forward effect (213 to 250) but drop its two `setTher*Minutes` lines, since `defaultMinutes` covers it.
- **Session time on the first step (14):** under the patient name card in the Subjective step render a "Session time" row: two `type="time"` inputs (`min-h-[44px]`) bound to `sessionStartTime` / `sessionEndTime`, and a `text-sm text-gray-600` line "{duration} min". The Review step keeps its copies.
- **Minutes follow the times until edited (15):** a `minutesTouched` ref set true in the TherEx/TherAct `onChange`s; while false, a `useEffect` on `[sessionStartTime, sessionEndTime]` re-applies `splitMinutes` only when the current defaults came from the split (track `minutesSource: 'copy' | 'last' | 'split'` in a ref).
- **Zero-minutes confirm (15):** in the save handler (around 395), before saving, if `therExMinutes + therActMinutes === 0`, `await confirm({ title: 'No treatment minutes', message: 'TherEx and TherAct are both 0. The exported note will show no billable minutes. Save anyway?', confirmLabel: 'Save anyway' })` and return if false.
- **Step indicator (8):** render steps 1 to 5 only (skip index 6 as well as 0); circles `w-9 h-9 sm:w-12 sm:h-12`, icon size 18 on phone via `className="sm:hidden"` / `"hidden sm:block"` pairs or a `useMediaQuery`-free approach: render `<Icon size={18} className="sm:hidden" />` and `<Icon size={24} className="hidden sm:block" />`. Below the row on phone only: `<p className="sm:hidden text-sm text-gray-600 text-center mt-2">Step {currentStep} of 5: {steps[currentStep].name}</p>`. Drop `overflow-x-auto` from the wrapper.
- **Sticky bar above the tab bar (Review Focus 1):** the five `sticky bottom-0` bars become `sticky bottom-16 sm:bottom-0`.
- **Dates and age (9, 21):** line 544 and 809 age via `formatAge(patient.dob)`; line 546 last session via `formatShortDate(patient.lastSessionDate)`; the Review step's `formatDate(selectedDate)` becomes `formatMediumDate`. The local `formatTime` at 272 duplicates `sessionFormatting.formatTime`; import that one and delete the local copy.

- [ ] **Step 4: Run tests, build, audit**

Run: `CI=true npx react-scripts test --watchAll=false`; `CI=true npm run build`; `npm run audit:phone`
Expected: PASS; zero warnings; the wizard screenshots show five circles that fit, a "Step 1 of 5: Subjective" line, the session time row on Subjective, and Review prefilled with 15/15 for a 30 minute session when copy-forward is not used.

- [ ] **Step 5: Manual check (Review Focus 3 and 4)**

With the dev server running on the phone viewport (DevTools device mode): start a note for the seeded patient whose last session has null times; expected: the times default to the clock. Start from last session for a patient whose last note has 0 minutes; expected: minutes are the split, and clearing both to 0 then saving shows the confirm.

- [ ] **Step 6: Commit**

```bash
git add src/screens/SessionWizard.js src/utils/sessionDefaults.js src/utils/sessionDefaults.test.js src/App.js
git commit -m "Default session times and minutes from the last note, warn on zero minutes, and fit the wizard steps on a phone"
```

---

### Task 10: Docs and final verification

**Files:**
- Modify: `CLAUDE.md` (Architecture: add `AppHeader`, `BottomNav`, `BackLink`, `sessionDefaults.js`; Commands: add `npm run audit:phone`; a new invariant 9: "Phone layout: every control is 44 px, `sm:` is the only breakpoint, run `npm run audit:phone` after touching a screen")
- Modify: `docs/QA-FLOW-AUDIT.md` (header conventions now: compact bar, bottom tabs on phone, active tab; flows for the Details accordion, the Due tooltip, the session time row, the zero-minutes confirm, and the skipped start screen)
- Modify: `README.md` (Features: "Tablet & phone friendly" line mentions the bottom tab bar; Getting started: the audit script)
- Modify: `docs/ux-audit-2026-10-28.md` (add a "Status" line at the top: "All 23 items shipped on <date>; see the plan.")

- [ ] **Step 1: Update the four docs**

- [ ] **Step 2: Full verification**

Run: `CI=true npx react-scripts test --watchAll=false` (expect 37 + new tests, all passing); `CI=true npm run build` (zero warnings); `npm run audit:phone` (every route `ok`, no `SMALL`, exit 0). Open the `scripts/phone-audit-shots/` images and look at each one. Then on the laptop viewport (1280 px) open Home, a patient, a note, and the wizard in the browser and confirm nothing regressed: top nav visible with the active link, no bottom bar, toasts top-right.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md docs/QA-FLOW-AUDIT.md docs/ux-audit-2026-10-28.md
git commit -m "Document the phone layout, the audit script, and the new wizard defaults"
```

---

## Self-review notes

- Spec coverage: audit items 1 to 23 map to Tasks 4 (1, 2), 5 (3, 16, 20), 2 (4, 5, 6, 23), 6 (7, 17, 19), 7 (7, 11, 12, 19, 23), 3 (9, 10, 21), 9 (8, 13, 14, 15, 21), 8 (18, 21). Item 22 (Copy note) is phase 2 by the spec; Task 4 leaves room for it.
- Names used across tasks: `BackLink({to, label})`, `formatMediumDate`, `formatAge`, `calculateAge`, `visitsThisWeek`, `sortDueFirst`, `defaultSessionTimes`, `splitMinutes`, `defaultMinutes`. Each is defined in the task before it is consumed.
- Review Focus 1 is checked in Tasks 2 and 9; 2 in Task 5; 3 and 4 in Task 9; 5 by the seed in Task 1 and every later audit run.
