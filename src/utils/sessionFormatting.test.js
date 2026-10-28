import { parseAppDate, toDateInputValue, formatDate, formatShortDate, formatDisplayPhone, getSessionDurationMinutes, isPatientDueThisWeek, formatMediumDate, calculateAge, formatAge, visitsThisWeek, sortDueFirst } from './sessionFormatting';

describe('parseAppDate', () => {
  test('parses plain date strings as local dates (no timezone day shift)', () => {
    const d = parseAppDate('2026-06-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
  });

  test('treats legacy UTC-midnight ISO strings as the picked calendar date', () => {
    const d = parseAppDate('2026-06-15T00:00:00.000Z');
    expect(d.getDate()).toBe(15);
  });

  test('passes through Date objects and real instants', () => {
    const now = new Date();
    expect(parseAppDate(now)).toBe(now);
    expect(parseAppDate('2026-07-03T03:14:57.410Z').toISOString()).toBe('2026-07-03T03:14:57.410Z');
  });
});

describe('toDateInputValue', () => {
  test('round-trips a picked date', () => {
    expect(toDateInputValue(parseAppDate('2026-06-15'))).toBe('2026-06-15');
  });

  test('uses local time, not UTC', () => {
    const local = new Date(2026, 6, 2, 23, 30); // July 2, 11:30 PM local
    expect(toDateInputValue(local)).toBe('2026-07-02');
  });
});

describe('formatDate', () => {
  test('displays the calendar day that was stored', () => {
    expect(formatDate('2026-06-15')).toContain('June 15, 2026');
    expect(formatDate('2026-06-15T00:00:00.000Z')).toContain('June 15, 2026');
  });

  test('handles invalid input without throwing', () => {
    expect(formatDate('garbage')).toBe('Unknown date');
    expect(formatShortDate(undefined)).toBe('Unknown date');
  });
});

describe('formatDisplayPhone', () => {
  test('formats 10-digit numbers', () => {
    expect(formatDisplayPhone('5551234567')).toBe('(555) 123-4567');
    expect(formatDisplayPhone('(555) 123 - 4567')).toBe('(555) 123-4567');
  });

  test('leaves other values untouched', () => {
    expect(formatDisplayPhone('123')).toBe('123');
    expect(formatDisplayPhone('')).toBe('');
  });
});

describe('getSessionDurationMinutes', () => {
  test('computes positive durations and rejects inverted ranges', () => {
    expect(getSessionDurationMinutes('14:00', '15:30')).toBe(90);
    expect(getSessionDurationMinutes('15:30', '14:00')).toBe(0);
    expect(getSessionDurationMinutes(null, '14:00')).toBe(0);
  });
});

describe('isPatientDueThisWeek', () => {
  // Wednesday July 1, 2026 (week runs Mon Jun 29 - Sun Jul 5)
  const now = new Date(2026, 6, 1, 12, 0);
  const patient = { id: 'p1', visitFrequency: { timesPerWeek: 2 } };

  test('due when this week has fewer sessions than the frequency', () => {
    const sessions = [
      { patientId: 'p1', sessionDate: '2026-06-29' } // Monday, 1 of 2
    ];
    expect(isPatientDueThisWeek(patient, sessions, now)).toBe(true);
  });

  test('not due once the weekly frequency is met', () => {
    const sessions = [
      { patientId: 'p1', sessionDate: '2026-06-29' },
      { patientId: 'p1', sessionDate: '2026-07-01' }
    ];
    expect(isPatientDueThisWeek(patient, sessions, now)).toBe(false);
  });

  test('ignores other patients, deleted sessions, and other weeks', () => {
    const sessions = [
      { patientId: 'p2', sessionDate: '2026-06-29' },
      { patientId: 'p1', sessionDate: '2026-06-30', deleted_at: '2026-07-01T00:00:00.000Z' },
      { patientId: 'p1', sessionDate: '2026-06-22' } // previous week
    ];
    expect(isPatientDueThisWeek(patient, sessions, now)).toBe(true);
  });

  test('never due without a frequency', () => {
    expect(isPatientDueThisWeek({ id: 'p1', visitFrequency: null }, [], now)).toBe(false);
    expect(isPatientDueThisWeek({ id: 'p1' }, [], now)).toBe(false);
  });
});

describe('formatMediumDate', () => {
  test('short weekday and month, no UTC shift', () => {
    expect(formatMediumDate('2026-10-27')).toBe('Tue, Oct 27, 2026');
  });

  test('handles invalid input without throwing', () => {
    expect(formatMediumDate('garbage')).toBe('Unknown date');
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

  test('returns null for invalid input', () => {
    expect(calculateAge('garbage', now)).toBeNull();
    expect(calculateAge('', now)).toBeNull();
  });

  test('formats months for young children only', () => {
    expect(formatAge('2022-07-01', now)).toBe('4 y 3 m');
    expect(formatAge('2018-03-14', now)).toBe('8 years');
    expect(formatAge('garbage', now)).toBe('Unknown');
  });
});

describe('visitsThisWeek / sortDueFirst', () => {
  // Wednesday July 1, 2026 (week runs Mon Jun 29 - Sun Jul 5)
  const now = new Date(2026, 6, 1, 12, 0);

  test('counts this week only, skipping deleted notes and other patients', () => {
    const sessions = [
      { patientId: 'p1', sessionDate: '2026-06-29' },
      { patientId: 'p1', sessionDate: '2026-07-01' },
      { patientId: 'p1', sessionDate: '2026-06-28' },
      { patientId: 'p1', sessionDate: '2026-06-30', deleted_at: '2026-07-01T00:00:00Z' },
      { patientId: 'p2', sessionDate: '2026-06-30' }
    ];
    expect(visitsThisWeek({ id: 'p1' }, sessions, now)).toBe(2);
  });

  test('due patients come first, order otherwise preserved', () => {
    const a = { id: 'a', visitFrequency: { timesPerWeek: 1 } };
    const b = { id: 'b', visitFrequency: { timesPerWeek: 1 } };
    const c = { id: 'c', visitFrequency: { timesPerWeek: 2 } };
    const d = { id: 'd', visitFrequency: null };
    const sessions = [
      { patientId: 'a', sessionDate: '2026-06-30' },
      { patientId: 'c', sessionDate: '2026-06-30' }
    ];
    expect(sortDueFirst([a, b, c, d], sessions, now).map(p => p.id)).toEqual(['b', 'c', 'a', 'd']);
  });
});
