import { createClient } from '@supabase/supabase-js';

// Created on first use so importing this module never needs the env vars
// (tests import screens that import it).
let client = null;

export const getSupabase = () => {
  if (!client) {
    client = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY
    );
  }
  return client;
};
