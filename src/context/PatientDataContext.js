import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { store } from '../data/store';
import { useToastContext } from './ToastContext';

// Action types
const ACTIONS = {
  LOAD_DATA: 'LOAD_DATA',
  ADD_PATIENT: 'ADD_PATIENT',
  UPDATE_PATIENT: 'UPDATE_PATIENT',
  DELETE_PATIENT: 'DELETE_PATIENT',
  ADD_SESSION: 'ADD_SESSION',
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

    // Actions
    addPatient,
    updatePatient,
    deletePatient,
    addSession,
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
  return patients;
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
