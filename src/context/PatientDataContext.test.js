import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import CloudSyncProvider from '../components/CloudSyncProvider';
import { ToastProvider } from './ToastContext';
import { ConfirmProvider } from './ConfirmContext';
import { PatientDataProvider, usePatientData } from './PatientDataContext';
import { useSync } from './SyncContext';
import { useAuth } from './AuthContext';
import { fetchRow, updateRow, subscribeToRow } from '../data/cloud';

jest.mock('./AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../data/cloud', () => ({
  fetchRow: jest.fn(),
  insertRow: jest.fn(),
  updateRow: jest.fn(),
  replaceRow: jest.fn(),
  subscribeToRow: jest.fn()
}));

const school = { id: 'sc1', name: 'Oak', street_address: '1 A St', city: 'X', state: 'CA', zip_code: '90000', phone: '', patient_count: 0 };
const base = { version: '1.4', patients: [], sessions: [], schools: [school] };
const laptopPatient = { id: 'c1', firstName: 'From', lastName: 'Laptop', dob: '2018-01-01', schoolId: 'sc1', goals: [], visitFrequency: null };

let data;
let sync;
const Probe = () => {
  data = usePatientData();
  sync = useSync();
  return <p>{data.patients.length} patients</p>;
};

test('a save made while a laptop change is held keeps both', async () => {
  let signal;
  useAuth.mockReturnValue({ user: { id: 'u1' }, signOut: jest.fn() });
  subscribeToRow.mockImplementation((uid, onSignal) => {
    signal = onSignal;
    return () => {};
  });
  localStorage.setItem('ptAppData', JSON.stringify(base));
  localStorage.setItem('ptAppSync', JSON.stringify({ lastSeen: 't0', dirty: false }));
  fetchRow.mockResolvedValue({ data: base, profile: {}, updated_at: 't1' });
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

  // The phone has a form open; the laptop adds a patient
  act(() => sync.beginEdit());
  fetchRow.mockResolvedValue({ data: { ...base, patients: [laptopPatient] }, profile: {}, updated_at: 't2' });
  await act(async () => signal('t2'));
  await waitFor(() => expect(fetchRow).toHaveBeenCalledTimes(2));
  expect(screen.getByText('0 patients')).toBeInTheDocument();

  // The phone saves its own new patient
  await act(async () => {
    await data.addPatient({ firstName: 'From', lastName: 'Phone', dob: '2017-02-02', schoolId: 'sc1' });
  });

  await waitFor(() => expect(updateRow).toHaveBeenCalled());
  const [, pushed, , expected] = updateRow.mock.calls[0];
  expect(expected).toBe('t2');
  expect(pushed.patients.map(p => p.lastName).sort()).toEqual(['Laptop', 'Phone']);
});
