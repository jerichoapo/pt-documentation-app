// Notes as a CSV file that opens cleanly in Google Sheets: one row per note,
// newest first, every field quoted, with a byte order mark so accents survive.
import { getObjectiveCategoryLabels } from './noteContent';
import { todayStamp } from './download';

export const CSV_COLUMNS = [
  'patient_last_name',
  'patient_first_name',
  'dob',
  'school',
  'session_date',
  'start_time',
  'end_time',
  'subjective',
  'objective_categories',
  'objective_notes',
  'assessment',
  'plan',
  'ther_ex_minutes',
  'ther_act_minutes',
  'amended',
  'created_at',
  'updated_at'
];

// Sheets reads a cell that starts with = + - or @ as a formula, so "- Continue
// POC" would show #ERROR!. A leading apostrophe keeps it text.
const asText = (value) => (typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

const quote = (value) => `"${String(asText(value) ?? '').replace(/"/g, '""')}"`;

const pad = (n) => String(n).padStart(2, '0');

// ISO timestamp -> 'YYYY-MM-DD HH:MM' in local time, which Sheets reads as a date
const localStamp = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const newestFirst = (a, b) =>
  (b.sessionDate || '').localeCompare(a.sessionDate || '') ||
  (b.startTime || '').localeCompare(a.startTime || '');

export const buildNotesCsv = ({ sessions, patients, schools }) => {
  const activePatients = new Map(patients.filter((p) => !p.deleted_at).map((p) => [p.id, p]));
  const schoolNames = new Map((schools || []).map((s) => [s.id, s.name]));

  const rows = sessions
    .filter((s) => !s.deleted_at && activePatients.has(s.patientId))
    .sort(newestFirst)
    .map((s) => {
      const p = activePatients.get(s.patientId);
      return [
        p.lastName,
        p.firstName,
        p.dob,
        schoolNames.get(p.schoolId) || p.school || '',
        s.sessionDate,
        s.startTime,
        s.endTime,
        s.subjective,
        getObjectiveCategoryLabels(s.objectiveCategories).join('; '),
        s.objectiveNotes,
        s.assessment,
        s.plan,
        s.therExMinutes ?? 0,
        s.therActMinutes ?? 0,
        (s.amendments || []).length > 0 ? 'yes' : 'no',
        localStamp(s.createdAt),
        localStamp(s.updatedAt)
      ];
    });

  return `﻿${[CSV_COLUMNS, ...rows].map((row) => row.map(quote).join(',')).join('\r\n')}\r\n`;
};

const slug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const csvFileName = ({ patient, now = new Date() } = {}) => {
  const stamp = todayStamp(now);
  return patient
    ? `pt-app-notes-${slug(patient.lastName)}-${slug(patient.firstName)}-${stamp}.csv`
    : `pt-app-notes-${stamp}.csv`;
};
