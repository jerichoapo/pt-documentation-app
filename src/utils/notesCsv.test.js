import { buildNotesCsv, csvFileName } from './notesCsv';

// Every field is quoted, the header's included
const HEADER = 'patient_last_name,patient_first_name,dob,school,session_date,start_time,end_time,subjective,objective_categories,objective_notes,assessment,plan,ther_ex_minutes,ther_act_minutes,amended,created_at,updated_at'
  .split(',').map((column) => `"${column}"`).join(',');

const patients = [
  { id: 'p1', firstName: 'Ava', lastName: 'Martinez', dob: '2018-03-02', schoolId: 'sc1' },
  { id: 'p2', firstName: 'Noah', lastName: 'Lee', dob: '2017-07-09', school: 'Old Name Elementary' },
  { id: 'p3', firstName: 'Gone', lastName: 'Away', dob: '2016-01-01', schoolId: 'sc1', deleted_at: '2026-10-01T00:00:00.000Z' }
];
const schools = [{ id: 'sc1', name: 'Oak Elementary' }];
const local = (y, m, d, h, min) => new Date(y, m - 1, d, h, min).toISOString();
const note = (overrides) => ({
  patientId: 'p1',
  sessionDate: '2026-10-20',
  startTime: '09:00',
  endTime: '09:30',
  subjective: 'S',
  objectiveCategories: { balance: true, transfers: true },
  objectiveNotes: 'O',
  assessment: 'A',
  plan: 'P',
  therExMinutes: 15,
  therActMinutes: 10,
  amendments: [],
  createdAt: local(2026, 10, 20, 9, 45),
  updatedAt: local(2026, 10, 21, 14, 5),
  ...overrides
});

const rows = (csv) => csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);

test('starts with a byte order mark and the column header', () => {
  const csv = buildNotesCsv({ sessions: [], patients, schools });
  expect(csv.startsWith('﻿')).toBe(true);
  expect(rows(csv)[0]).toBe(HEADER);
});

test('quotes every field and keeps quotes and line breaks intact', () => {
  const csv = buildNotesCsv({ sessions: [note({ id: 's1', subjective: 'He said "hi"\nbye' })], patients, schools });
  expect(csv).toContain('"He said ""hi""\nbye"');
  expect(csv).toContain('"Martinez","Ava","2018-03-02","Oak Elementary","2026-10-20","09:00","09:30"');
});

test('leaves out deleted notes and notes of deleted patients, newest first', () => {
  const sessions = [
    note({ id: 'old', sessionDate: '2026-10-01', subjective: 'old' }),
    note({ id: 'late', sessionDate: '2026-10-20', startTime: '13:00', subjective: 'late' }),
    note({ id: 'early', sessionDate: '2026-10-20', startTime: '08:00', subjective: 'early' }),
    note({ id: 'deleted', deleted_at: '2026-10-22T00:00:00.000Z', subjective: 'deleted' }),
    note({ id: 'orphan', patientId: 'p3', subjective: 'orphan' })
  ];
  const subjectives = rows(buildNotesCsv({ sessions, patients, schools })).slice(1).map((row) => row.split('","')[7]);
  expect(subjectives).toEqual(['late', 'early', 'old']);
});

test('fills school, amended, categories, and local timestamps', () => {
  const sessions = [
    note({ id: 's1', amendments: [{ amendedAt: '2026-10-22T10:00:00.000Z' }] }),
    note({ id: 's2', patientId: 'p2', sessionDate: '2026-10-19', objectiveCategories: {} })
  ];
  const [, first, second] = rows(buildNotesCsv({ sessions, patients, schools }));
  expect(first).toContain('"Balance & Coordination; Transfers & Positioning"');
  expect(first).toContain('"15","10","yes","2026-10-20 09:45","2026-10-21 14:05"');
  expect(second).toContain('"Old Name Elementary"');
  expect(second).toContain('"no"');
});

test('names the file by date, and by patient when exporting one', () => {
  const now = new Date(2026, 9, 28, 8, 0);
  expect(csvFileName({ now })).toBe('pt-app-notes-2026-10-28.csv');
  expect(csvFileName({ patient: { firstName: 'Ava', lastName: 'Martinez' }, now })).toBe('pt-app-notes-martinez-ava-2026-10-28.csv');
  expect(csvFileName({ patient: { firstName: 'Mary Ann', lastName: "O'Brien" }, now })).toBe('pt-app-notes-o-brien-mary-ann-2026-10-28.csv');
});
