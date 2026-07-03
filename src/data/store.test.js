import { store } from './store';

const STORAGE_KEY = 'ptAppData';

const readStorage = () => JSON.parse(localStorage.getItem(STORAGE_KEY));

const basePatient = {
  firstName: 'Alex',
  lastName: 'Morgan',
  dob: '2016-05-20',
  guardianName: 'Jamie Morgan',
  guardianPhone: '5551234567'
};

const baseSchool = {
  name: 'Cedar Grove Elementary',
  street_address: '123 Main St',
  city: 'Cedarville',
  state: 'CA',
  zip_code: '94513',
  point_of_contact: 'Jane Smith',
  phone: '(925) 555-1234'
};

const baseSession = (patientId) => ({
  patientId,
  sessionDate: '2026-06-15',
  startTime: '14:00',
  endTime: '14:45',
  subjective: 'Good day.',
  objectiveCategories: { balance: true },
  objectiveNotes: 'Balance work.',
  assessment: 'Participated well.',
  plan: 'Continue.',
  therExMinutes: 45,
  therActMinutes: 15
});

beforeEach(() => {
  localStorage.clear();
});

describe('persistence integrity', () => {
  test('every mutation persists the complete data shape, even from partial input', () => {
    let data = store.init();

    // Simulate a caller passing partial data (the historical corruption bug)
    data = store.addSession({ patients: [], sessions: [] }, baseSession('p1'));

    const stored = readStorage();
    expect(Array.isArray(stored.patients)).toBe(true);
    expect(Array.isArray(stored.sessions)).toBe(true);
    expect(Array.isArray(stored.schools)).toBe(true);
    expect(stored.version).toBeDefined();
    expect(stored.sessions).toHaveLength(1);
  });

  test('init repairs storage that lost its schools array and relinks schools from legacy strings', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      patients: [{ id: 'p1', firstName: 'A', lastName: 'B', dob: '2015-01-01', school: 'Lincoln Elementary', schoolId: null }],
      sessions: []
    }));

    const data = store.init();

    expect(Array.isArray(data.schools)).toBe(true);
    expect(data.schools).toHaveLength(1);
    expect(data.schools[0].name).toBe('Lincoln Elementary');
    expect(data.patients[0].schoolId).toBe(data.schools[0].id);

    const stored = readStorage();
    expect(Array.isArray(stored.schools)).toBe(true);
    expect(stored.version).toBeDefined();
  });

  test('init still flags truly corrupt storage', () => {
    localStorage.setItem(STORAGE_KEY, '{"patients": "not-an-array"}');
    expect(() => store.init()).toThrow('STORAGE_CORRUPTED');
  });

  test('exportData contains all slices and the version', () => {
    const exported = JSON.parse(store.exportData({ patients: [], sessions: [] }));
    expect(exported).toHaveProperty('version');
    expect(exported).toHaveProperty('patients');
    expect(exported).toHaveProperty('sessions');
    expect(exported).toHaveProperty('schools');
  });
});

describe('patients and sessions', () => {
  test('addPatient stores schoolId and bumps school patient count', () => {
    let data = store.init();
    data = store.createSchool(data, baseSchool);
    const school = data.schools[0];

    data = store.addPatient(data, { ...basePatient, school: school.name, schoolId: school.id });

    expect(data.patients[0].schoolId).toBe(school.id);
    expect(data.schools[0].patient_count).toBe(1);
    expect(store.getPatientCountForSchool(data, school.id)).toBe(1);
  });

  test('duplicate patients are rejected unless explicitly skipped', () => {
    let data = store.init();
    data = store.addPatient(data, basePatient);

    expect(() => store.addPatient(data, basePatient)).toThrow(/DUPLICATE_PATIENT/);
    expect(() => store.addPatient(data, basePatient, { skipDuplicateCheck: true })).not.toThrow();
  });

  test('updateSession refreshes the patient lastSessionDate cache', () => {
    let data = store.init();
    data = store.addPatient(data, basePatient);
    const patientId = data.patients[0].id;
    data = store.addSession(data, baseSession(patientId));
    const sessionId = data.sessions[0].id;

    expect(data.patients[0].lastSessionDate).toBe('2026-06-15');

    data = store.updateSession(data, sessionId, { sessionDate: '2026-06-20' });
    expect(data.patients[0].lastSessionDate).toBe('2026-06-20');
  });

  test('soft delete cascades to sessions and restore brings them back', () => {
    let data = store.init();
    data = store.createSchool(data, baseSchool);
    const school = data.schools[0];
    data = store.addPatient(data, { ...basePatient, schoolId: school.id });
    const patientId = data.patients[0].id;
    data = store.addSession(data, baseSession(patientId));

    data = store.softDeletePatient(data, patientId);
    expect(data.patients[0].deleted_at).toBeTruthy();
    expect(data.sessions[0].deleted_at).toBeTruthy();
    expect(data.sessions[0].deleted_with_patient_id).toBe(patientId);
    expect(data.schools[0].patient_count).toBe(0);

    data = store.restorePatient(data, patientId);
    expect(data.patients[0].deleted_at).toBeNull();
    expect(data.sessions[0].deleted_at).toBeNull();
    expect(data.schools[0].patient_count).toBe(1);
    expect(data.patients[0].sessionCount).toBe(1);
  });

  test('permanently deleting an already soft-deleted patient does not double-decrement the school count', () => {
    let data = store.init();
    data = store.createSchool(data, baseSchool);
    const school = data.schools[0];
    data = store.addPatient(data, { ...basePatient, schoolId: school.id });
    data = store.addPatient(data, { ...basePatient, firstName: 'Emma', schoolId: school.id });
    const patientId = data.patients[0].id;

    expect(data.schools[0].patient_count).toBe(2);

    data = store.softDeletePatient(data, patientId);
    expect(data.schools[0].patient_count).toBe(1);

    data = store.permanentlyDeletePatient(data, patientId);
    expect(data.schools[0].patient_count).toBe(1);
    expect(data.patients).toHaveLength(1);
  });

  test('purge drops items past their permanent deletion date and persists the result', () => {
    let data = store.init();
    data = store.addPatient(data, basePatient);
    const patientId = data.patients[0].id;
    data = store.softDeletePatient(data, patientId);

    // Force the retention window into the past
    const expired = {
      ...data,
      patients: data.patients.map(p => ({ ...p, permanently_deleted_at: '2000-01-01T00:00:00.000Z' })),
      sessions: data.sessions
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expired));

    const reloaded = store.init();
    expect(reloaded.patients).toHaveLength(0);
    expect(readStorage().patients).toHaveLength(0);
  });
});

describe('migration 1.3 -> 1.4', () => {
  const seedV13 = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: '1.3',
      patients: [{ id: 'p1', firstName: 'A', lastName: 'B', dob: '2015-01-01', schoolId: null, school: '' }],
      sessions: [{ id: 's1', patientId: 'p1', sessionDate: '2026-06-15', subjective: 'x', objectiveCategories: { balance: true }, objectiveNotes: 'y', assessment: 'z', plan: 'w', therExMinutes: 30, therActMinutes: 15 }],
      schools: []
    }));
  };

  test('adds goals, visitFrequency, and amendments to existing records', () => {
    seedV13();
    const data = store.init();

    expect(data.version).toBe('1.4');
    expect(data.patients[0].goals).toEqual([]);
    expect(data.patients[0].visitFrequency).toBeNull();
    expect(data.sessions[0].amendments).toEqual([]);
    expect(readStorage().version).toBe('1.4');
  });

  test('is idempotent and preserves existing 1.4 fields', () => {
    seedV13();
    let data = store.init();
    data = store.updatePatient(data, 'p1', {
      goals: [{ id: 'g1', text: 'Climb stairs', targetDate: null, status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }],
      visitFrequency: { timesPerWeek: 2 }
    });

    const reloaded = store.init();
    expect(reloaded.version).toBe('1.4');
    expect(reloaded.patients[0].goals).toHaveLength(1);
    expect(reloaded.patients[0].visitFrequency).toEqual({ timesPerWeek: 2 });
  });

  test('legacy repair path lands on 1.4 with all new fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      patients: [{ id: 'p1', firstName: 'A', lastName: 'B', dob: '2015-01-01', school: 'Lincoln Elementary', schoolId: null }],
      sessions: [{ id: 's1', patientId: 'p1', sessionDate: '2026-06-15T00:00:00.000Z' }]
    }));

    const data = store.init();
    expect(data.version).toBe('1.4');
    expect(data.patients[0].schoolId).toBe(data.schools[0].id);
    expect(data.patients[0].goals).toEqual([]);
    expect(data.sessions[0].amendments).toEqual([]);
  });
});

describe('amendment trail', () => {
  const setup = () => {
    let data = store.init();
    data = store.addPatient(data, basePatient);
    data = store.addSession(data, baseSession(data.patients[0].id));
    return data;
  };

  test('editing note content records an amendment with the previous snapshot', () => {
    let data = setup();
    const sessionId = data.sessions[0].id;

    data = store.updateSession(data, sessionId, { assessment: 'Updated assessment.' });

    const session = data.sessions[0];
    expect(session.amendments).toHaveLength(1);
    expect(session.amendments[0].previous.assessment).toBe('Participated well.');
    expect(session.amendments[0].amendedAt).toBeTruthy();
    expect(session.assessment).toBe('Updated assessment.');
  });

  test('saving identical content does not record an amendment', () => {
    let data = setup();
    const sessionId = data.sessions[0].id;
    const s = data.sessions[0];

    data = store.updateSession(data, sessionId, {
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      subjective: s.subjective,
      objectiveCategories: { ...s.objectiveCategories },
      objectiveNotes: s.objectiveNotes,
      assessment: s.assessment,
      plan: s.plan,
      therExMinutes: s.therExMinutes,
      therActMinutes: s.therActMinutes
    });

    expect(data.sessions[0].amendments).toHaveLength(0);
  });

  test('legacy ISO session date is not treated as a change', () => {
    let data = setup();
    const sessionId = data.sessions[0].id;
    // Simulate a legacy stored value
    data = { ...data, sessions: data.sessions.map(s => ({ ...s, sessionDate: '2026-06-15T00:00:00.000Z', amendments: [] })) };

    data = store.updateSession(data, sessionId, { sessionDate: '2026-06-15' });
    expect(data.sessions[0].amendments).toHaveLength(0);
  });

  test('each edit appends to the history', () => {
    let data = setup();
    const sessionId = data.sessions[0].id;

    data = store.updateSession(data, sessionId, { plan: 'Plan v2' });
    data = store.updateSession(data, sessionId, { plan: 'Plan v3' });

    expect(data.sessions[0].amendments).toHaveLength(2);
    expect(data.sessions[0].amendments[0].previous.plan).toBe('Continue.');
    expect(data.sessions[0].amendments[1].previous.plan).toBe('Plan v2');
  });
});

describe('goals and visit frequency', () => {
  test('addPatient stores goals and visit frequency', () => {
    let data = store.init();
    data = store.addPatient(data, {
      ...basePatient,
      goals: [{ id: 'g1', text: 'Ascend stairs with rail', targetDate: '2026-12-01', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }],
      visitFrequency: { timesPerWeek: 2 }
    });

    expect(data.patients[0].goals).toHaveLength(1);
    expect(data.patients[0].visitFrequency).toEqual({ timesPerWeek: 2 });

    const stored = readStorage();
    expect(stored.patients[0].goals[0].text).toBe('Ascend stairs with rail');
  });
});

describe('importData', () => {
  test('imports a modern backup and persists the complete shape', () => {
    let data = store.init();
    data = store.createSchool(data, baseSchool);
    data = store.addPatient(data, { ...basePatient, schoolId: data.schools[0].id });
    data = store.addSession(data, baseSession(data.patients[0].id));
    const backup = JSON.parse(store.exportData(data));

    localStorage.clear();
    const imported = store.importData(backup);

    expect(imported.patients).toHaveLength(1);
    expect(imported.sessions).toHaveLength(1);
    expect(imported.schools).toHaveLength(1);
    const stored = readStorage();
    expect(stored.version).toBeDefined();
    expect(stored.patients).toHaveLength(1);
  });

  test('repairs legacy backups missing schools by rebuilding from school name strings', () => {
    const imported = store.importData({
      patients: [{ id: 'p1', firstName: 'A', lastName: 'B', dob: '2015-01-01', school: 'Lincoln Elementary', schoolId: null }],
      sessions: []
    });

    expect(imported.schools).toHaveLength(1);
    expect(imported.schools[0].name).toBe('Lincoln Elementary');
    expect(imported.patients[0].schoolId).toBe(imported.schools[0].id);
  });

  test('rejects invalid backups without touching existing data', () => {
    let data = store.init();
    data = store.addPatient(data, basePatient);

    expect(() => store.importData({ patients: 'nope' })).toThrow('INVALID_BACKUP');
    expect(() => store.importData(null)).toThrow('INVALID_BACKUP');
    expect(() => store.importData([1, 2, 3])).toThrow('INVALID_BACKUP');

    expect(readStorage().patients).toHaveLength(1);
  });
});

describe('schools', () => {
  test('school with assigned patients cannot be deleted', () => {
    let data = store.init();
    data = store.createSchool(data, baseSchool);
    const school = data.schools[0];
    data = store.addPatient(data, { ...basePatient, schoolId: school.id });

    expect(() => store.softDeleteSchool(data, school.id)).toThrow(/CANNOT_DELETE/);
  });

  test('getSchoolById excludes soft-deleted schools', () => {
    let data = store.init();
    data = store.createSchool(data, baseSchool);
    const school = data.schools[0];

    expect(store.getSchoolById(data, school.id)).not.toBeNull();
    data = store.softDeleteSchool(data, school.id);
    expect(store.getSchoolById(data, school.id)).toBeNull();
    expect(store.getDeletedSchoolById(data, school.id)).not.toBeNull();
  });
});
