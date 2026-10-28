import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from '../data/supabaseClient';
import { clearLocalCache } from '../data/syncLogic';

const AuthContext = createContext();

// Holds the Supabase session. supabase-js keeps it in localStorage and
// refreshes it, so she signs in once per device.
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

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
