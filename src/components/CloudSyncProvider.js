import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SyncContext } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToastContext } from '../context/ToastContext';
import { store } from '../data/store';
import { fetchRow, insertRow, updateRow, replaceRow, subscribeToRow } from '../data/cloud';
import {
  readSyncMeta,
  writeSyncMeta,
  readLocalSnapshot,
  hasLocalData,
  countData,
  chooseLoadPath,
  createPushQueue,
  unsavedWorkWarning,
  describeLoadError,
  sameContent
} from '../data/syncLogic';
import { downloadTextFile, todayStamp } from '../utils/download';
import SyncScreens from './SyncScreens';

const DATA_KEY = 'ptAppData';
const PROFILE_KEY = 'pt-app-profile';
const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000];

const emptyData = () => JSON.parse(store.exportData({}));

const writeCache = (data, profile) => {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile || {}));
};

// Migrate and purge the cache the way the app does on load. Null when the
// cache can't be read; the data context shows its recovery screen for that.
const initializedCache = () => {
  try {
    return store.init();
  } catch (error) {
    return null;
  }
};

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// localStorage is a cache of the user's one cloud row. This provider decides
// how the two meet after sign-in, holds the app back until they agree, and
// sends the cache to the cloud after every change.
const CloudSyncProvider = ({ children, pushDelayMs = 500, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS }) => {
  const { user, signOut } = useAuth();
  const userId = user.id;
  const confirm = useConfirm();
  const { addToast } = useToastContext();

  const [gate, setGate] = useState({ kind: 'loading' });
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('saved');
  const [lastSyncedAt, setLastSyncedAt] = useState(() => readSyncMeta().lastSyncedAt);
  const [isWorking, setIsWorking] = useState(false);

  const gateKindRef = useRef('loading');
  const changeCountRef = useRef(0);
  const queueRef = useRef(null);
  const editCountRef = useRef(0);
  const loadedForRef = useRef(null);
  const pushRef = useRef(null);
  const queueOptionsRef = useRef({ pushDelayMs, retryDelaysMs });
  const heldRowRef = useRef(null);
  const pushInFlightRef = useRef(false);
  const recheckAfterPushRef = useRef(false);
  const checkRef = useRef(null);
  // Counts every time the cache is replaced from outside the data context (the
  // other device, another tab, a held row). The data context compares it
  // before each change and reloads its copy when it moved.
  const cacheVersionRef = useRef(0);
  const reloadAfterEditRef = useRef(false);
  const catchUpRef = useRef(null);

  const showGate = useCallback((next) => {
    gateKindRef.current = next.kind;
    setGate(next);
  }, []);

  // A failed push keeps the banner up through later changes until a push
  // succeeds
  const updateStatus = useCallback((next) => {
    setStatus((previous) => (previous === 'failed' && next === 'pending' ? 'failed' : next));
  }, []);

  const showError = useCallback((error) => {
    showGate({ kind: 'error', reason: describeLoadError(error), code: error?.code || null });
  }, [showGate]);

  const recordSynced = useCallback((updatedAt, extra = {}) => {
    const now = new Date().toISOString();
    writeSyncMeta({ lastSeen: updatedAt, lastSyncedAt: now, ...extra });
    setLastSyncedAt(now);
  }, []);

  const notifyChange = useCallback(() => {
    changeCountRef.current += 1;
    writeSyncMeta({ dirty: true });
    if (queueRef.current) queueRef.current.schedule();
  }, []);

  // Make the cloud row this device's data. If the app's own load step
  // (migrations, the 30-day purge) changes it, send the result back.
  const applyRow = useCallback((row) => {
    writeCache(row.data, row.profile);
    recordSynced(row.updated_at, { dirty: false });
    const initialized = initializedCache();
    if (initialized && JSON.stringify(initialized) !== JSON.stringify(row.data)) {
      notifyChange();
    }
  }, [recordSynced, notifyChange]);

  // A guarded write found the row changed. If the cloud already holds exactly
  // this device's data (the reply to an earlier write was lost on the way
  // back), return the row so the caller records it as saved. Otherwise
  // another device wrote: show the conflict screen and return null.
  const resolveRejectedPush = useCallback(async () => {
    const row = await fetchRow(userId);
    if (!row) throw new Error('ROW_MISSING');
    const { data, profile, profileUnreadable } = readLocalSnapshot();
    const profileMatches = profileUnreadable || sameContent(row.profile, profile || {});
    if (sameContent(row.data, data) && profileMatches) return row;
    showGate({ kind: 'conflict', row });
    return null;
  }, [userId, showGate]);

  pushRef.current = async () => {
    if (gateKindRef.current !== 'ready') return;
    const { data, profile, profileUnreadable } = readLocalSnapshot();
    if (!data) return;
    const sentChange = changeCountRef.current;
    pushInFlightRef.current = true;
    try {
      const updatedAt = await updateRow(userId, data, profileUnreadable ? undefined : profile, readSyncMeta().lastSeen);
      if (updatedAt === null) {
        const saved = await resolveRejectedPush();
        if (saved) recordSynced(saved.updated_at, sentChange === changeCountRef.current ? { dirty: false } : {});
        return;
      }
      recordSynced(updatedAt, sentChange === changeCountRef.current ? { dirty: false } : {});
    } finally {
      pushInFlightRef.current = false;
      if (recheckAfterPushRef.current) {
        recheckAfterPushRef.current = false;
        checkRef.current(null);
      }
    }
  };

  // Replace the cache with a newer row from the other device and tell the
  // data contexts to reload it.
  const applyIncoming = useCallback((row) => {
    applyRow(row);
    cacheVersionRef.current += 1;
    setRevision((r) => r + 1);
    addToast('Updated from your other device', 'info');
  }, [applyRow, addToast]);

  // Runs on a Realtime signal, when Realtime (re)connects, when the app comes
  // back into view, and when the connection returns. A signal carrying the
  // updated_at this device already has is its own push echoing back. While a
  // push is in flight the check waits for it, so the echo is never mistaken
  // for the other device. A change made while a check is running waits for
  // it (waitForCatchUp), so a save right after resuming builds on what the
  // check finds.
  const checkForNewerRow = async (signalUpdatedAt) => {
    if (gateKindRef.current !== 'ready') return;
    if (signalUpdatedAt && signalUpdatedAt === readSyncMeta().lastSeen) return;
    if (pushInFlightRef.current) {
      recheckAfterPushRef.current = true;
      return;
    }
    let row;
    try {
      row = await fetchRow(userId);
    } catch (error) {
      return; // The next signal or visit tries again
    }
    if (!row || row.updated_at === readSyncMeta().lastSeen) return;
    if (pushInFlightRef.current) {
      recheckAfterPushRef.current = true;
      return;
    }
    // An unsent change here and a newer row there: the pending push meets
    // the newer row and shows the conflict screen.
    if (readSyncMeta().dirty) return;
    if (editCountRef.current > 0) {
      heldRowRef.current = row;
      return;
    }
    applyIncoming(row);
  };

  checkRef.current = (signalUpdatedAt) => {
    const check = checkForNewerRow(signalUpdatedAt);
    catchUpRef.current = check;
    check.finally(() => {
      if (catchUpRef.current === check) catchUpRef.current = null;
    });
    return check;
  };

  useEffect(() => {
    const { pushDelayMs: delayMs, retryDelaysMs: retries } = queueOptionsRef.current;
    const queue = createPushQueue({
      push: () => pushRef.current(),
      delayMs,
      retryDelaysMs: retries,
      onStatus: updateStatus
    });
    queueRef.current = queue;
    return () => {
      queue.cancel();
      if (queueRef.current === queue) queueRef.current = null;
    };
  }, [updateStatus]);

  // An empty row and an empty cache, for a device with nothing to keep
  const startFresh = useCallback(async () => {
    const data = emptyData();
    const updatedAt = await insertRow(userId, data, {});
    writeCache(data, {});
    recordSynced(updatedAt, { dirty: false });
    showGate({ kind: 'ready' });
  }, [userId, recordSynced, showGate]);

  const load = useCallback(async () => {
    showGate({ kind: 'loading' });
    let row;
    try {
      row = await fetchRow(userId);
    } catch (error) {
      showError(error);
      return;
    }

    const snapshot = readLocalSnapshot();
    const meta = readSyncMeta();
    const path = chooseLoadPath({
      row,
      localHasData: hasLocalData(snapshot),
      dirty: meta.dirty,
      lastSeen: meta.lastSeen,
      localUnreadable: snapshot.dataUnreadable
    });

    try {
      if (path === 'unreadable-cache') {
        showGate({ kind: 'unreadable', row });
      } else if (path === 'create-empty') {
        await startFresh();
      } else if (path === 'migrate') {
        showGate({ kind: 'migrate', counts: countData(snapshot.data) });
      } else if (path === 'first-device') {
        showGate({ kind: 'first-device', row, local: countData(snapshot.data), cloud: countData(row.data) });
      } else if (path === 'conflict') {
        showGate({ kind: 'conflict', row });
      } else if (path === 'push-cache') {
        const profile = snapshot.profileUnreadable ? undefined : snapshot.profile;
        const updatedAt = await updateRow(userId, snapshot.data, profile, meta.lastSeen);
        if (updatedAt === null) {
          const saved = await resolveRejectedPush();
          if (saved) {
            recordSynced(saved.updated_at, { dirty: false });
            showGate({ kind: 'ready' });
          }
          return;
        }
        recordSynced(updatedAt, { dirty: false });
        showGate({ kind: 'ready' });
      } else {
        applyRow(row);
        showGate({ kind: 'ready' });
      }
    } catch (error) {
      showError(error);
    }
  }, [userId, applyRow, recordSynced, showGate, showError, resolveRejectedPush, startFresh]);

  useEffect(() => {
    // StrictMode runs effects twice in development; load once per user
    if (loadedForRef.current === userId) return;
    loadedForRef.current = userId;
    load();
  }, [userId, load]);

  const retryPush = useCallback(() => {
    if (queueRef.current) queueRef.current.flushNow();
  }, []);

  // A failed push goes out again as soon as the connection is back
  useEffect(() => {
    if (status !== 'failed') return undefined;
    window.addEventListener('online', retryPush);
    return () => window.removeEventListener('online', retryPush);
  }, [status, retryPush]);

  const downloadUnreadableData = () => {
    downloadTextFile(`pt-app-unreadable-data-${todayStamp()}.txt`, readLocalSnapshot().dataRaw || '', 'text/plain');
  };

  // The device's copy can't be read, so the cloud copy (or a fresh start)
  // replaces it
  const continuePastUnreadable = async () => {
    try {
      if (gate.row) {
        applyRow(gate.row);
        showGate({ kind: 'ready' });
      } else {
        await startFresh();
      }
    } catch (error) {
      showError(error);
    }
  };

  const downloadDeviceBackup = () => {
    const { data } = readLocalSnapshot();
    downloadTextFile(`pt-app-device-backup-${todayStamp()}.json`, store.exportData(data || {}), 'application/json');
  };

  const uploadLocal = async () => {
    setIsWorking(true);
    try {
      const data = initializedCache() || readLocalSnapshot().data;
      const updatedAt = await insertRow(userId, data, readLocalSnapshot().profile);
      recordSynced(updatedAt, { dirty: false });
      showGate({ kind: 'ready' });
    } catch (error) {
      // Another device uploaded first: load again and offer the choice
      if (error?.code === '23505') {
        load();
        return;
      }
      showError(error);
    } finally {
      setIsWorking(false);
    }
  };

  const keepCloud = () => {
    downloadDeviceBackup();
    applyRow(gate.row);
    showGate({ kind: 'ready' });
  };

  const replaceCloud = async () => {
    const { local, cloud } = gate;
    const confirmed = await confirm({
      title: 'Replace the cloud data?',
      message: `The cloud's ${plural(cloud.patients, 'patient')} and ${plural(cloud.sessions, 'note')} are replaced by this device's ${plural(local.patients, 'patient')} and ${plural(local.sessions, 'note')}. This can't be undone.`,
      confirmLabel: 'Replace cloud data',
      danger: true
    });
    if (!confirmed) return;
    setIsWorking(true);
    try {
      const data = initializedCache() || readLocalSnapshot().data;
      const updatedAt = await replaceRow(userId, data, readLocalSnapshot().profile);
      recordSynced(updatedAt, { dirty: false });
      showGate({ kind: 'ready' });
    } catch (error) {
      showError(error);
    } finally {
      setIsWorking(false);
    }
  };

  const continueWithCloud = () => {
    applyRow(gate.row);
    showGate({ kind: 'ready' });
  };

  const signOutFromGate = async () => {
    const warning = unsavedWorkWarning();
    if (warning) {
      const confirmed = await confirm({
        title: 'Sign out with unsaved changes?',
        message: warning,
        confirmLabel: 'Sign out anyway',
        danger: true
      });
      if (!confirmed) return;
    }
    const { error } = await signOut();
    if (error) addToast("Couldn't sign out. Check your connection and try again.", 'error');
  };

  useEffect(() => {
    if (gate.kind !== 'ready') return undefined;
    const unsubscribe = subscribeToRow(
      userId,
      (updatedAt) => checkRef.current(updatedAt),
      () => checkRef.current(null)
    );
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkRef.current(null);
    };
    const onOnline = () => checkRef.current(null);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [gate.kind, userId]);

  // Another tab of this browser shares the cache. When it writes, reload from
  // the cache; mid-edit, wait for the edit to end (the next change here reads
  // the cache first). When it removes the cache (signed out there), run the
  // load again rather than show an empty caseload.
  useEffect(() => {
    if (gate.kind !== 'ready') return undefined;
    const onStorage = (event) => {
      if (event.key !== DATA_KEY && event.key !== PROFILE_KEY) return;
      if (event.key === DATA_KEY && event.newValue === null) {
        load();
        return;
      }
      cacheVersionRef.current += 1;
      if (editCountRef.current > 0) {
        reloadAfterEditRef.current = true;
        return;
      }
      setRevision((r) => r + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [gate.kind, load]);

  const beginEdit = useCallback(() => {
    editCountRef.current += 1;
  }, []);

  const endEdit = useCallback(() => {
    editCountRef.current = Math.max(0, editCountRef.current - 1);
    if (editCountRef.current > 0) return;
    const row = heldRowRef.current;
    heldRowRef.current = null;
    if (row && row.updated_at !== readSyncMeta().lastSeen) {
      reloadAfterEditRef.current = false;
      applyIncoming(row);
    } else if (reloadAfterEditRef.current) {
      reloadAfterEditRef.current = false;
      setRevision((r) => r + 1);
    }
  }, [applyIncoming]);

  // A save made while a row is held builds on that row: the held data goes
  // into the cache first and the caller runs its change on the result, so
  // the push that follows matches the cloud and keeps both devices' work.
  const adoptHeldData = useCallback(() => {
    const row = heldRowRef.current;
    if (!row) return null;
    heldRowRef.current = null;
    writeCache(row.data, row.profile);
    recordSynced(row.updated_at);
    cacheVersionRef.current += 1;
    const data = initializedCache();
    setRevision((r) => r + 1);
    addToast('Updated from your other device', 'info');
    return data;
  }, [recordSynced, addToast]);

  const getCacheVersion = useCallback(() => cacheVersionRef.current, []);

  // The check in progress, if any, capped at 3 seconds so a slow network
  // never blocks a save for long. Null when nothing is running.
  const waitForCatchUp = useCallback(() => {
    const pending = catchUpRef.current;
    if (!pending) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      pending.finally(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }, []);

  const value = useMemo(() => ({
    notifyChange,
    revision,
    status,
    lastSyncedAt,
    retryPush,
    beginEdit,
    endEdit,
    adoptHeldData,
    getCacheVersion,
    waitForCatchUp
  }), [notifyChange, revision, status, lastSyncedAt, retryPush, beginEdit, endEdit, adoptHeldData, getCacheVersion, waitForCatchUp]);

  if (gate.kind !== 'ready') {
    return (
      <SyncScreens
        gate={gate}
        isWorking={isWorking}
        onRetry={load}
        onSignOut={signOutFromGate}
        onUpload={uploadLocal}
        onKeepCloud={keepCloud}
        onReplaceCloud={replaceCloud}
        onDownloadDevice={downloadDeviceBackup}
        onContinueWithCloud={continueWithCloud}
        onDownloadUnreadable={downloadUnreadableData}
        onContinuePastUnreadable={continuePastUnreadable}
      />
    );
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export default CloudSyncProvider;
