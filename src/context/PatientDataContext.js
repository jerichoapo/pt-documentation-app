import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { store } from '../data/store';
import { useToastContext } from './ToastContext';

// Action types
const ACTIONS = {
  LOAD_DATA: 'LOAD_DATA',
  ADD_PATIENT: 'ADD_PATIENT',
  UPDATE_PATIENT: 'UPDATE_PATIENT',
  DELETE_PATIENT: 'DELETE_PATIENT',
  SOFT_DELETE_PATIENT: 'SOFT_DELETE_PATIENT',
  RESTORE_PATIENT: 'RESTORE_PATIENT',
  PERMANENTLY_DELETE_PATIENT: 'PERMANENTLY_DELETE_PATIENT',
  ADD_SESSION: 'ADD_SESSION',
  UPDATE_SESSION: 'UPDATE_SESSION',
  DELETE_SESSION: 'DELETE_SESSION',
  SOFT_DELETE_SESSION: 'SOFT_DELETE_SESSION',
  RESTORE_SESSION: 'RESTORE_SESSION',
  PERMANENTLY_DELETE_SESSION: 'PERMANENTLY_DELETE_SESSION',
  CREATE_SCHOOL: 'CREATE_SCHOOL',
  UPDATE_SCHOOL: 'UPDATE_SCHOOL',
  DELETE_SCHOOL: 'DELETE_SCHOOL',
  SOFT_DELETE_SCHOOL: 'SOFT_DELETE_SCHOOL',
  RESTORE_SCHOOL: 'RESTORE_SCHOOL',
  PERMANENTLY_DELETE_SCHOOL: 'PERMANENTLY_DELETE_SCHOOL',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer
const patientDataReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.LOAD_DATA:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
        schools: action.payload.schools,
        isLoading: false,
        error: null
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };

    case ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      // Every data-mutation action carries the updated data object from the
      // store. Merge whatever slices are present so a payload can never wipe
      // a slice it didn't touch.
      if (action.payload && Object.values(ACTIONS).includes(action.type)) {
        return {
          ...state,
          patients: action.payload.patients ?? state.patients,
          sessions: action.payload.sessions ?? state.sessions,
          schools: action.payload.schools ?? state.schools,
          error: null
        };
      }
      return state;
  }
};

// Initial state
const initialState = {
  patients: [],
  sessions: [],
  schools: [],
  isLoading: true,
  error: null
};

// Context
const PatientDataContext = createContext();

// Provider component
export const PatientDataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(patientDataReducer, initialState);
  const { addToast } = useToastContext();

  // Latest data, updated synchronously on every mutation. React state updates
  // are async, so sequential awaited actions (e.g. bulk restore loops) must
  // not read from the render closure or later writes clobber earlier ones.
  const dataRef = useRef({ patients: [], sessions: [], schools: [] });

  // Load data on mount
  useEffect(() => {
    try {
      const data = store.init();
      dataRef.current = {
        patients: data.patients,
        sessions: data.sessions,
        schools: data.schools
      };
      dispatch({
        type: ACTIONS.LOAD_DATA,
        payload: {
          patients: data.patients,
          sessions: data.sessions,
          schools: data.schools
        }
      });
    } catch (error) {
      if (error.message === 'STORAGE_CORRUPTED') {
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: {
            type: 'CORRUPTION',
            message: 'Data corruption detected. You can export the raw data for recovery or start fresh.',
            corruptData: error.corruptData
          }
        });
      } else {
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'LOAD_ERROR', message: 'Failed to load data' }
        });
      }
    }
  }, []);

  // Action creators

  // Always hand the store the complete, freshest data object so persistence
  // never sees a partial or stale shape.
  const getFullData = () => ({
    patients: dataRef.current.patients,
    sessions: dataRef.current.sessions,
    schools: dataRef.current.schools
  });

  // Record a mutation result synchronously, then update React state
  const applyData = (type, newData) => {
    dataRef.current = {
      patients: newData.patients ?? dataRef.current.patients,
      sessions: newData.sessions ?? dataRef.current.sessions,
      schools: newData.schools ?? dataRef.current.schools
    };
    dispatch({ type, payload: newData });
  };

  const addPatient = async (patientData, options = {}) => {
    try {
      const newData = store.addPatient(getFullData(), patientData, options);

      applyData(ACTIONS.ADD_PATIENT, newData);

      return newData.patients[newData.patients.length - 1];
    } catch (error) {
      if (error.message === 'STORAGE_QUOTA_EXCEEDED') {
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'QUOTA_EXCEEDED', message: 'Storage limit reached. Please export and archive old sessions.' }
        });
      } else if (error.message.startsWith('DUPLICATE_PATIENT:')) {
        // Re-throw duplicate errors so the form can handle them
        throw error;
      } else {
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'SAVE_ERROR', message: 'Failed to save patient' }
        });
      }
      throw error;
    }
  };

  const updatePatient = async (patientId, updates) => {
    try {
      const newData = store.updatePatient(getFullData(), patientId, updates);

      applyData(ACTIONS.UPDATE_PATIENT, newData);
    } catch (error) {
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to update patient' }
      });
      throw error;
    }
  };

  const deletePatient = async (patientId) => {
    try {
      const newData = store.deletePatient(getFullData(), patientId);

      applyData(ACTIONS.DELETE_PATIENT, newData);
    } catch (error) {
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to delete patient' }
      });
      throw error;
    }
  };

  const addSession = async (sessionData) => {
    try {
      const newData = store.addSession(getFullData(), sessionData);

      applyData(ACTIONS.ADD_SESSION, newData);

      // Show success toast
      const patient = newData.patients.find(p => p.id === sessionData.patientId);
      if (patient) {
        addToast(`Session saved for ${patient.firstName} ${patient.lastName}`, 'success');
      }

      return newData.sessions[newData.sessions.length - 1];
    } catch (error) {
      if (error.message === 'STORAGE_QUOTA_EXCEEDED') {
        addToast('Storage limit reached. Please export and archive old sessions.', 'error');
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'QUOTA_EXCEEDED', message: 'Storage limit reached. Please export and archive old sessions.' }
        });
      } else {
        addToast('Failed to save session', 'error');
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'SAVE_ERROR', message: 'Failed to save session' }
        });
      }
      throw error;
    }
  };

  const updateSession = async (sessionId, updates) => {
    try {
      const newData = store.updateSession(getFullData(), sessionId, updates);

      applyData(ACTIONS.UPDATE_SESSION, newData);

      // Show success toast
      addToast('Session updated successfully', 'success');

      return newData.sessions.find(s => s.id === sessionId);
    } catch (error) {
      if (error.message === 'STORAGE_QUOTA_EXCEEDED') {
        addToast('Storage limit reached. Please export and archive old sessions.', 'error');
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'QUOTA_EXCEEDED', message: 'Storage limit reached. Please export and archive old sessions.' }
        });
      } else {
        addToast('Failed to update session', 'error');
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'SAVE_ERROR', message: 'Failed to update session' }
        });
      }
      throw error;
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      const sessionToDelete = getFullData().sessions.find(s => s.id === sessionId);
      if (!sessionToDelete) {
        throw new Error('Session not found');
      }

      const newData = store.deleteSession(getFullData(), sessionId);

      applyData(ACTIONS.DELETE_SESSION, newData);

      // Show success toast
      addToast('Session deleted successfully', 'success');

      return sessionToDelete;
    } catch (error) {
      addToast('Failed to delete session', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to delete session' }
      });
      throw error;
    }
  };

  const softDeletePatient = async (patientId) => {
    try {
      const patientToDelete = getFullData().patients.find(p => p.id === patientId);
      if (!patientToDelete) {
        throw new Error('Patient not found');
      }

      const sessionCount = store.getSessionsForPatient(getFullData(), patientId).length;

      const newData = store.softDeletePatient(getFullData(), patientId);

      applyData(ACTIONS.SOFT_DELETE_PATIENT, newData);

      // Show success toast
      const message = sessionCount > 0
        ? `Patient and ${sessionCount} notes moved to Recently Deleted`
        : 'Patient moved to Recently Deleted';
      addToast(message, 'success');

      return patientToDelete;
    } catch (error) {
      addToast('Failed to delete patient', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to delete patient' }
      });
      throw error;
    }
  };

  const softDeleteSession = async (sessionId) => {
    try {
      const sessionToDelete = getFullData().sessions.find(s => s.id === sessionId);
      if (!sessionToDelete) {
        throw new Error('Session not found');
      }

      const newData = store.softDeleteSession(getFullData(), sessionId);

      applyData(ACTIONS.SOFT_DELETE_SESSION, newData);

      // Show success toast
      addToast('Note moved to Recently Deleted', 'success');

      return sessionToDelete;
    } catch (error) {
      addToast('Failed to delete note', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to delete note' }
      });
      throw error;
    }
  };

  const restorePatient = async (patientId) => {
    try {
      const currentData = getFullData();
      const patientToRestore = currentData.patients.find(p => p.id === patientId && p.deleted_at);
      if (!patientToRestore) {
        throw new Error('Patient not found or not deleted');
      }

      const cascadeSessions = currentData.sessions.filter(s => s.deleted_with_patient_id === patientId).length;

      const newData = store.restorePatient(getFullData(), patientId);

      applyData(ACTIONS.RESTORE_PATIENT, newData);

      // Show success toast
      const message = cascadeSessions > 0
        ? `Patient and ${cascadeSessions} notes restored successfully`
        : 'Patient restored successfully';
      addToast(message, 'success');

      return patientToRestore;
    } catch (error) {
      addToast('Failed to restore patient', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to restore patient' }
      });
      throw error;
    }
  };

  const restoreSession = async (sessionId, options = {}) => {
    try {
      const sessionToRestore = getFullData().sessions.find(s => s.id === sessionId && s.deleted_at);
      if (!sessionToRestore) {
        throw new Error('Session not found or not deleted');
      }

      const newData = store.restoreSession(getFullData(), sessionId);

      applyData(ACTIONS.RESTORE_SESSION, newData);

      // Show success toast (unless skipped)
      if (!options.skipToast) {
        const toastMessage = options.toastMessage || 'Note restored successfully';
        addToast(toastMessage, 'success');
      }

      return sessionToRestore;
    } catch (error) {
      addToast('Failed to restore note', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to restore note' }
      });
      throw error;
    }
  };

  const permanentlyDeletePatient = async (patientId) => {
    try {
      const patientToDelete = getFullData().patients.find(p => p.id === patientId && p.deleted_at);
      if (!patientToDelete) {
        throw new Error('Patient not found or not deleted');
      }

      const newData = store.permanentlyDeletePatient(getFullData(), patientId);

      applyData(ACTIONS.PERMANENTLY_DELETE_PATIENT, newData);

      // Show success toast
      addToast('Patient permanently deleted', 'success');

      return patientToDelete;
    } catch (error) {
      addToast('Failed to permanently delete patient', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to permanently delete patient' }
      });
      throw error;
    }
  };

  const permanentlyDeleteSession = async (sessionId) => {
    try {
      const sessionToDelete = getFullData().sessions.find(s => s.id === sessionId && s.deleted_at);
      if (!sessionToDelete) {
        throw new Error('Session not found or not deleted');
      }

      const newData = store.permanentlyDeleteSession(getFullData(), sessionId);

      applyData(ACTIONS.PERMANENTLY_DELETE_SESSION, newData);

      // Show success toast
      addToast('Note permanently deleted', 'success');

      return sessionToDelete;
    } catch (error) {
      addToast('Failed to permanently delete note', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to permanently delete note' }
      });
      throw error;
    }
  };

  const createSchool = async (schoolData) => {
    try {
      const newData = store.createSchool(getFullData(), schoolData);

      applyData(ACTIONS.CREATE_SCHOOL, newData);

      // Show success toast
      addToast('School created successfully', 'success');

      return newData.schools[newData.schools.length - 1];
    } catch (error) {
      if (error.message.startsWith('VALIDATION_ERROR:')) {
        const validationMessage = error.message.replace('VALIDATION_ERROR:', '');
        addToast(`Validation failed: ${validationMessage}`, 'error');
      } else {
        addToast('Failed to create school', 'error');
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'SAVE_ERROR', message: 'Failed to create school' }
        });
      }
      throw error;
    }
  };

  const updateSchool = async (schoolId, updates) => {
    try {
      const newData = store.updateSchool(getFullData(), schoolId, updates);

      applyData(ACTIONS.UPDATE_SCHOOL, newData);

      // Show success toast
      addToast('School updated successfully', 'success');

      return newData.schools.find(s => s.id === schoolId);
    } catch (error) {
      if (error.message.startsWith('VALIDATION_ERROR:')) {
        const validationMessage = error.message.replace('VALIDATION_ERROR:', '');
        addToast(`Validation failed: ${validationMessage}`, 'error');
      } else {
        addToast('Failed to update school', 'error');
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'SAVE_ERROR', message: 'Failed to update school' }
        });
      }
      throw error;
    }
  };

  const deleteSchool = async (schoolId) => {
    try {
      const schoolToDelete = getFullData().schools.find(s => s.id === schoolId);
      if (!schoolToDelete) {
        throw new Error('School not found');
      }

      const newData = store.deleteSchoolSafely(getFullData(), schoolId);

      applyData(ACTIONS.DELETE_SCHOOL, newData);

      // Show success toast
      addToast('School moved to Recently Deleted', 'success');

      return schoolToDelete;
    } catch (error) {
      if (error.message.startsWith('CANNOT_DELETE:')) {
        const patientCount = error.message.replace('CANNOT_DELETE:', '');
        addToast(`Cannot delete school with ${patientCount} assigned patients. Please reassign patients first.`, 'error');
      } else {
        addToast('Failed to delete school', 'error');
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'SAVE_ERROR', message: 'Failed to delete school' }
        });
      }
      throw error;
    }
  };

  const softDeleteSchool = async (schoolId) => {
    try {
      const schoolToDelete = getFullData().schools.find(s => s.id === schoolId);
      if (!schoolToDelete) {
        throw new Error('School not found');
      }

      const newData = store.softDeleteSchool(getFullData(), schoolId);

      applyData(ACTIONS.SOFT_DELETE_SCHOOL, newData);

      // Show success toast
      addToast('School moved to Recently Deleted', 'success');

      return schoolToDelete;
    } catch (error) {
      if (error.message.startsWith('CANNOT_DELETE:')) {
        const patientCount = error.message.replace('CANNOT_DELETE:', '');
        addToast(`Cannot delete school with ${patientCount} assigned patients. Please reassign patients first.`, 'error');
      } else {
        addToast('Failed to delete school', 'error');
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: { type: 'SAVE_ERROR', message: 'Failed to delete school' }
        });
      }
      throw error;
    }
  };

  const restoreSchool = async (schoolId) => {
    try {
      const schoolToRestore = getFullData().schools.find(s => s.id === schoolId && s.deleted_at);
      if (!schoolToRestore) {
        throw new Error('School not found or not deleted');
      }

      const newData = store.restoreSchool(getFullData(), schoolId);

      applyData(ACTIONS.RESTORE_SCHOOL, newData);

      // Show success toast
      addToast('School restored successfully', 'success');

      return schoolToRestore;
    } catch (error) {
      addToast('Failed to restore school', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to restore school' }
      });
      throw error;
    }
  };

  const permanentlyDeleteSchool = async (schoolId) => {
    try {
      const schoolToDelete = getFullData().schools.find(s => s.id === schoolId && s.deleted_at);
      if (!schoolToDelete) {
        throw new Error('School not found or not deleted');
      }

      const newData = store.permanentlyDeleteSchool(getFullData(), schoolId);

      applyData(ACTIONS.PERMANENTLY_DELETE_SCHOOL, newData);

      // Show success toast
      addToast('School permanently deleted', 'success');

      return schoolToDelete;
    } catch (error) {
      addToast('Failed to permanently delete school', 'error');
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: { type: 'SAVE_ERROR', message: 'Failed to permanently delete school' }
      });
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  };

  const getSchoolSuggestions = (query, limit = 10) => {
    return store.getSchoolSuggestions(getFullData(), query, limit);
  };

  const clearAllData = () => {
    store.clearAllData();
    dataRef.current = { patients: [], sessions: [], schools: [] };
    dispatch({
      type: ACTIONS.LOAD_DATA,
      payload: { patients: [], sessions: [], schools: [] }
    });
  };

  const exportData = () => {
    return store.exportData(getFullData());
  };

  // Context value
  const value = {
    // State
    patients: state.patients,
    sessions: state.sessions,
    schools: state.schools.filter(s => !s.deleted_at),
    isLoading: state.isLoading,
    error: state.error,

    // Computed helpers
    getPatientById: (id) => store.getPatientById(getFullData(), id),

    getSessionsForPatient: (patientId) => store.getSessionsForPatient(getFullData(), patientId),

    getSessionById: (id) => store.getSessionById(getFullData(), id),

    getDeletedPatientById: (id) => store.getDeletedPatientById(getFullData(), id),

    getDeletedSessionById: (id) => store.getDeletedSessionById(getFullData(), id),

    getRecentlyDeletedPatients: () => store.getRecentlyDeletedPatients(getFullData()),

    getRecentlyDeletedSessions: () => store.getRecentlyDeletedSessions(getFullData()),

    getDeletedSchoolById: (id) => store.getDeletedSchoolById(getFullData(), id),

    getRecentlyDeletedSchools: () => store.getRecentlyDeletedSchools(getFullData()),

    getSchoolSuggestions,

    // School helpers
    getSchoolById: (id) => store.getSchoolById(getFullData(), id),

    getPatientsForSchool: (schoolId) => store.getPatientsForSchool(getFullData(), schoolId),

    getPatientCountForSchool: (schoolId) => store.getPatientCountForSchool(getFullData(), schoolId),

    searchSchools: (query, options) => store.searchSchools(getFullData(), query, options),

    formatPhoneNumber: store.formatPhoneNumber,
    createGoogleMapsUrl: store.createGoogleMapsUrl,
    validateSchoolData: store.validateSchoolData,

    // Actions
    addPatient,
    updatePatient,
    deletePatient,
    softDeletePatient,
    restorePatient,
    permanentlyDeletePatient,
    addSession,
    updateSession,
    deleteSession,
    softDeleteSession,
    restoreSession,
    permanentlyDeleteSession,
    createSchool,
    updateSchool,
    deleteSchool,
    softDeleteSchool,
    restoreSchool,
    permanentlyDeleteSchool,
    clearError,
    clearAllData,
    exportData
  };

  return (
    <PatientDataContext.Provider value={value}>
      {children}
    </PatientDataContext.Provider>
  );
};

// Custom hook to use the context
export const usePatientData = () => {
  const context = useContext(PatientDataContext);
  if (!context) {
    throw new Error('usePatientData must be used within a PatientDataProvider');
  }
  return context;
};

// Convenience hooks
export const usePatients = () => {
  const { patients } = usePatientData();
  return patients.filter(p => !p.deleted_at);
};

export const usePatient = (patientId) => {
  const { getPatientById } = usePatientData();
  return getPatientById(patientId);
};

export const useSessionsForPatient = (patientId) => {
  const { getSessionsForPatient } = usePatientData();
  return getSessionsForPatient(patientId);
};

export const useSession = (sessionId) => {
  const { getSessionById } = usePatientData();
  return getSessionById(sessionId);
};

export const useDeletedPatient = (patientId) => {
  const { getDeletedPatientById } = usePatientData();
  return getDeletedPatientById(patientId);
};

export const useDeletedSession = (sessionId) => {
  const { getDeletedSessionById } = usePatientData();
  return getDeletedSessionById(sessionId);
};

export const useDeletedSchool = (schoolId) => {
  const { getDeletedSchoolById } = usePatientData();
  return getDeletedSchoolById(schoolId);
};
