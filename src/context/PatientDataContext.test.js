import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import CloudSyncProvider from '../components/CloudSyncProvider';
import { ToastProvider } from './ToastContext';
import { ConfirmProvider } from './ConfirmContext';
import { PatientDataProvider, usePatientData } from './PatientDataContext';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { fetchRow, fetchRowVersion, updateRow, subscribeToRow } from '../data/cloud';

jest.mock('./AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../data/cloud', () => ({
  fetchRow: jest.fn(),
  fetchRowVersion: jest.fn(),
  insertRow: jest.fn(),
  updateRow: jest.fn(),
  replaceRow: jest.fn(),
  subscribeToRow: jest.fn()
}));

const school = { id: 'sc1', name: 'Oak', street_address: '1 A St', city: 'X', state: 'CA', zip_code: '90000', phone: '', patient_count: 0 };
const base = { version: '1.4', patients: [], sessions: [], schools: [school] };
const otherPatient = (lastName) => ({ id: `c-${lastName}`, firstName: 'From', lastName, dob: '2018-01-01', schoolId: 'sc1', goals: [], visitFrequency: null });

let data;
let sync;
let signal;
const Probe = () => {
  data = usePatientData();
  sync = useSync();
  return <p>{data.patients.length} patients</p>;
};

const renderReady = async () => {
  useAuth.mockReturnValue({ user: { id: 'u1' }, signOut: jest.fn() });
  subscribeToRow.mockImplementation((uid, onSignal) => {
    signal = onSignal;
    return () => {};
  });
  localStorage.setItem('ptAppData', JSON.stringify(base));
  localStorage.setItem('ptAppSync', JSON.stringify({ lastSeen: 't0', dirty: false }));
  fetchRow.mockResolvedValue({ data: base, profile: {}, updated_at: 't1' });
  fetchRowVersion.mockResolvedValue('changed');
  updateRow.mockResolvedValue('t3');

  render(
    <ToastProvider>
      <ConfirmProvider>
        <CloudSyncProvider pushDelayMs={10} retryDelaysMs={[]}>
          <PatientDataProvider>
            <Probe />
          </PatientDataProvider>
        </CloudSyncProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
  expect(await screen.findByText('0 patients')).toBeInTheDocument();
};

const phonePatient = { firstName: 'From', lastName: 'Phone', dob: '2017-02-02', schoolId: 'sc1' };
const pushedLastNames = (call = 0) => updateRow.mock.calls[call][1].patients.map(p => p.lastName).sort();

// Another tab of the same browser writes the shared cache
const otherTabWrites = (patients) => {
  const value = JSON.stringify({ ...base, patients });
  localStorage.setItem('ptAppData', value);
  window.dispatchEvent(new StorageEvent('storage', { key: 'ptAppData', newValue: value }));
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test('a save made while a laptop change is held keeps both', async () => {
  await renderReady();

  // The phone has a form open; the laptop adds a patient
  act(() => sync.beginEdit());
  fetchRow.mockResolvedValue({ data: { ...base, patients: [otherPatient('Laptop')] }, profile: {}, updated_at: 't2' });
  await act(async () => signal('t2'));
  await waitFor(() => expect(fetchRow).toHaveBeenCalledTimes(2));
  expect(screen.getByText('0 patients')).toBeInTheDocument();

  // The phone saves its own new patient
  await act(async () => {
    await data.addPatient(phonePatient);
  });

  await waitFor(() => expect(updateRow).toHaveBeenCalled());
  expect(updateRow.mock.calls[0][3]).toBe('t2');
  expect(pushedLastNames()).toEqual(['Laptop', 'Phone']);
});

test('a save made right after resuming waits for the catch-up and keeps both', async () => {
  await renderReady();

  // Coming back to the app starts a slow fetch; she saves before it returns
  let finishFetch;
  fetchRow.mockImplementation(() => new Promise((resolve) => { finishFetch = resolve; }));
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  let saving;
  act(() => {
    saving = data.addPatient(phonePatient);
  });
  await act(async () => {
    finishFetch({ data: { ...base, patients: [otherPatient('Laptop')] }, profile: {}, updated_at: 't2' });
    await saving;
  });

  await waitFor(() => expect(updateRow).toHaveBeenCalled());
  expect(updateRow.mock.calls[0][3]).toBe('t2');
  expect(pushedLastNames()).toEqual(['Laptop', 'Phone']);
  expect(screen.queryByText('Continue with the cloud data')).toBeNull();
});

test("another tab's save shows here without a reload", async () => {
  await renderReady();
  act(() => otherTabWrites([otherPatient('Tab')]));
  expect(await screen.findByText('1 patients')).toBeInTheDocument();
});

test("a save here builds on another tab's save, even mid-edit", async () => {
  await renderReady();
  act(() => sync.beginEdit());
  act(() => otherTabWrites([otherPatient('Tab')]));
  expect(screen.getByText('0 patients')).toBeInTheDocument();

  await act(async () => {
    await data.addPatient(phonePatient);
  });
  await waitFor(() => expect(updateRow).toHaveBeenCalled());
  expect(pushedLastNames()).toEqual(['Phone', 'Tab']);
});
