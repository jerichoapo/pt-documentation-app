import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { getSupabase } from '../data/supabaseClient';
import { clearLocalCache } from '../data/syncLogic';

const AuthContext = createContext();

// Holds the Supabase session. supabase-js keeps it in localStorage and
// refreshes it, so she signs in once per device.
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // True when the stored session needs refreshing and the network is down.
  // The session stays stored, so she isn't signed out; the app resumes once
  // the refresh goes through.
  const [isOffline, setIsOffline] = useState(false);
  const activeRef = useRef(true);

  const restoreSession = useCallback(async () => {
    const { data, error } = await getSupabase().auth.getSession();
    if (!activeRef.current) return false;
    setIsOffline(Boolean(error) && isAuthRetryableFetchError(error));
    setSession(data.session);
    setIsLoading(false);
    return Boolean(data.session);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    restoreSession();
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, next) => {
      if (!activeRef.current) return;
      setSession(next);
      if (next) setIsOffline(false);
    });
    return () => {
      activeRef.current = false;
      subscription.unsubscribe();
    };
  }, [restoreSession]);

  // After a refresh fails offline, supabase-js can stay stuck on it even once
  // the network is back. Try once more; if that doesn't bring the session back
  // within 5 seconds, reload the page, which starts a fresh client with the
  // stored session.
  const retry = useCallback(async () => {
    let timer;
    const timedOut = new Promise((resolve) => {
      timer = setTimeout(() => resolve('timeout'), 5000);
    });
    const outcome = await Promise.race([restoreSession(), timedOut]);
    clearTimeout(timer);
    if (outcome !== true) window.location.reload();
  }, [restoreSession]);

  useEffect(() => {
    if (!isOffline) return undefined;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [isOffline, retry]);

  const signIn = async (email, password) => {
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  // Ends this device's session only, then removes the cached patient data.
  // If the server can't be reached the session stays, and so does the cache.
  const signOut = async () => {
    try {
      const { error } = await getSupabase().auth.signOut({ scope: 'local' });
      if (error) return { error };
    } catch (error) {
      return { error };
    }
    clearLocalCache();
    return { error: null };
  };

  const value = {
    user: session?.user || null,
    isLoading,
    isOffline,
    retry,
    signIn,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
