import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useSync } from './SyncContext';

// Action types
const ACTIONS = {
  LOAD_PROFILE: 'LOAD_PROFILE',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer
const profileReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.LOAD_PROFILE:
      return {
        ...state,
        profile: action.payload,
        isLoading: false,
        error: null
      };

    case ACTIONS.UPDATE_PROFILE:
      return {
        ...state,
        profile: action.payload,
        error: null
      };

    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
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
  profile: {
    firstName: '',
    lastName: '',
    credentials: [],
    license: ''
  },
  isLoading: true,
  error: null
};

// Context
const ProfileContext = createContext();

// Provider component
export const ProfileProvider = ({ children }) => {
  const [state, dispatch] = useReducer(profileReducer, initialState);
  const { notifyChange, revision, adoptHeldData, waitForCatchUp } = useSync();
  // True while the stored profile can't be read. The save effect then leaves
  // it alone, so blank defaults never overwrite it (and get pushed to the
  // cloud); the cloud copy keeps the real profile until she saves a new one.
  const loadFailedRef = useRef(false);

  // Load profile from localStorage on mount, and again whenever the cloud sync
  // replaces the cache. Defaults fill any field the stored profile lacks.
  useEffect(() => {
    try {
      loadFailedRef.current = false;
      const storedProfile = localStorage.getItem('pt-app-profile');
      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        dispatch({
          type: ACTIONS.LOAD_PROFILE,
          payload: { ...initialState.profile, ...parsedProfile }
        });
      } else {
        dispatch({
          type: ACTIONS.LOAD_PROFILE,
          payload: initialState.profile
        });
      }
    } catch (error) {
      loadFailedRef.current = true;
      console.error('Failed to load profile from localStorage:', error);
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: 'Failed to load profile data'
      });
    }
  }, [revision]);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    if (!state.isLoading && !loadFailedRef.current) {
      try {
        localStorage.setItem('pt-app-profile', JSON.stringify(state.profile));
      } catch (error) {
        console.error('Failed to save profile to localStorage:', error);
        dispatch({
          type: ACTIONS.SET_ERROR,
          payload: 'Failed to save profile data'
        });
      }
    }
  }, [state.profile, state.isLoading]);

  // Action creators
  const updateProfile = async (updates) => {
    try {
      // Let a running cloud check finish and take any change held from the
      // other device first, so this save's push matches the cloud
      const pending = waitForCatchUp();
      if (pending) await pending;
      adoptHeldData();
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const updatedProfile = {
        ...state.profile,
        ...updates
      };

      dispatch({
        type: ACTIONS.UPDATE_PROFILE,
        payload: updatedProfile
      });
      // Written now rather than by the effect, so the push that follows sends it
      localStorage.setItem('pt-app-profile', JSON.stringify(updatedProfile));
      loadFailedRef.current = false;
      notifyChange();

      return updatedProfile;
    } catch (error) {
      dispatch({
        type: ACTIONS.SET_ERROR,
        payload: 'Failed to update profile'
      });
      throw error;
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    }
  };

  const clearError = () => {
    dispatch({ type: ACTIONS.CLEAR_ERROR });
  };

  // Context value
  const value = {
    // State
    profile: state.profile,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    updateProfile,
    clearError
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

// Custom hook to use the context
export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
