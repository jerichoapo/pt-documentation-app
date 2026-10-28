// Reads and writes the signed-in user's one `app_data` row. Every function
// throws on a network or HTTP failure; callers decide what the user sees.
import { getSupabase } from './supabaseClient';

const TABLE = 'app_data';

// The columns to write. An undefined profile leaves the cloud profile as it
// is (the device's copy couldn't be read); null or missing writes {}.
const changes = (data, profile) => (profile === undefined ? { data } : { data, profile: profile || {} });

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const fetchRow = async (userId) => {
  const row = check(await getSupabase()
    .from(TABLE)
    .select('data, profile, updated_at')
    .eq('user_id', userId)
    .maybeSingle());
  return row || null;
};

// Only the row's updated_at, so a check that finds nothing new downloads
// almost nothing. Null when there is no row.
export const fetchRowVersion = async (userId) => {
  const row = check(await getSupabase()
    .from(TABLE)
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle());
  return row ? row.updated_at : null;
};

export const insertRow = async (userId, data, profile) => {
  const row = check(await getSupabase()
    .from(TABLE)
    .insert({ user_id: userId, data, profile: profile || {} })
    .select('updated_at')
    .single());
  return row.updated_at;
};

// Writes only if the row is still the version this device last saw. Returns
// the new updated_at, or null when another device wrote first.
export const updateRow = async (userId, data, profile, expectedUpdatedAt) => {
  const rows = check(await getSupabase()
    .from(TABLE)
    .update(changes(data, profile))
    .eq('user_id', userId)
    .eq('updated_at', expectedUpdatedAt)
    .select('updated_at'));
  return rows.length ? rows[0].updated_at : null;
};

// Unconditional write, for "replace the cloud data with this device's".
export const replaceRow = async (userId, data, profile) => {
  const rows = check(await getSupabase()
    .from(TABLE)
    .update(changes(data, profile))
    .eq('user_id', userId)
    .select('updated_at'));
  if (!rows.length) throw new Error('ROW_MISSING');
  return rows[0].updated_at;
};

// Calls onSignal(updatedAt) whenever the row changes, and onSubscribed() each
// time the channel connects or reconnects (changes made while it was down
// are never replayed). Returns an unsubscribe.
export const subscribeToRow = (userId, onSignal, onSubscribed = () => {}) => {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`app_data:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => onSignal(payload.new?.updated_at || null)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onSubscribed();
    });
  return () => {
    supabase.removeChannel(channel);
  };
};
