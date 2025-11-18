import React, { createContext, useContext, useReducer, useEffect } from 'react';
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
        isLoading: false,
        error: null
      };

    case ACTIONS.ADD_PATIENT:
      return {
        ...state,
        patients: action.payload.patients,
        error: null
      };

    case ACTIONS.UPDATE_PATIENT:
      return {
        ...state,
        patients: action.payload.patients,
        error: null
      };

    case ACTIONS.DELETE_PATIENT:
    case ACTIONS.SOFT_DELETE_PATIENT:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
        error: null
      };

    case ACTIONS.RESTORE_PATIENT:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
        error: null
      };

    case ACTIONS.PERMANENTLY_DELETE_PATIENT:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
        error: null
      };

    case ACTIONS.ADD_SESSION:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
        error: null
      };

    case ACTIONS.UPDATE_SESSION:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
        error: null
      };

    case ACTIONS.DELETE_SESSION:
    case ACTIONS.SOFT_DELETE_SESSION:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
        error: null
      };

    case ACTIONS.RESTORE_SESSION:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
        error: null
      };

    case ACTIONS.PERMANENTLY_DELETE_SESSION:
      return {
        ...state,
        patients: action.payload.patients,
        sessions: action.payload.sessions,
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
      return state;
  }
};

// Initial state
const initialState = {
  patients: [],
  sessions: [],
  isLoading: true,
  error: null
};

// Context
const PatientDataContext = createContext();

// Provider component
export const PatientDataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(patientDataReducer, initialState);
  const { addToast } = useToastContext();

  // Load data on mount
  useEffect(() => {
    try {
      const data = store.init();
      dispatch({
        type: ACTIONS.LOAD_DATA,
        payload: {
          patients: data.patients,
          sessions: data.sessions
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
  const addPatient = async (patientData, options = {}) => {
    try {
      const newData = store.addPatient({
        patients: state.patients,
        sessions: state.sessions
      }, patientData, options);

      dispatch({
        type: ACTIONS.ADD_PATIENT,
        payload: { patients: newData.patients }
      });

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
      const newData = store.updatePatient({
        patients: state.patients,
        sessions: state.sessions
      }, patientId, updates);

      dispatch({
        type: ACTIONS.UPDATE_PATIENT,
        payload: { patients: newData.patients }
      });
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
      const newData = store.deletePatient({
        patients: state.patients,
        sessions: state.sessions
      }, patientId);

      dispatch({
        type: ACTIONS.DELETE_PATIENT,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });
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
      const newData = store.addSession({
        patients: state.patients,
        sessions: state.sessions
      }, sessionData);

      dispatch({
        type: ACTIONS.ADD_SESSION,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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
      const newData = store.updateSession({
        patients: state.patients,
        sessions: state.sessions
      }, sessionId, updates);

      dispatch({
        type: ACTIONS.UPDATE_SESSION,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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
      const sessionToDelete = state.sessions.find(s => s.id === sessionId);
      if (!sessionToDelete) {
        throw new Error('Session not found');
      }

      const newData = store.deleteSession({
        patients: state.patients,
        sessions: state.sessions
      }, sessionId);

      dispatch({
        type: ACTIONS.DELETE_SESSION,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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
      const patientToDelete = state.patients.find(p => p.id === patientId);
      if (!patientToDelete) {
        throw new Error('Patient not found');
      }

      const sessionCount = store.getSessionsForPatient({
        patients: state.patients,
        sessions: state.sessions
      }, patientId).length;

      const newData = store.softDeletePatient({
        patients: state.patients,
        sessions: state.sessions
      }, patientId);

      dispatch({
        type: ACTIONS.SOFT_DELETE_PATIENT,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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
      const sessionToDelete = state.sessions.find(s => s.id === sessionId);
      if (!sessionToDelete) {
        throw new Error('Session not found');
      }

      const newData = store.softDeleteSession({
        patients: state.patients,
        sessions: state.sessions
      }, sessionId);

      dispatch({
        type: ACTIONS.SOFT_DELETE_SESSION,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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
      const patientToRestore = state.patients.find(p => p.id === patientId && p.deleted_at);
      if (!patientToRestore) {
        throw new Error('Patient not found or not deleted');
      }

      const cascadeSessions = state.sessions.filter(s => s.deleted_with_patient_id === patientId).length;

      const newData = store.restorePatient({
        patients: state.patients,
        sessions: state.sessions
      }, patientId);

      dispatch({
        type: ACTIONS.RESTORE_PATIENT,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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
      const sessionToRestore = state.sessions.find(s => s.id === sessionId && s.deleted_at);
      if (!sessionToRestore) {
        throw new Error('Session not found or not deleted');
      }

      const newData = store.restoreSession({
        patients: state.patients,
        sessions: state.sessions
      }, sessionId);

      dispatch({
        type: ACTIONS.RESTORE_SESSION,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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
      const patientToDelete = state.patients.find(p => p.id === patientId && p.deleted_at);
      if (!patientToDelete) {
        throw new Error('Patient not found or not deleted');
      }

      const newData = store.permanentlyDeletePatient({
        patients: state.patients,
        sessions: state.sessions
      }, patientId);

      dispatch({
        type: ACTIONS.PERMANENTLY_DELETE_PATIENT,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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
      const sessionToDelete = state.sessions.find(s => s.id === sessionId && s.deleted_at);
      if (!sessionToDelete) {
        throw new Error('Session not found or not deleted');
      }

      const newData = store.permanentlyDeleteSession({
        patients: state.patients,
        sessions: state.sessions
      }, sessionId);

      dispatch({
        type: ACTIONS.PERMANENTLY_DELETE_SESSION,
        payload: {
          patients: newData.patients,
          sessions: newData.sessions
        }
      });

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

  const clearError = () => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  };

  const clearAllData = () => {
    store.clearAllData();
    dispatch({
      type: ACTIONS.LOAD_DATA,
      payload: { patients: [], sessions: [] }
    });
  };

  const exportData = () => {
    return store.exportData({
      patients: state.patients,
      sessions: state.sessions
    });
  };

  // Context value
  const value = {
    // State
    patients: state.patients,
    sessions: state.sessions,
    isLoading: state.isLoading,
    error: state.error,

    // Computed helpers
    getPatientById: (id) => store.getPatientById({
      patients: state.patients,
      sessions: state.sessions
    }, id),

    getSessionsForPatient: (patientId) => store.getSessionsForPatient({
      patients: state.patients,
      sessions: state.sessions
    }, patientId),

    getSessionById: (id) => store.getSessionById({
      patients: state.patients,
      sessions: state.sessions
    }, id),

    getDeletedPatientById: (id) => store.getDeletedPatientById({
      patients: state.patients,
      sessions: state.sessions
    }, id),

    getDeletedSessionById: (id) => store.getDeletedSessionById({
      patients: state.patients,
      sessions: state.sessions
    }, id),

    getRecentlyDeletedPatients: () => store.getRecentlyDeletedPatients({
      patients: state.patients,
      sessions: state.sessions
    }),

    getRecentlyDeletedSessions: () => store.getRecentlyDeletedSessions({
      patients: state.patients,
      sessions: state.sessions
    }),

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
