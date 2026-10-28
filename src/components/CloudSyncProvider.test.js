import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CloudSyncProvider from './CloudSyncProvider';
import SyncBanner from './SyncBanner';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../context/AuthContext';
import { fetchRow, insertRow, updateRow, replaceRow, subscribeToRow } from '../data/cloud';
import { readSyncMeta } from '../data/syncLogic';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../data/cloud', () => ({
  fetchRow: jest.fn(),
  insertRow: jest.fn(),
  updateRow: jest.fn(),
  replaceRow: jest.fn(),
  subscribeToRow: jest.fn()
}));

const patient = (id) => ({ id, firstName: `First${id}`, lastName: `Last${id}`, schoolId: 'sc1' });
const note = (id, patientId) => ({ id, patientId, sessionDate: '2026-10-27', subjective: 's', amendments: [] });

// 4 patients, 6 notes, 2 schools
const localData = {
  version: '1.4',
  patients: ['p1', 'p2', 'p3', 'p4'].map(patient),
  sessions: [note('s1', 'p1'), note('s2', 'p1'), note('s3', 'p2'), note('s4', 'p2'), note('s5', 'p3'), note('s6', 'p4')],
  schools: [{ id: 'sc1', name: 'Oak' }, { id: 'sc2', name: 'Elm' }]
};
const localProfile = { firstName: 'Jordan', lastName: 'Lee', credentials: ['PT'], license: 'PT1' };

const cloudData = {
  version: '1.4',
  patients: [patient('c1')],
  sessions: [],
  schools: [{ id: 'sc1', name: 'Oak' }]
};
const cloudRow = (updatedAt) => ({ data: cloudData, profile: { firstName: 'Cloud' }, updated_at: updatedAt });

const seed = ({ data, profile, meta } = {}) => {
  if (data) localStorage.setItem('ptAppData', JSON.stringify(data));
  if (profile) localStorage.setItem('pt-app-profile', JSON.stringify(profile));
  if (meta) localStorage.setItem('ptAppSync', JSON.stringify(meta));
};

let sync;
const Probe = () => {
  sync = useSync();
  return (
    <div>
      <SyncBanner />
      <p>the app</p>
    </div>
  );
};

const renderProvider = () => render(
  <ToastProvider>
    <ConfirmProvider>
      <CloudSyncProvider pushDelayMs={10} retryDelaysMs={[5, 5, 5]}>
        <Probe />
      </CloudSyncProvider>
    </ConfirmProvider>
  </ToastProvider>
);

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'her@example.com' }, signOut: jest.fn() });
  subscribeToRow.mockReturnValue(() => {});
  URL.createObjectURL = jest.fn(() => 'blob:x');
  URL.revokeObjectURL = jest.fn();
});

test('no row and local data: offers the one-time upload, then shows the app', async () => {
  seed({ data: localData, profile: localProfile });
  fetchRow.mockResolvedValue(null);
  insertRow.mockResolvedValue('t1');
  renderProvider();

  expect(await screen.findByText('4 patients, 6 notes, 2 schools on this device')).toBeInTheDocument();
  expect(screen.queryByText('the app')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Upload to the cloud' }));
  expect(await screen.findByText('the app')).toBeInTheDocument();
  expect(insertRow).toHaveBeenCalledWith('u1', expect.objectContaining({ patients: localData.patients }), localProfile);
  expect(readSyncMeta()).toMatchObject({ lastSeen: 't1', dirty: false });
});

test('no row and nothing local: starts fresh with an empty row', async () => {
  fetchRow.mockResolvedValue(null);
  insertRow.mockResolvedValue('t1');
  renderProvider();
  expect(await screen.findByText('the app')).toBeInTheDocument();
  expect(insertRow).toHaveBeenCalledWith('u1', expect.objectContaining({ patients: [], sessions: [], schools: [] }), {});
});

test('row and a clean cache: the row replaces the cache', async () => {
  seed({ data: localData, profile: localProfile, meta: { lastSeen: 't0', dirty: false } });
  fetchRow.mockResolvedValue(cloudRow('t1'));
  renderProvider();

  expect(await screen.findByText('the app')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('ptAppData'))).toEqual(cloudData);
  expect(JSON.parse(localStorage.getItem('pt-app-profile'))).toEqual({ firstName: 'Cloud' });
  expect(readSyncMeta().lastSeen).toBe('t1');
});

test('dirty cache and an unchanged row: pushes the cache', async () => {
  seed({ data: localData, profile: localProfile, meta: { lastSeen: 't1', dirty: true } });
  fetchRow.mockResolvedValue(cloudRow('t1'));
  updateRow.mockResolvedValue('t2');
  renderProvider();

  expect(await screen.findByText('the app')).toBeInTheDocument();
  expect(updateRow).toHaveBeenCalledWith('u1', localData, localProfile, 't1');
  expect(readSyncMeta()).toMatchObject({ lastSeen: 't2', dirty: false });
});

test('dirty cache and a newer row: offers a backup, then the cloud wins', async () => {
  seed({ data: localData, profile: localProfile, meta: { lastSeen: 't0', dirty: true } });
  fetchRow.mockResolvedValue(cloudRow('t1'));
  renderProvider();

  fireEvent.click(await screen.findByRole('button', { name: "Download this device's data" }));
  expect(URL.createObjectURL).toHaveBeenCalled();
  expect(screen.queryByText('the app')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Continue with the cloud data' }));
  expect(await screen.findByText('the app')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('ptAppData'))).toEqual(cloudData);
  expect(readSyncMeta()).toMatchObject({ lastSeen: 't1', dirty: false });
});

test('a device with data that never synced: shows both counts and can replace the cloud', async () => {
  seed({ data: localData, profile: localProfile });
  fetchRow.mockResolvedValue(cloudRow('t1'));
  replaceRow.mockResolvedValue('t2');
  renderProvider();

  expect(await screen.findByText('This device: 4 patients, 6 notes. Cloud: 1 patient, 0 notes.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: "Replace the cloud data with this device's" }));
  fireEvent.click(await screen.findByRole('button', { name: 'Replace cloud data' }));

  expect(await screen.findByText('the app')).toBeInTheDocument();
  expect(replaceRow).toHaveBeenCalledWith('u1', expect.objectContaining({ patients: localData.patients }), localProfile);
  expect(readSyncMeta()).toMatchObject({ lastSeen: 't2', dirty: false });
});

test('a device with data that never synced can keep the cloud data', async () => {
  seed({ data: localData, profile: localProfile });
  fetchRow.mockResolvedValue(cloudRow('t1'));
  renderProvider();

  fireEvent.click(await screen.findByRole('button', { name: 'Keep the cloud data' }));
  expect(await screen.findByText('the app')).toBeInTheDocument();
  expect(URL.createObjectURL).toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('ptAppData'))).toEqual(cloudData);
});

test('a failed fetch shows the error screen, never the app, and Try again refetches', async () => {
  seed({ data: localData, meta: { lastSeen: 't0', dirty: false } });
  fetchRow.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(cloudRow('t1'));
  renderProvider();

  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(screen.queryByText('the app')).toBeNull();
  expect(await screen.findByText('the app')).toBeInTheDocument();
  expect(fetchRow).toHaveBeenCalledTimes(2);
});

const readyWithCleanCache = async () => {
  seed({ data: localData, profile: localProfile, meta: { lastSeen: 't0', dirty: false } });
  fetchRow.mockResolvedValue({ data: localData, profile: localProfile, updated_at: 't1' });
  renderProvider();
  await screen.findByText('the app');
};

test('changes close together make one push with the latest cache', async () => {
  await readyWithCleanCache();
  updateRow.mockResolvedValue('t2');
  const changed = { ...localData, patients: [...localData.patients, patient('p5')] };

  act(() => {
    sync.notifyChange();
    sync.notifyChange();
    localStorage.setItem('ptAppData', JSON.stringify(changed));
    sync.notifyChange();
  });
  expect(readSyncMeta().dirty).toBe(true);

  await waitFor(() => expect(updateRow).toHaveBeenCalledTimes(1));
  expect(updateRow).toHaveBeenCalledWith('u1', changed, localProfile, 't1');
  await waitFor(() => expect(readSyncMeta()).toMatchObject({ lastSeen: 't2', dirty: false }));
});

test('repeated push failures show the banner, and a successful retry clears it', async () => {
  await readyWithCleanCache();
  updateRow.mockRejectedValue(new TypeError('Failed to fetch'));

  act(() => sync.notifyChange());
  expect(await screen.findByText('Changes not saved to the cloud. Check your connection.')).toBeInTheDocument();
  expect(updateRow).toHaveBeenCalledTimes(4);
  expect(readSyncMeta().dirty).toBe(true);

  updateRow.mockResolvedValue('t2');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.queryByText('Changes not saved to the cloud. Check your connection.')).toBeNull());
  expect(readSyncMeta()).toMatchObject({ lastSeen: 't2', dirty: false });
});

test('a push that finds a newer row refetches and shows the conflict screen', async () => {
  await readyWithCleanCache();
  updateRow.mockResolvedValue(null);
  fetchRow.mockResolvedValue(cloudRow('t5'));

  act(() => sync.notifyChange());
  expect(await screen.findByRole('button', { name: 'Continue with the cloud data' })).toBeInTheDocument();
  expect(screen.queryByText('the app')).toBeNull();
});

describe('changes from the other device', () => {
  let signal;
  const newer = (updatedAt) => ({
    data: { ...localData, patients: [...localData.patients, patient('c9')] },
    profile: localProfile,
    updated_at: updatedAt
  });

  beforeEach(() => {
    subscribeToRow.mockImplementation((uid, onSignal) => {
      signal = onSignal;
      return () => {};
    });
  });

  test('a newer row with nothing being edited replaces the cache and says so', async () => {
    await readyWithCleanCache();
    fetchRow.mockResolvedValue(newer('t9'));
    await act(async () => signal('t9'));

    expect(await screen.findByText('Updated from your other device')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('ptAppData')).patients).toHaveLength(5);
    expect(readSyncMeta().lastSeen).toBe('t9');
  });

  test('a newer row is held while something is being edited and applied when the edit ends', async () => {
    await readyWithCleanCache();
    fetchRow.mockResolvedValue(newer('t9'));
    act(() => sync.beginEdit());
    await act(async () => signal('t9'));
    await waitFor(() => expect(fetchRow).toHaveBeenCalledTimes(2));

    expect(JSON.parse(localStorage.getItem('ptAppData')).patients).toHaveLength(4);
    expect(screen.queryByText('Updated from your other device')).toBeNull();

    act(() => sync.endEdit());
    expect(await screen.findByText('Updated from your other device')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('ptAppData')).patients).toHaveLength(5);
  });

  test('a change made during a hold builds on the held row and pushes against it', async () => {
    await readyWithCleanCache();
    fetchRow.mockResolvedValue(newer('t9'));
    updateRow.mockResolvedValue('t10');
    act(() => sync.beginEdit());
    await act(async () => signal('t9'));
    await waitFor(() => expect(fetchRow).toHaveBeenCalledTimes(2));

    let adopted;
    act(() => {
      adopted = sync.adoptHeldData();
    });
    expect(adopted.patients).toHaveLength(5);
    expect(readSyncMeta().lastSeen).toBe('t9');

    act(() => sync.notifyChange());
    await waitFor(() => expect(updateRow).toHaveBeenCalled());
    expect(updateRow.mock.calls[0][3]).toBe('t9');
  });

  test("this device's own push echoing back changes nothing", async () => {
    await readyWithCleanCache();
    updateRow.mockResolvedValue('t2');
    act(() => sync.notifyChange());
    await waitFor(() => expect(readSyncMeta().lastSeen).toBe('t2'));

    await act(async () => signal('t2'));
    expect(fetchRow).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Updated from your other device')).toBeNull();
  });

  test('a signal during an in-flight push is checked once after it, quietly when it was ours', async () => {
    await readyWithCleanCache();
    let finishPush;
    updateRow.mockImplementation(() => new Promise((resolve) => { finishPush = resolve; }));
    act(() => sync.notifyChange());
    await waitFor(() => expect(updateRow).toHaveBeenCalled());

    await act(async () => signal('t3'));
    expect(fetchRow).toHaveBeenCalledTimes(1);

    fetchRow.mockResolvedValue({ data: localData, profile: localProfile, updated_at: 't3' });
    await act(async () => finishPush('t3'));
    await waitFor(() => expect(fetchRow).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Updated from your other device')).toBeNull();
  });

  test('coming back to the app checks the cloud for changes', async () => {
    await readyWithCleanCache();
    fetchRow.mockResolvedValue(newer('t9'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await screen.findByText('Updated from your other device')).toBeInTheDocument();
  });
});
