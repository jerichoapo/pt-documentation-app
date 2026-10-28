import { createContext, useContext, useEffect } from 'react';

// What the screens and data contexts need from the cloud sync. The default
// does nothing, so a component renders the same without the provider (tests).
const noop = () => {};

const defaultValue = {
  notifyChange: noop,
  revision: 0,
  status: 'saved',
  lastSyncedAt: null,
  retryPush: noop,
  beginEdit: noop,
  endEdit: noop,
  adoptHeldData: () => null
};

export const SyncContext = createContext(defaultValue);

export const useSync = () => useContext(SyncContext);

// Holds changes from the other device while this screen has unsaved edits.
export const useEditingHold = (active) => {
  const { beginEdit, endEdit } = useSync();
  useEffect(() => {
    if (!active) return undefined;
    beginEdit();
    return () => endEdit();
  }, [active, beginEdit, endEdit]);
};
