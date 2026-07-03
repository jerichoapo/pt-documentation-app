# Pediatric Therapy Notes

**Finish your SOAP notes before you leave the building — and keep every record
on your own device.**

**Try it now: [pt-app-zeta.vercel.app](https://pt-app-zeta.vercel.app)** — no
account, no install; it opens empty and ready.

---

## The problem

School-based PT means documentation squeezed into the gaps: five students at
one school before lunch, three at another after, and a stack of notes that
follows you home. Clinic EHRs are built for billing departments, not for a
therapist working solo across campuses — they're slow, they need accounts and
Wi-Fi, and your students' records end up on someone else's server.

## What it is

Pediatric Therapy Notes is a documentation app that runs entirely in your
browser. No login, no subscription, no cloud. You pick a student, walk through
a guided SOAP note, and export a signed PDF or Word document for the district
or the chart. Everything you write stays on your device — by architecture, not
by policy.

## How you'd use it

1. **Pick the student.** Your caseload is grouped by school, the way you
   actually travel. Students who haven't hit their weekly service frequency
   show a "Due" badge, so IEP minutes don't slip.
2. **Document in the wizard.** Four guided steps — Subjective, Objective,
   Assessment, Plan — with school-based objective categories like Classroom
   Mobility and Transfers & Positioning. Your student's active goals sit right
   on the Assessment step. TherEx and TherAct minutes are captured for billing,
   with a sanity check against the session length.
3. **Export the note.** One click produces `Note_Student_Date.pdf` or `.docx`,
   electronically signed with your name, credentials, and license — or export
   a student's entire history in one file for an annual review.

## Built for how sessions actually go

- **Most sessions look like last session.** "Start from Last Session" prefills
  the whole note from the previous visit with today's date and fresh times —
  you edit what changed instead of retyping what didn't. A collapsible "last
  session" peek on every step shows what you wrote before.
- **You will get interrupted.** A fire drill mid-note costs you nothing: the
  wizard autosaves a draft as you type and offers to resume exactly where you
  stopped — even after the browser closes.
- **Records need to be defensible.** Editing a saved note automatically keeps
  a timestamped amendment history with the full previous content, and exports
  disclose when a note was amended. Deleted notes sit in a 30-day Recently
  Deleted area before anything is gone for good.

## Your data, actually yours

There is no server to trust because there is no server. The website only
delivers the app itself — every note you write is stored inside the browser on
your own device and never travels anywhere unless you export or back it up
yourself. Three habits keep that model safe:

1. **Pick one device and stick with it.** Each browser on each device keeps its
   own separate copy — there's no sync. Move data between devices with the
   built-in backup file (Settings → Download Backup, then Import on the other
   device).
2. **On an iPhone or iPad, use Share → "Add to Home Screen"** and always open
   the app from that icon. It behaves like a real app, works offline, and its
   storage is protected from Safari's periodic cleanup of sites you haven't
   visited lately.
3. **Download a backup weekly** (the app reminds you). Clearing browser data —
   or losing the device — erases your notes; the backup file is your recovery
   plan, so keep it somewhere that survives the device.

*Straight talk: this is a single-therapist tool, not a certified EHR. It has no
accounts or built-in encryption, so pair it with the basics your district
already requires — a device login and disk encryption — and keep your backup
file somewhere safe.*

## At a glance

| | |
|---|---|
| **Get it at** | [pt-app-zeta.vercel.app](https://pt-app-zeta.vercel.app) |
| **Works on** | Any modern browser — laptop or tablet, mouse or touch |
| **Requires** | Nothing. No account, no install, no internet after load |
| **Data lives** | On your device only — the server never sees a note |
| **Exports** | PDF and Word (.docx), single note or full history |
| **Captures** | SOAP + categories, TherEx/TherAct minutes, goals, frequency |
| **Safety** | Draft autosave, amendment trail, 30-day trash, JSON backup |
| **Cost** | Free — it's yours |

**Best for:** a school-based or itinerant pediatric PT documenting their own
caseload. **Not for:** multi-user clinics, billing integration, or districts
that mandate a specific EHR.
