// Data store for managing patients and sessions with localStorage persistence

const STORAGE_KEY = 'ptAppData';
const STORAGE_VERSION = '1.3';

// Default empty data structure
const createEmptyData = () => ({
  version: STORAGE_VERSION,
  patients: [],
  sessions: [],
  schools: []
});

// US States for validation
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

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
      // Return null and let the app handle recovery UI
      return null; // Signal corruption
    }

    // Repair partially-written data (older builds saved without schools/version).
    // Missing schools are rebuilt from the patients' legacy school-name strings below.
    if (!Array.isArray(parsed.schools)) {
      const repaired = migratePatientsToSchoolIds({ ...parsed, schools: [] });
      repaired.version = STORAGE_VERSION;
      saveToStorage(repaired);
      return repaired;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load data from localStorage:', error);
    return null; // Signal corruption
  }
};

const saveToStorage = (data) => {
  try {
    // Always persist the complete data shape so a partial caller can never
    // truncate the stored object.
    const complete = {
      version: data.version || STORAGE_VERSION,
      patients: data.patients || [],
      sessions: data.sessions || [],
      schools: data.schools || []
    };
    const serialized = JSON.stringify(complete);
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

const daysUntilPermanentDeletion = (permanentlyDeletedAt) => {
  const now = new Date();
  const expiration = new Date(permanentlyDeletedAt);
  const diffTime = expiration - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// School management utilities
const normalizeString = (str) => str.toLowerCase().trim();

const calculateLevenshteinDistance = (str1, str2) => {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
};

const fuzzyMatch = (query, target, threshold = 0.6) => {
  const queryNorm = normalizeString(query);
  const targetNorm = normalizeString(target);

  // Exact match gets highest score
  if (queryNorm === targetNorm) return 1;

  // Contains match gets high score
  if (targetNorm.includes(queryNorm)) return 0.9;

  // Start of string match gets good score
  if (targetNorm.startsWith(queryNorm)) return 0.8;

  // Calculate Levenshtein distance for fuzzy matching
  const distance = calculateLevenshteinDistance(queryNorm, targetNorm);
  const maxLength = Math.max(queryNorm.length, targetNorm.length);
  const similarity = 1 - (distance / maxLength);

  return similarity >= threshold ? similarity : 0;
};

// School validation and utility functions
const validateSchoolData = (schoolData) => {
  const errors = [];

  if (!schoolData.name || schoolData.name.trim().length === 0) {
    errors.push('School name is required');
  }

  if (!schoolData.street_address || schoolData.street_address.trim().length === 0) {
    errors.push('Street address is required');
  }

  if (!schoolData.city || schoolData.city.trim().length === 0) {
    errors.push('City is required');
  }

  if (!schoolData.state || !US_STATES.includes(schoolData.state)) {
    errors.push('Valid state is required');
  }

  if (!schoolData.zip_code || !/^\d{5}$/.test(schoolData.zip_code)) {
    errors.push('ZIP code must be exactly 5 digits');
  }

  if (!schoolData.point_of_contact || schoolData.point_of_contact.trim().length === 0) {
    errors.push('Point of contact is required');
  }

  if (!schoolData.phone || !/^[\d\s\-().+]+$/.test(schoolData.phone)) {
    errors.push('Valid phone number is required');
  }

  if (schoolData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolData.email)) {
    errors.push('Valid email address is required');
  }

  return errors;
};

const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // Format as (XXX) XXX-XXXX if 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone; // Return as-is if not 10 digits
};

const createGoogleMapsUrl = (school) => {
  const address = encodeURIComponent(
    `${school.street_address}, ${school.city}, ${school.state} ${school.zip_code}`
  );
  return `https://www.google.com/maps/search/?api=1&query=${address}`;
};

const createSearchableString = (school) => {
  return `${school.name} ${school.street_address} ${school.city} ${school.state} ${school.zip_code} ${school.point_of_contact} ${school.phone} ${school.email || ''}`.toLowerCase();
};

const migratePatientsToSchoolIds = (data) => {
  // Create schools from existing patient.school strings and assign schoolIds
  const schoolMap = new Map(); // school name -> school id
  const updatedSchools = [...data.schools];
  const updatedPatients = data.patients.map(patient => {
    // Keep an existing valid assignment
    if (patient.schoolId && updatedSchools.some(s => s.id === patient.schoolId)) {
      return patient;
    }

    if (!patient.school || typeof patient.school !== 'string' || !patient.school.trim()) {
      return { ...patient, schoolId: null };
    }

    const schoolName = patient.school.trim();
    if (!schoolMap.has(schoolName)) {
      // Check if school already exists
      const existingSchool = updatedSchools.find(s => normalizeString(s.name) === normalizeString(schoolName));
      if (existingSchool) {
        schoolMap.set(schoolName, existingSchool.id);
      } else {
        // Create new school with minimal data
        const newSchool = {
          id: generateId(),
          name: schoolName,
          street_address: '',
          city: '',
          state: '',
          zip_code: '',
          point_of_contact: '',
          phone: '',
          email: '',
          notes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          patient_count: 0
        };
        updatedSchools.push(newSchool);
        schoolMap.set(schoolName, newSchool.id);
      }
    }

    return {
      ...patient,
      schoolId: schoolMap.get(schoolName),
      // Keep old school field for backward compatibility during migration
    };
  });

  // Update patient counts
  updatedSchools.forEach(school => {
    school.patient_count = updatedPatients.filter(p => p.schoolId === school.id && !p.deleted_at).length;
  });

  return {
    ...data,
    schools: updatedSchools,
    patients: updatedPatients
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

    // Migrate data if needed
    if (data.version !== STORAGE_VERSION) {
      // Handle migration from 1.0 to 1.1 - add soft delete fields if missing
      if (data.version === '1.0') {
        // No specific migration needed - soft delete fields will be added when items are updated
        data.version = STORAGE_VERSION;
        saveToStorage(data);
      }
      // Handle migration from 1.1 to 1.2 - add schools array
      else if (data.version === '1.1') {
        data.schools = [];
        data.version = STORAGE_VERSION;
        saveToStorage(data);
      }
      // Handle migration from 1.2 to 1.3 - expand school schema and migrate patient school assignments
      else if (data.version === '1.2') {
        data = migratePatientsToSchoolIds(data);
        data.version = STORAGE_VERSION;
        saveToStorage(data);
      }
    }

    // Run periodic cleanup of expired items (simulates background job)
    const purged = store.purgeExpiredItems(data);
    if (purged !== data) {
      saveToStorage(purged);
    }

    return purged;
  },

  // Patient operations
  getPatients: (data) => data.patients.filter(p => !p.deleted_at),

  // School operations
  getSchools: (data) => data.schools.filter(s => !s.deleted_at),

  getSchoolById: (data, schoolId) => {
    const school = data.schools.find(s => s.id === schoolId);
    return school && !school.deleted_at ? school : null;
  },

  getPatientsForSchool: (data, schoolId) => {
    return data.patients.filter(patient =>
      patient.schoolId === schoolId && !patient.deleted_at
    );
  },

  getPatientCountForSchool: (data, schoolId) => {
    return data.patients.filter(patient =>
      patient.schoolId === schoolId && !patient.deleted_at
    ).length;
  },

  createSchool: (data, schoolData) => {
    const validationErrors = validateSchoolData(schoolData);
    if (validationErrors.length > 0) {
      throw new Error(`VALIDATION_ERROR:${validationErrors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const newSchool = {
      id: generateId(),
      name: schoolData.name.trim(),
      street_address: schoolData.street_address.trim(),
      city: schoolData.city.trim(),
      state: schoolData.state,
      zip_code: schoolData.zip_code,
      point_of_contact: schoolData.point_of_contact.trim(),
      phone: schoolData.phone.trim(),
      email: schoolData.email?.trim() || '',
      notes: schoolData.notes?.trim() || '',
      created_at: now,
      updated_at: now,
      patient_count: 0
    };

    const newData = {
      ...data,
      schools: [...data.schools, newSchool]
    };

    saveToStorage(newData);
    return newData;
  },

  updateSchool: (data, schoolId, updates) => {
    const schoolIndex = data.schools.findIndex(school => school.id === schoolId);
    if (schoolIndex === -1) {
      throw new Error('School not found');
    }

    const existingSchool = data.schools[schoolIndex];
    const updatedSchoolData = { ...existingSchool, ...updates };

    const validationErrors = validateSchoolData(updatedSchoolData);
    if (validationErrors.length > 0) {
      throw new Error(`VALIDATION_ERROR:${validationErrors.join(', ')}`);
    }

    const updatedSchool = {
      ...updatedSchoolData,
      updated_at: new Date().toISOString()
    };

    const newSchools = [...data.schools];
    newSchools[schoolIndex] = updatedSchool;

    const newData = {
      ...data,
      schools: newSchools
    };

    saveToStorage(newData);
    return newData;
  },

  softDeleteSchool: (data, schoolId) => {
    const school = data.schools.find(s => s.id === schoolId);
    if (!school) {
      throw new Error('School not found');
    }

    const patientCount = data.patients.filter(p =>
      p.schoolId === schoolId && !p.deleted_at
    ).length;

    if (patientCount > 0) {
      throw new Error(`CANNOT_DELETE:${patientCount}`);
    }

    const now = new Date().toISOString();
    const permanentlyDeletedAt = getPermanentlyDeletedAt(now);

    const newSchools = data.schools.map(s =>
      s.id === schoolId
        ? { ...s, deleted_at: now, permanently_deleted_at: permanentlyDeletedAt }
        : s
    );

    const newData = {
      ...data,
      schools: newSchools
    };

    saveToStorage(newData);
    return newData;
  },

  restoreSchool: (data, schoolId) => {
    const newSchools = data.schools.map(s =>
      s.id === schoolId
        ? { ...s, deleted_at: null, permanently_deleted_at: null }
        : s
    );

    const newData = {
      ...data,
      schools: newSchools
    };

    saveToStorage(newData);
    return newData;
  },

  permanentlyDeleteSchool: (data, schoolId) => {
    const newSchools = data.schools.filter(s => s.id !== schoolId);

    const newData = {
      ...data,
      schools: newSchools
    };

    saveToStorage(newData);
    return newData;
  },

  getDeletedSchoolById: (data, schoolId) => {
    const school = data.schools.find(s => s.id === schoolId);
    return school && school.deleted_at ? school : null;
  },

  getRecentlyDeletedSchools: (data) => {
    return data.schools
      .filter(s => s.deleted_at)
      .map(s => ({
        ...s,
        daysUntilPermanentDeletion: daysUntilPermanentDeletion(s.permanently_deleted_at)
      }))
      .sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
  },

  deleteSchoolSafely: (data, schoolId) => {
    // Delegate to soft delete for backward compatibility
    return store.softDeleteSchool(data, schoolId);
  },

  searchSchools: (data, query, options = {}) => {
    if (!query || query.trim().length < 2) {
      return data.schools.filter(s => !s.deleted_at);
    }

    const searchTerm = query.trim().toLowerCase();
    const { limit = 50, sortBy = 'name', sortOrder = 'asc' } = options;

    let filtered = data.schools.filter(school => {
      if (school.deleted_at) return false;
      const searchable = createSearchableString(school);
      return searchable.includes(searchTerm);
    });

    // Sort results
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'city':
          aValue = a.city.toLowerCase();
          bValue = b.city.toLowerCase();
          break;
        case 'patient_count':
          aValue = a.patient_count;
          bValue = b.patient_count;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    return filtered.slice(0, limit);
  },

  getSchoolSuggestions: (data, query, limit = 10) => {
    const queryTrimmed = query ? query.trim() : '';
    const activeSchools = data.schools.filter(s => !s.deleted_at);

    // If no query or query is very short, return top schools by assigned patients
    if (!queryTrimmed || queryTrimmed.length < 2) {
      return [...activeSchools]
        .sort((a, b) => {
          if ((a.patient_count || 0) !== (b.patient_count || 0)) {
            return (b.patient_count || 0) - (a.patient_count || 0);
          }
          return a.name.localeCompare(b.name);
        })
        .slice(0, limit);
    }

    // For longer queries, use fuzzy matching
    const matches = activeSchools
      .map(school => ({
        ...school,
        score: fuzzyMatch(queryTrimmed, school.name)
      }))
      .filter(match => match.score > 0)
      .sort((a, b) => {
        // Sort by score descending, then by assigned patients, then alphabetically
        if (a.score !== b.score) return b.score - a.score;
        if ((a.patient_count || 0) !== (b.patient_count || 0)) {
          return (b.patient_count || 0) - (a.patient_count || 0);
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);

    return matches;
  },

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

    // Handle school assignment
    let updatedData = data;
    const schoolId = patientData.schoolId || null;

    const newPatient = {
      id: generateId(),
      firstName: patientData.firstName.trim(),
      lastName: patientData.lastName.trim(),
      dob: patientData.dob,
      diagnosis: patientData.diagnosis?.trim() || '',
      guardianName: patientData.guardianName?.trim() || '',
      guardianPhone: patientData.guardianPhone?.trim() || '',
      notes: patientData.notes?.trim() || '',
      grade: patientData.grade || '',
      schoolId: schoolId,
      // Keep legacy field for backward compatibility
      school: patientData.school?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSessionDate: null,
      sessionCount: 0
    };

    // Update school patient count if school assigned
    if (schoolId) {
      updatedData = {
        ...updatedData,
        schools: updatedData.schools.map(school =>
          school.id === schoolId
            ? { ...school, patient_count: school.patient_count + 1 }
            : school
        )
      };
    }

    const newData = {
      ...updatedData,
      patients: [...updatedData.patients, newPatient]
    };

    saveToStorage(newData);
    return newData;
  },

  updatePatient: (data, patientId, updates) => {
    const patientIndex = data.patients.findIndex(p => p.id === patientId);
    if (patientIndex === -1) {
      throw new Error('Patient not found');
    }

    const existingPatient = data.patients[patientIndex];

    // Handle school changes - update patient counts
    let updatedData = data;
    const oldSchoolId = existingPatient.schoolId;
    const newSchoolId = updates.schoolId !== undefined ? updates.schoolId : oldSchoolId;

    // If school assignment changed
    if (newSchoolId !== oldSchoolId) {
      // Decrement old school's count
      if (oldSchoolId) {
        updatedData = {
          ...updatedData,
          schools: updatedData.schools.map(school =>
            school.id === oldSchoolId
              ? { ...school, patient_count: Math.max(0, school.patient_count - 1) }
              : school
          )
        };
      }

      // Increment new school's count
      if (newSchoolId) {
        updatedData = {
          ...updatedData,
          schools: updatedData.schools.map(school =>
            school.id === newSchoolId
              ? { ...school, patient_count: school.patient_count + 1 }
              : school
          )
        };
      }
    }

    const updatedPatient = {
      ...existingPatient,
      ...updates,
      schoolId: newSchoolId,
      updatedAt: new Date().toISOString()
    };

    const newPatients = [...updatedData.patients];
    newPatients[patientIndex] = updatedPatient;

    const newData = {
      ...updatedData,
      patients: newPatients
    };

    saveToStorage(newData);
    return newData;
  },

  softDeletePatient: (data, patientId) => {
    const patient = data.patients.find(p => p.id === patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

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

    // Update school patient count
    const newSchools = patient.schoolId ? (data.schools || []).map(school =>
      school.id === patient.schoolId
        ? { ...school, patient_count: Math.max(0, school.patient_count - 1) }
        : school
    ) : (data.schools || []);

    const newData = {
      ...data,
      patients: newPatients,
      sessions: newSessions,
      schools: newSchools
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
      therExMinutes: sessionData.therExMinutes || 0,
      therActMinutes: sessionData.therActMinutes || 0,
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

    // Refresh the cache for every affected patient (date edits change
    // lastSessionDate even when the patient stays the same)
    const affectedPatientIds = new Set([existingSession.patientId, updatedSession.patientId]);
    const newPatients = data.patients.map(patient =>
      affectedPatientIds.has(patient.id) ? updatePatientCache(patient, newSessions) : patient
    );

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

    // Update school patient count
    const restoredPatient = finalPatients.find(p => p.id === patientId);
    const newSchools = restoredPatient?.schoolId ? (data.schools || []).map(school =>
      school.id === restoredPatient.schoolId
        ? { ...school, patient_count: school.patient_count + 1 }
        : school
    ) : (data.schools || []);

    const newData = {
      ...data,
      patients: finalPatients,
      sessions: newSessions,
      schools: newSchools
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
    const patient = data.patients.find(p => p.id === patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    const newPatients = data.patients.filter(p => p.id !== patientId);
    const newSessions = data.sessions.filter(s => s.patientId !== patientId);

    // Soft delete already decremented the school count; only decrement here
    // when permanently deleting a patient that was still active.
    const shouldDecrement = patient.schoolId && !patient.deleted_at;
    const newSchools = shouldDecrement ? (data.schools || []).map(school =>
      school.id === patient.schoolId
        ? { ...school, patient_count: Math.max(0, school.patient_count - 1) }
        : school
    ) : (data.schools || []);

    const newData = {
      ...data,
      patients: newPatients,
      sessions: newSessions,
      schools: newSchools
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

    const remainingPatientIds = new Set(newPatients.map(p => p.id));
    const newSessions = data.sessions.filter(s => {
      if (s.permanently_deleted_at && new Date(s.permanently_deleted_at) <= now) {
        hasChanges = true;
        return false;
      }
      // Drop sessions orphaned by a purged/removed patient
      if (!remainingPatientIds.has(s.patientId)) {
        hasChanges = true;
        return false;
      }
      return true;
    });

    const newSchools = data.schools.filter(s => {
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
        sessions: newSessions,
        schools: newSchools
      };
    }

    return data;
  },

  // Utility functions
  clearAllData: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  exportData: (data) => {
    return JSON.stringify({
      version: data.version || STORAGE_VERSION,
      patients: data.patients || [],
      sessions: data.sessions || [],
      schools: data.schools || []
    }, null, 2);
  },

  // School utility functions
  formatPhoneNumber: (phone) => formatPhoneNumber(phone),

  createGoogleMapsUrl: (school) => createGoogleMapsUrl(school),

  validateSchoolData: (schoolData) => validateSchoolData(schoolData)
};
