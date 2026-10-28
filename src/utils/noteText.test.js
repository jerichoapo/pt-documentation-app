import { formatNoteAsText } from './noteText';
import { getObjectiveCategoryLabels } from './noteContent';

const patient = {
  firstName: 'Ava',
  lastName: 'Martinez',
  goals: [
    { text: 'Walk 50 feet without support', status: 'active' },
    { text: 'Old goal', status: 'met' },
    { text: 'Climb stairs with one rail', status: 'active' }
  ]
};

const session = {
  sessionDate: '2026-10-27',
  startTime: '09:00',
  endTime: '09:30',
  therExMinutes: 15,
  therActMinutes: 15,
  subjective: 'Reports feeling good.',
  objectiveCategories: { balance: true, motorSkills: false, transfers: true },
  objectiveNotes: 'Stood on one foot for 5 seconds.',
  assessment: 'Improving balance.',
  plan: 'Continue twice weekly.',
  createdAt: '2026-10-27T16:40:00.000Z',
  amendments: []
};

const provider = { firstName: 'Jordan', lastName: 'Lee', credentials: ['PT', 'DPT'], license: 'PT12345' };

test('lays out the whole note as plain text', () => {
  const text = formatNoteAsText(session, patient, provider);
  const lines = text.split('\n');

  expect(lines[0]).toBe('Ava Martinez');
  expect(text).toContain('Date of service: October 27, 2026');
  expect(text).toContain('Time: 9:00 AM - 9:30 AM');
  expect(text).toContain('TherEx: 15 minutes');
  expect(text).toContain('TherAct: 15 minutes');
  expect(text).toContain('Goals:\n1. Walk 50 feet without support\n2. Climb stairs with one rail');
  expect(text).not.toContain('Old goal');
  expect(text).toContain('Objective categories: Balance & Coordination, Transfers & Positioning');
  expect(text).toContain('Provider: Jordan Lee, PT, DPT');
  expect(text).toContain('License Number: PT12345');
  expect(lines[lines.length - 1]).toBe('Electronically signed');

  const order = ['SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN'].map((heading) => lines.indexOf(heading));
  expect(order.every((index) => index > 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(lines[order[0] + 1]).toBe('Reports feeling good.');
});

test('adds the amendment line when the note was amended', () => {
  const amended = { ...session, amendments: [{ amendedAt: '2026-10-28T15:00:00.000Z' }] };
  expect(formatNoteAsText(amended, patient, provider)).toContain('Amendment history: originally documented');
});

test('a provider with no credentials gets no trailing comma', () => {
  const text = formatNoteAsText(session, patient, { firstName: 'Jordan', lastName: 'Lee', credentials: [], license: '' });
  expect(text).toContain('Provider: Jordan Lee\n');
  expect(text).not.toContain('License Number');
});

test('leaves out the time line when the note has no times', () => {
  const text = formatNoteAsText({ ...session, startTime: null, endTime: null }, patient, provider);
  expect(text).not.toContain('Time:');
});

test('category labels come out in a fixed order', () => {
  expect(getObjectiveCategoryLabels({ transfers: true, balance: true })).toEqual(['Balance & Coordination', 'Transfers & Positioning']);
  expect(getObjectiveCategoryLabels(undefined)).toEqual([]);
});
