// Data store for managing patients and sessions with localStorage persistence

const STORAGE_KEY = 'ptAppData';
const STORAGE_VERSION = '1.0';

// Default empty data structure
const createEmptyData = () => ({
  version: STORAGE_VERSION,
  patients: [],
  sessions: []
});

// Storage utilities with error handling
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return createEmptyData();
    }

    const parsed = JSON.parse(stored);

    // Basic data integrity check
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.patients) || !Array.isArray(parsed.sessions)) {
      console.error('Data corruption detected in localStorage');
      // Return empty data and let the app handle recovery UI
      return null; // Signal corruption
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load data from localStorage:', error);
    return null; // Signal corruption
  }
};

const saveToStorage = (data) => {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    console.error('Failed to save data to localStorage:', error);
    // Check if it's a quota exceeded error
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      throw new Error('STORAGE_QUOTA_EXCEEDED');
    }
    throw error;
  }
};

// Utility functions for data management
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const updatePatientCache = (patient, sessions) => {
  const patientSessions = sessions.filter(s => s.patientId === patient.id);
  if (patientSessions.length === 0) {
    return {
      ...patient,
      lastSessionDate: null,
      sessionCount: 0
    };
  }

  // Sort sessions by date descending to get the latest
  const sortedSessions = patientSessions.sort((a, b) =>
    new Date(b.sessionDate) - new Date(a.sessionDate)
  );

  return {
    ...patient,
    lastSessionDate: sortedSessions[0].sessionDate,
    sessionCount: patientSessions.length
  };
};

// Main store API
export const store = {
  // Initialize store and return current data
  init: () => {
    let data = loadFromStorage();

    // If data is corrupted, we'll handle this at the context level
    if (data === null) {
      // Try to get the raw corrupted data for export
      let corruptData = null;
      try {
        const rawData = localStorage.getItem(STORAGE_KEY);
        if (rawData) {
          corruptData = JSON.parse(rawData);
        }
      } catch (e) {
        // If we can't parse it, just pass null
      }

      const error = new Error('STORAGE_CORRUPTED');
      error.corruptData = corruptData;
      throw error;
    }

    // Migrate data if needed (for future versions)
    if (data.version !== STORAGE_VERSION) {
      // For now, just update version
      data.version = STORAGE_VERSION;
      saveToStorage(data);
    }

    return data;
  },

  // Patient operations
  getPatients: (data) => data.patients,

  getPatientById: (data, patientId) =>
    data.patients.find(p => p.id === patientId),

  addPatient: (data, patientData, options = {}) => {
    const normalizedFirstName = patientData.firstName.toLowerCase().trim();
    const normalizedLastName = patientData.lastName.toLowerCase().trim();
    const normalizedKey = `${normalizedFirstName}|${normalizedLastName}|${patientData.dob}`;

    // Check for duplicates unless explicitly skipped
    if (!options.skipDuplicateCheck) {
      const duplicate = data.patients.find(patient => {
        const patientKey = `${patient.firstName.toLowerCase().trim()}|${patient.lastName.toLowerCase().trim()}|${patient.dob}`;
        return patientKey === normalizedKey;
      });

      if (duplicate) {
        throw new Error(`DUPLICATE_PATIENT:${duplicate.id}`);
      }
    }

    const newPatient = {
      id: generateId(),
      firstName: patientData.firstName.trim(),
      lastName: patientData.lastName.trim(),
      dob: patientData.dob,
      diagnosis: patientData.diagnosis?.trim() || '',
      guardianName: patientData.guardianName?.trim() || '',
      guardianPhone: patientData.guardianPhone?.trim() || '',
      notes: patientData.notes?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSessionDate: null,
      sessionCount: 0
    };

    const newData = {
      ...data,
      patients: [...data.patients, newPatient]
    };

    saveToStorage(newData);
    return newData;
  },

  updatePatient: (data, patientId, updates) => {
    const patientIndex = data.patients.findIndex(p => p.id === patientId);
    if (patientIndex === -1) {
      throw new Error('Patient not found');
    }

    const updatedPatient = {
      ...data.patients[patientIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const newPatients = [...data.patients];
    newPatients[patientIndex] = updatedPatient;

    const newData = {
      ...data,
      patients: newPatients
    };

    saveToStorage(newData);
    return newData;
  },

  deletePatient: (data, patientId) => {
    // Remove patient and all associated sessions
    const newPatients = data.patients.filter(p => p.id !== patientId);
    const newSessions = data.sessions.filter(s => s.patientId !== patientId);

    const newData = {
      ...data,
      patients: newPatients,
      sessions: newSessions
    };

    saveToStorage(newData);
    return newData;
  },

  // Session operations
  getSessionsForPatient: (data, patientId) =>
    data.sessions
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate)),

  getSessionById: (data, sessionId) =>
    data.sessions.find(s => s.id === sessionId),

  addSession: (data, sessionData) => {
    const newSession = {
      id: generateId(),
      patientId: sessionData.patientId,
      sessionDate: sessionData.sessionDate,
      startTime: sessionData.startTime || null,
      endTime: sessionData.endTime || null,
      subjective: sessionData.subjective?.trim() || '',
      objectiveCategories: sessionData.objectiveCategories || {
        balance: false,
        motorSkills: false,
        therapeuticActivities: false,
        transfers: false,
        classroomMobility: false
      },
      objectiveNotes: sessionData.objectiveNotes?.trim() || '',
      assessment: sessionData.assessment?.trim() || '',
      plan: sessionData.plan?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newSessions = [...data.sessions, newSession];

    // Update patient cache
    const newPatients = data.patients.map(patient => {
      if (patient.id === sessionData.patientId) {
        return updatePatientCache(patient, newSessions);
      }
      return patient;
    });

    const newData = {
      ...data,
      patients: newPatients,
      sessions: newSessions
    };

    saveToStorage(newData);
    return newData;
  },

  updateSession: (data, sessionId, updates) => {
    const sessionIndex = data.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
      throw new Error('Session not found');
    }

    const existingSession = data.sessions[sessionIndex];
    const updatedSession = {
      ...existingSession,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const newSessions = [...data.sessions];
    newSessions[sessionIndex] = updatedSession;

    // Update patient cache if patientId changed
    let newPatients = data.patients;
    if (updates.patientId && updates.patientId !== existingSession.patientId) {
      // Remove from old patient and add to new patient
      newPatients = data.patients.map(patient => {
        if (patient.id === existingSession.patientId || patient.id === updates.patientId) {
          return updatePatientCache(patient, newSessions);
        }
        return patient;
      });
    }

    const newData = {
      ...data,
      patients: newPatients,
      sessions: newSessions
    };

    saveToStorage(newData);
    return newData;
  },

  deleteSession: (data, sessionId) => {
    const sessionToDelete = data.sessions.find(s => s.id === sessionId);
    if (!sessionToDelete) {
      throw new Error('Session not found');
    }

    const newSessions = data.sessions.filter(s => s.id !== sessionId);

    // Update patient cache
    const newPatients = data.patients.map(patient => {
      if (patient.id === sessionToDelete.patientId) {
        return updatePatientCache(patient, newSessions);
      }
      return patient;
    });

    const newData = {
      ...data,
      patients: newPatients,
      sessions: newSessions
    };

    saveToStorage(newData);
    return newData;
  },

  // Utility functions
  clearAllData: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  exportData: (data) => {
    return JSON.stringify(data, null, 2);
  }
};
