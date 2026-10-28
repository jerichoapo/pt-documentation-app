import { defaultSessionTimes, splitMinutes, defaultMinutes } from './sessionDefaults';

const now = new Date(2026, 9, 28, 11, 40); // local 11:40

describe('defaultSessionTimes', () => {
  test('copyFrom wins, then the last session, then the clock', () => {
    const copyFrom = { startTime: '08:00', endTime: '08:45' };
    const lastSession = { startTime: '09:30', endTime: '10:00' };
    expect(defaultSessionTimes({ copyFrom, lastSession, now })).toEqual({ startTime: '08:00', endTime: '08:45' });
    expect(defaultSessionTimes({ copyFrom: null, lastSession, now })).toEqual({ startTime: '09:30', endTime: '10:00' });
    expect(defaultSessionTimes({ copyFrom: null, lastSession: null, now })).toEqual({ startTime: '11:10', endTime: '11:40' });
  });

  test('a session missing a time is skipped', () => {
    const lastSession = { startTime: '09:00', endTime: null };
    expect(defaultSessionTimes({ copyFrom: null, lastSession, now })).toEqual({ startTime: '11:10', endTime: '11:40' });
  });
});

describe('splitMinutes', () => {
  test('halves a session and gives the odd minute to TherEx', () => {
    expect(splitMinutes('09:30', '10:00')).toEqual({ therExMinutes: 15, therActMinutes: 15 });
    expect(splitMinutes('09:30', '10:15')).toEqual({ therExMinutes: 23, therActMinutes: 22 });
  });

  test('returns zeros for an inverted or missing range', () => {
    expect(splitMinutes('10:00', '09:30')).toEqual({ therExMinutes: 0, therActMinutes: 0 });
    expect(splitMinutes(null, '09:30')).toEqual({ therExMinutes: 0, therActMinutes: 0 });
  });
});

describe('defaultMinutes', () => {
  test('copyFrom with zero minutes falls through to the split', () => {
    const copyFrom = { therExMinutes: 0, therActMinutes: 0 };
    expect(defaultMinutes({ copyFrom, lastSession: null, startTime: '09:30', endTime: '10:00' }))
      .toEqual({ therExMinutes: 15, therActMinutes: 15, source: 'split' });
  });

  test('copyFrom minutes win when set, then the last session', () => {
    const copyFrom = { therExMinutes: 20, therActMinutes: 10 };
    const lastSession = { therExMinutes: 5, therActMinutes: 25 };
    expect(defaultMinutes({ copyFrom, lastSession, startTime: '09:30', endTime: '10:00' }))
      .toEqual({ therExMinutes: 20, therActMinutes: 10, source: 'copy' });
    expect(defaultMinutes({ copyFrom: null, lastSession, startTime: '09:30', endTime: '10:00' }))
      .toEqual({ therExMinutes: 5, therActMinutes: 25, source: 'last' });
  });
});
