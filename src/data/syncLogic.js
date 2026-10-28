// Pure sync helpers: what the device knows about its last sync, how to read
// the local cache, which load path to take after sign-in, and a push queue
// that coalesces changes and retries. No React and no Supabase here.

export const SYNC_META_KEY = 'ptAppSync';
const DATA_KEY = 'ptAppData';
const PROFILE_KEY = 'pt-app-profile';
const DRAFT_KEY = 'ptAppSessionDraft';

const DEFAULT_META = { lastSeen: null, dirty: false, lastSyncedAt: null };

const parse = (raw) => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

// lastSeen: the row's updated_at as of this device's last push or download.
// dirty: a local change has not been confirmed by the cloud yet.
export const readSyncMeta = () => ({ ...DEFAULT_META, ...(parse(localStorage.getItem(SYNC_META_KEY)) || {}) });

export const writeSyncMeta = (patch) => {
  const next = { ...readSyncMeta(), ...patch };
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(next));
  return next;
};

// Signing out leaves no patient data on the device, including a note draft.
// The backup timestamps stay.
export const clearLocalCache = () => {
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(SYNC_META_KEY);
  localStorage.removeItem(DRAFT_KEY);
};

// What signing out now would lose, as one sentence for the confirm dialog, or
// null when nothing would be lost.
export const unsavedWorkWarning = () => {
  const losses = [];
  if (readSyncMeta().dirty) losses.push("Some changes on this device haven't reached the cloud yet.");
  if (localStorage.getItem(DRAFT_KEY)) losses.push("The note you started on this device hasn't been saved.");
  return losses.length ? `${losses.join(' ')} If you sign out now, that work is lost.` : null;
};

export const readLocalSnapshot = () => ({
  data: parse(localStorage.getItem(DATA_KEY)),
  profile: parse(localStorage.getItem(PROFILE_KEY))
});

const active = (items) => (Array.isArray(items) ? items.filter((item) => !item.deleted_at).length : 0);

export const countData = (data) => ({
  patients: active(data?.patients),
  sessions: active(data?.sessions),
  schools: active(data?.schools)
});

export const hasLocalData = ({ data, profile }) => {
  const any = (items) => Array.isArray(items) && items.length > 0;
  if (data && (any(data.patients) || any(data.sessions) || any(data.schools))) return true;
  return Boolean(profile && (profile.firstName || profile.lastName || profile.license));
};

export const chooseLoadPath = ({ row, localHasData, dirty, lastSeen }) => {
  if (!row) return localHasData ? 'migrate' : 'create-empty';
  if (!lastSeen) return localHasData ? 'first-device' : 'apply-row';
  if (dirty) return row.updated_at === lastSeen ? 'push-cache' : 'conflict';
  return 'apply-row';
};

// Runs `push` at most once at a time. Changes within `delayMs` of each other
// share one push; a change made while a push is in flight gets one more push
// after it. A failed push retries after each of `retryDelaysMs`, then reports
// 'failed' and waits for the next change or flushNow().
export const createPushQueue = ({ push, delayMs = 500, retryDelaysMs = [1000, 2000, 4000], onStatus = () => {} }) => {
  let timer = null;
  let retryTimer = null;
  let inFlight = false;
  let again = false;
  let cancelled = false;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const attempt = async (failures) => {
    try {
      await push();
    } catch (error) {
      if (cancelled) return;
      if (failures < retryDelaysMs.length) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          attempt(failures + 1);
        }, retryDelaysMs[failures]);
        return;
      }
      inFlight = false;
      again = false;
      onStatus('failed');
      return;
    }
    if (cancelled) return;
    inFlight = false;
    if (again) {
      again = false;
      run();
    } else {
      onStatus('saved');
    }
  };

  const run = () => {
    if (cancelled) return;
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    attempt(0);
  };

  return {
    schedule() {
      if (cancelled) return;
      onStatus('pending');
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delayMs);
    },
    flushNow() {
      if (cancelled) return;
      clearTimer();
      run();
    },
    cancel() {
      cancelled = true;
      clearTimer();
      if (retryTimer) clearTimeout(retryTimer);
    }
  };
};

const unit = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// "Last synced 2 minutes ago" for the Settings page.
export const describeLastSynced = (lastSyncedAt, now = new Date()) => {
  if (!lastSyncedAt) return 'Not synced yet';
  const minutes = Math.floor((now.getTime() - new Date(lastSyncedAt).getTime()) / 60000);
  if (minutes < 1) return 'Last synced just now';
  if (minutes < 60) return `Last synced ${unit(minutes, 'minute')} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last synced ${unit(hours, 'hour')} ago`;
  return `Last synced ${unit(Math.floor(hours / 24), 'day')} ago`;
};
