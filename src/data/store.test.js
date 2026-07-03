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
