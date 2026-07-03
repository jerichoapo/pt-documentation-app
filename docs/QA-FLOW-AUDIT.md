# QA Flow Audit — Pediatric Therapy Notes

A user-perspective walkthrough of every flow in the app, written as an auditable
test script. Each numbered flow lists the steps a user takes and the expected
behavior as checkboxes. Work top to bottom: the early flows create the data the
later flows need.

Written 2026-07-03 against schema v1.4 (all four roadmap phases built). Every
expected behavior here was verified in a live walkthrough on that date.

## Environment setup

- Run `npm start` and open http://localhost:3000 in Chrome (desktop size).
- **Fresh start:** DevTools → Application → Local Storage → delete the keys
  `ptAppData`, `pt-app-profile`, `pt-app-meta`, `ptAppSessionDraft`, and Session
  Storage key `ptAppBackupNudgeDismissed`. Reload.
- All data is local to this browser profile. There is no login.

## Global conventions (check these throughout, not once)

- [ ] Every confirmation is a styled in-app modal — the browser's native
      confirm/alert popups must NEVER appear anywhere.
- [ ] Destructive confirmations (deletes) have a red confirm button; restores and
      neutral confirmations have a blue one. Cancel always closes with no effect.
- [ ] Feedback arrives as toast messages in the top-right (green success, red
      error, yellow warning) that auto-dismiss after ~4 seconds.
- [ ] Any date you pick in a date field displays as that same calendar day
      everywhere it later appears (lists, detail pages, exports). No off-by-one.
- [ ] Clearing a date field never crashes the page; the field snaps back to its
      previous value.
- [ ] Reloading the browser at any point never loses saved data and never shows
      a "Data corruption" error.
- [ ] The header navigation is: Home · Patients · Schools · Settings (gear icon)
      · "+ Add Patient" button. There is no "Recently Deleted" in the header.

---

## 1. First launch (empty app)

1. Fresh start (see setup), land on Home.
- [ ] A blue banner asks me to add provider info ("exported notes are signed")
      with a "Set up profile" link → goes to the profile form.
- [ ] No amber backup banner yet (there are no patients).
- [ ] A "Session Date" card shows today's date; the date input matches the
      header text exactly (same day).
- [ ] The Patients card shows "No patients found…" with an "+ Add Patient" button.
- [ ] No search box or "By school / A–Z" toggle appears while there are no patients.

## 2. Provider profile

1. Go to Settings → Provider Profile (or the blue banner's link).
2. Save with empty names.
- [ ] First and last name each show a required-field error; nothing saves.
3. Fill first/last name. In Credentials, type "dpt" and press Enter, then add
   a second credential. Click the small × on one chip.
- [ ] Each Enter turns the text into an uppercase chip (DPT); duplicates are
      ignored; × removes the chip.
4. Enter a license number, Save.
- [ ] "Profile updated successfully" toast; returns Home; the blue profile
      banner is gone and stays gone after reload.

## 3. Schools

### 3a. Create
1. Schools → Add School. Submit empty.
- [ ] Errors under every required field (name, street, city, state, ZIP,
      point of contact, phone); Save is blocked while errors exist.
2. Type letters into ZIP; type a 10-digit phone.
- [ ] ZIP accepts digits only, max 5. Phone auto-formats to (XXX) XXX-XXXX.
3. Fill all required fields (state from dropdown) and Save.
- [ ] "School created successfully" toast; back on the Schools list; the school
      appears with address, contact, phone, and patient count 0.

### 3b. List behaviors
- [ ] The address is a link that opens Google Maps in a new tab.
- [ ] Typing in the search box filters after a brief pause; clearing restores all.
- [ ] Clicking the "School Name" / "Patients" column headers toggles sort
      direction (arrow indicator flips).
- [ ] The patient count is a link — with 0 patients it still navigates to the
      Patients page filtered by this school (empty result is fine for now).

### 3c. Profile & edit
1. Click the school name.
- [ ] Read-only profile with all fields, plus an "Assigned Patients (0)" section
      showing "No patients assigned to this school."
2. Edit School, change a field, Save.
- [ ] "School updated successfully" toast; you land back on the Schools list and
      the change is visible there (and on the profile when you reopen it).

## 4. Patients

### 4a. Create — validation
1. "+ Add Patient". Submit empty.
- [ ] Errors on first name, last name, date of birth, guardian name, and phone.
2. Set date of birth to a future date.
- [ ] "Date of birth cannot be in the future."
3. Type a 10-digit phone.
- [ ] It formats live as "(555) 123 - 4567".
4. In School, type a name that matches no school and submit.
- [ ] "Please select a school from the dropdown or leave blank."

### 4b. Create — school linkage and the Add School detour
1. Focus the School field.
- [ ] A dropdown lists existing schools plus a "+ Add School" row.
2. Fill several patient fields, type a NEW school name, click "+ Add School".
- [ ] The school form opens with the name prefilled and the back button reads
      "Back to Patient Form".
3. Complete and save the school.
- [ ] You return to the patient form with EVERYTHING you had typed still there
      and the new school filled into the School field.
4. (Also try Cancel on the school form.)
- [ ] Cancel also returns to the patient form with your typed data intact.

### 4c. Create — goals, frequency, duplicate check
1. Set Visit Frequency (e.g. 2× per week).
2. Add two goals ("Add Goal" → description; target date optional). Leave one
   goal's text blank to confirm blanks are dropped.
3. Save.
- [ ] Lands on the Patients list; the patient row shows the school name.
4. Add another patient with the SAME first name, last name, and birth date.
- [ ] A "Possible duplicate patient" modal appears. Cancel → nothing created.
      Add Anyway → second record created.
5. Delete the duplicate afterward (patient profile → Delete Patient) to keep
   test data clean.

### 4d. Patient profile
- [ ] Shows age (matches birth date), guardian, formatted phone, birth date,
      diagnosis, grade, school, notes.
- [ ] Therapy Goals listed with a status chip each (Active = blue); blank goal
      from 4c is absent; target date shows when set.
- [ ] With zero notes: "Start New Session" and "Start First Session" appear,
      but NO "Start from Last Session" button.

### 4e. Patients list
- [ ] Search filters by name and by diagnosis text.
- [ ] Visiting via a school's patient-count link shows a blue
      "School: {name}" chip and only that school's patients; × on the chip
      clears the filter.
- [ ] A quiet "Recently Deleted" link sits under the list.

## 5. Home caseload

Prerequisite: at least 2 patients — one with a school, one without.

- [ ] Patients are grouped under uppercase school-name headers with counts;
      patients without a school appear under "No school", always the LAST group.
- [ ] The "A–Z" toggle flattens the list, sorted by last name, and each card
      gains a "School: …" line; "By school" restores grouping.
- [ ] Search filters cards live; groups with no matches disappear entirely;
      no-match shows "No patients match your search."
- [ ] A patient WITH a visit frequency who has been seen fewer times this week
      (Mon–Sun) than the frequency shows an amber "Due" badge; patients with no
      frequency never show it. (After documenting enough sessions this week,
      the badge disappears.)
- [ ] The card's ⋮ menu offers View All Notes / Edit Patient / Delete Patient;
      Delete asks via modal mentioning "Recently Deleted".
- [ ] With ≥1 patient and no backup for 7+ days (or ever): an amber backup
      banner shows; its × dismisses it for this browser session only.

## 6. Documenting a session (the wizard)

### 6a. Happy path
1. On Home, change the Session Date picker to a specific past date (e.g. last
   Monday). Click "Start Session" on a patient.
- [ ] The wizard opens on Subjective; a step indicator shows
      Subjective → Objective → Assessment → Plan → Review → Complete.
2. Try to reach Complete by clicking the step circles.
- [ ] Steps S/O/A/P/Review are clickable; Complete is disabled.
3. Go to Review without filling anything and press "Save & Continue".
- [ ] A warning toast lists ALL missing sections; nothing saves.
4. Fill Subjective; on Objective select at least one category AND write notes
   (both are required); fill Assessment and Plan.
- [ ] On the Assessment step, an "Active goals" box lists the patient's active
      goals as a numbered reference (only if the patient has goals).
5. On Review:
- [ ] The date equals the one picked on Home (not today).
- [ ] Start/end times are pre-filled (roughly the last half hour); edit them,
      go Back to a section, return to Review — your edited times are KEPT.
- [ ] Set TherEx + TherAct so they exceed the session length: an amber hint
      appears ("Combined minutes (X) exceed the session length (Y)…") and does
      NOT block saving; fixing the times removes it.
6. "Save & Continue".
- [ ] Toast "Session saved for {name}"; a "Session Documented Successfully!"
      screen with a summary; the note is already saved at this point (reloading
      here must not lose it).
7. "Return to Patient".
- [ ] The note is in Session History with the correct date and duration, and
      the patient's "Last session" on Home/lists reflects it.

### 6b. Draft autosave (interruption safety)
1. Start a new session, type a sentence into Subjective, advance one step,
   then reload the browser (or close/reopen the tab) and start a session for
   the SAME patient.
- [ ] A "Resume unsaved note?" modal shows the saved time. Resume → your text
      AND your step are restored. Discard → a clean wizard; re-entering shows
      no prompt.
2. Complete and save a resumed note.
- [ ] After saving, re-entering the wizard shows no resume prompt (draft cleared).

### 6c. Copy-forward
Prerequisite: the patient has ≥1 saved note.
1. On the patient profile, a "Start from Last Session" button now exists.
   Click it.
- [ ] Toast "Prefilled from the {date} session — update what changed before
      saving"; Subjective/Objective (incl. categories)/Assessment/Plan and
      TherEx/TherAct match the last note; the DATE is today and the times are
      fresh (NOT copied).
2. Change some text and save.
- [ ] A NEW note is created; the original note is unchanged.
3. Leave an unsaved draft, then enter via "Start from Last Session".
- [ ] The resume prompt appears FIRST. Resume → your draft text (no prefill
      overwrite). Discard → the prefill is applied.

### 6d. Last-note peek
With ≥1 prior note, on each of the four SOAP steps:
- [ ] A collapsed "Last session — {date}" strip sits under the patient header;
      expanding shows that same section's previous text (on Objective, also the
      previous category chips); it auto-collapses when you change steps.
- [ ] For a patient with no notes, the strip does not exist.

## 7. Viewing, editing, exporting a note

### 7a. View & edit
1. Open a note from Session History.
- [ ] Full note: date, time range + duration, TherEx/TherAct, color-coded
      S/O/A/P sections, category chips.
2. Edit → clear the Subjective → Save.
- [ ] Warning toast "Cannot save. Missing required sections: Subjective";
      still in edit mode; stored note untouched.
3. Restore the text, change the Assessment wording and the date, Save.
- [ ] "Session updated successfully" toast; new values shown; the date shown is
      exactly the one picked.

### 7b. Amendment trail
After the edit in 7a-3:
- [ ] An amber "Amended {date}" badge appears next to the note's date.
- [ ] An "Amendment History (1)" card appears below the note; expanding shows
      the timestamped entry with the note's PREVIOUS content (old assessment
      text, old date/times/minutes).
- [ ] Edit again but change nothing → Save: the history count does NOT grow.
- [ ] Edit and change content again: history becomes (2), newest first.

### 7c. Exports
1. With an EMPTY provider profile (temporarily clear it if needed):
- [ ] The Download modal shows an amber warning that exports will read
      "Provider: N/A", with a link to the profile.
2. With the profile set, download the note as PDF, then as DOCX.
- [ ] "Note exported successfully!" toast each time; files download named
      `Note_{Name}_{Date}.pdf/.docx`.
- [ ] Open the files: patient name; "Date of Service" matching the note's
      calendar date; TherEx/TherAct lines; a numbered "Goals:" block (active
      goals only); the four SOAP sections with a categories line; provider name
      with credentials; signature; license; "Electronically signed"; and — for
      the amended note — an "Amendment history: originally documented …;
      amended …" line.
3. On the patient profile, "Download All Notes".
- [ ] One combined file with each note on its own page, named
      `Notes_{Name}_All_Sessions.*`.

## 8. Recently Deleted (trash)

Reach it via Settings → Recently Deleted, or the link under the Patients list.

### 8a. Notes
1. Delete a note (note page → Delete Note → modal mentions 30 days).
- [ ] "Note moved to Recently Deleted" toast; back on the patient profile;
      session count decreased.
2. In the trash, Notes tab:
- [ ] The note is listed with its session date, a snippet, the deletion date,
      and "30 days" remaining.
3. Restore it.
- [ ] The note is restored immediately (no confirmation — restores are safe) with
      a "Note restored successfully" toast → it's back on the patient.

### 8b. Patients (cascade)
1. Delete a patient who HAS notes.
- [ ] The confirm modal states the patient AND their note count are moving to
      Recently Deleted; afterward the toast repeats it; the app does not crash;
      you land on Home; the school's patient count drops by one.
2. In the trash: the patient is under Patients and their notes under Notes.
3. Open a deleted NOTE's detail page and click Restore Note.
- [ ] Because its patient is deleted, a decision modal offers "Restore note
      only" vs "Restore note and patient" (default). Choosing note+patient
      restores both and navigates to the patient profile; goals, school link,
      and session count are all intact.
4. (Alternative) "Restore note only":
- [ ] The note becomes active but is explicitly warned it won't appear anywhere
      until the patient is restored.
5. Delete the patient again, then restore from the trash row.
- [ ] Patient AND cascaded notes come back together ("Patient and N notes
      restored successfully").

### 8c. Bulk operations & permanence
1. Delete two patients, select both via checkboxes in the trash.
- [ ] "Restore (2)" restores BOTH (verify both reappear).
2. Delete an item, then use its Delete button in the trash.
- [ ] A red "cannot be undone" modal; after confirming, the item is gone
      forever (not restorable anywhere).
3. "Empty Trash" on a tab with items.
- [ ] Red modal naming the count; after confirming, that tab shows its empty
      state.
4. Schools tab: delete a school with 0 patients (Schools page → trash icon).
- [ ] It appears under Schools in the trash and can be restored or permanently
      deleted like the others. A school WITH assigned patients cannot be
      deleted at all (modal warning, confirm disabled).

## 9. Data safety (Settings → Your Data)

1. Note the "In this app: X patients, Y session notes, Z schools" line —
   verify the numbers match reality (deleted items don't count).
2. "Download Backup".
- [ ] A `pt-app-backup-YYYY-MM-DD.json` file downloads; "Backup downloaded"
      toast; "Last backup: {today} (today)" appears; the Home backup banner is
      gone.
3. Change some data (add a patient), then "Import Backup" with the file from
   step 2.
- [ ] A red modal compares "Current: …" vs "Backup: …" counts. Confirming
      replaces everything with the backup (the new patient is gone), with a
      success toast and no reload needed.
4. Import a non-backup file (any random .json or .txt renamed).
- [ ] "That file is not a valid PT App backup." toast; existing data untouched.
5. Reload after all of this.
- [ ] Everything persists exactly; no errors.

## 10. Phone & tablet layout

Use DevTools device toolbar. At **375px** (phone):
- [ ] Header wraps; no page scrolls sideways anywhere.
- [ ] Patients, Schools, and Recently Deleted show stacked CARDS instead of
      tables, with comfortably large tap targets (school edit/delete ≈44px).
- [ ] In the wizard, the step indicator shrinks (circles only, no labels) and
      the Back/Continue buttons stick to the bottom of the screen.
- [ ] Modals fit the screen width.

At **768px** (tablet):
- [ ] Tables return on Patients/Schools/Recently Deleted; step labels return in
      the wizard; still no sideways scroll on any page.

---

## Known & intentional behaviors (do not file as bugs)

- All data lives in this browser only; there is no login, sync, or server.
  The backup file is the recovery mechanism. (HIPAA hardening is explicitly
  out of scope by owner decision.)
- Only ONE unsaved wizard draft exists at a time; typing in patient B's wizard
  replaces patient A's unsaved draft without warning.
- "Restore note only" for a deleted patient intentionally leaves the note
  invisible until the patient is restored.
- Permanently deleting a patient permanently deletes all their notes too.
- Amendments record only clinical-content changes; the history has no
  author (single-provider app) and exports show amendment dates, not diffs.
- The Home date picker seeds the session date for "Start Session" from Home;
  starting from the patient profile always defaults to today.
- The backup nudge dismissal lasts only for the browser session — it returns
  after restarting the browser until a backup is actually downloaded.
- Trash items auto-purge after 30 days without further warning.
