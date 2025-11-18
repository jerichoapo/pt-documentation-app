// Data store for managing patients and sessions with localStorage persistence

const STORAGE_KEY = 'ptAppData';
const STORAGE_VERSION = '1.1';

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
  const patientSessions = sessions.filter(s => s.patientId === patient.id && !s.deleted_at);
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

// Soft delete utilities
const getPermanentlyDeletedAt = (deletedAt) => {
  const deletedDate = new Date(deletedAt);
  deletedDate.setDate(deletedDate.getDate() + 30); // 30 days retention
  return deletedDate.toISOString();
};

const isExpiredForPermanentDeletion = (permanentlyDeletedAt) => {
  return new Date(permanentlyDeletedAt) <= new Date();
};

const daysUntilPermanentDeletion = (permanentlyDeletedAt) => {
  const now = new Date();
  const expiration = new Date(permanentlyDeletedAt);
  const diffTime = expiration - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
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

    // Migrate data if needed
    if (data.version !== STORAGE_VERSION) {
      // Handle migration from 1.0 to 1.1 - add soft delete fields if missing
      if (data.version === '1.0') {
        // No specific migration needed - soft delete fields will be added when items are updated
        data.version = STORAGE_VERSION;
        saveToStorage(data);
      }
    }

    // Run periodic cleanup of expired items (simulates background job)
    data = store.purgeExpiredItems(data);

    return data;
  },

  // Patient operations
  getPatients: (data) => data.patients.filter(p => !p.deleted_at),

  getPatientById: (data, patientId) => {
    const patient = data.patients.find(p => p.id === patientId);
    return patient && !patient.deleted_at ? patient : null;
  },

  getDeletedPatientById: (data, patientId) => {
    const patient = data.patients.find(p => p.id === patientId);
    return patient && patient.deleted_at ? patient : null;
  },

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

  softDeletePatient: (data, patientId) => {
    const now = new Date().toISOString();
    const permanentlyDeletedAt = getPermanentlyDeletedAt(now);

    // Soft delete patient
    const newPatients = data.patients.map(p =>
      p.id === patientId
        ? { ...p, deleted_at: now, permanently_deleted_at: permanentlyDeletedAt }
        : p
    );

    // Soft delete all active sessions for this patient
    const newSessions = data.sessions.map(s =>
      s.patientId === patientId && !s.deleted_at
        ? {
            ...s,
            deleted_at: now,
            permanently_deleted_at: permanentlyDeletedAt,
            deleted_with_patient_id: patientId
          }
        : s
    );

    const newData = {
      ...data,
      patients: newPatients,
      sessions: newSessions
    };

    saveToStorage(newData);
    return newData;
  },

  deletePatient: (data, patientId) => {
    // For backward compatibility, this now calls softDeletePatient
    return store.softDeletePatient(data, patientId);
  },

  // Session operations
  getSessionsForPatient: (data, patientId) =>
    data.sessions
      .filter(s => s.patientId === patientId && !s.deleted_at)
      .sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate)),

  getSessionById: (data, sessionId) => {
    const session = data.sessions.find(s => s.id === sessionId);
    return session && !session.deleted_at ? session : null;
  },

  getDeletedSessionById: (data, sessionId) => {
    const session = data.sessions.find(s => s.id === sessionId);
    return session && session.deleted_at ? session : null;
  },

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

  softDeleteSession: (data, sessionId) => {
    const sessionIndex = data.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
      throw new Error('Session not found');
    }

    const now = new Date().toISOString();
    const permanentlyDeletedAt = getPermanentlyDeletedAt(now);

    const newSessions = [...data.sessions];
    newSessions[sessionIndex] = {
      ...newSessions[sessionIndex],
      deleted_at: now,
      permanently_deleted_at: permanentlyDeletedAt
    };

    // Update patient cache
    const newPatients = data.patients.map(patient => {
      if (patient.id === newSessions[sessionIndex].patientId) {
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

  deleteSession: (data, sessionId) => {
    // For backward compatibility, this now calls softDeleteSession
    return store.softDeleteSession(data, sessionId);
  },

  // Soft delete operations
  restorePatient: (data, patientId) => {
    const newPatients = data.patients.map(p =>
      p.id === patientId
        ? { ...p, deleted_at: null, permanently_deleted_at: null }
        : p
    );

    // Also restore sessions that were deleted with this patient
    const newSessions = data.sessions.map(s =>
      s.deleted_with_patient_id === patientId
        ? { ...s, deleted_at: null, permanently_deleted_at: null, deleted_with_patient_id: null }
        : s
    );

    // Update patient cache
    const finalPatients = newPatients.map(patient =>
      patient.id === patientId ? updatePatientCache(patient, newSessions) : patient
    );

    const newData = {
      ...data,
      patients: finalPatients,
      sessions: newSessions
    };

    saveToStorage(newData);
    return newData;
  },

  restoreSession: (data, sessionId) => {
    const sessionIndex = data.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
      throw new Error('Session not found');
    }

    const newSessions = [...data.sessions];
    newSessions[sessionIndex] = {
      ...newSessions[sessionIndex],
      deleted_at: null,
      permanently_deleted_at: null,
      deleted_with_patient_id: null
    };

    // Update patient cache
    const newPatients = data.patients.map(patient => {
      if (patient.id === newSessions[sessionIndex].patientId) {
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

  permanentlyDeletePatient: (data, patientId) => {
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

  permanentlyDeleteSession: (data, sessionId) => {
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

  getRecentlyDeletedPatients: (data) => {
    return data.patients
      .filter(p => p.deleted_at)
      .map(p => ({
        ...p,
        daysUntilPermanentDeletion: daysUntilPermanentDeletion(p.permanently_deleted_at)
      }))
      .sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
  },

  getRecentlyDeletedSessions: (data) => {
    return data.sessions
      .filter(s => s.deleted_at)
      .map(s => ({
        ...s,
        daysUntilPermanentDeletion: daysUntilPermanentDeletion(s.permanently_deleted_at)
      }))
      .sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
  },

  purgeExpiredItems: (data) => {
    const now = new Date();
    let hasChanges = false;

    const newPatients = data.patients.filter(p => {
      if (p.permanently_deleted_at && new Date(p.permanently_deleted_at) <= now) {
        hasChanges = true;
        return false;
      }
      return true;
    });

    const newSessions = data.sessions.filter(s => {
      if (s.permanently_deleted_at && new Date(s.permanently_deleted_at) <= now) {
        hasChanges = true;
        return false;
      }
      return true;
    });

    if (hasChanges) {
      return {
        ...data,
        patients: newPatients,
        sessions: newSessions
      };
    }

    return data;
  },

  // Utility functions
  clearAllData: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  exportData: (data) => {
    return JSON.stringify(data, null, 2);
  }
};
