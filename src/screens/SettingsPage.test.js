import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { PatientDataProvider } from '../context/PatientDataContext';
import { ProfileProvider } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const renderSettings = () => render(
  <MemoryRouter>
    <ToastProvider>
      <ConfirmProvider>
        <PatientDataProvider>
          <ProfileProvider>
            <SettingsPage />
          </ProfileProvider>
        </PatientDataProvider>
      </ConfirmProvider>
    </ToastProvider>
  </MemoryRouter>
);

beforeEach(() => {
  localStorage.clear();
});

test('shows the signed-in email', () => {
  useAuth.mockReturnValue({ user: { email: 'her@example.com' }, signOut: jest.fn() });
  renderSettings();
  expect(screen.getByText(/her@example\.com/)).toBeInTheDocument();
});

test('signs out at once when every change has reached the cloud', async () => {
  const signOut = jest.fn().mockResolvedValue({ error: null });
  useAuth.mockReturnValue({ user: { email: 'her@example.com' }, signOut });
  localStorage.setItem('ptAppSync', JSON.stringify({ lastSeen: 't1', dirty: false }));
  renderSettings();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(signOut).toHaveBeenCalled());
});

test('asks before signing out when a note draft would be lost', async () => {
  const signOut = jest.fn().mockResolvedValue({ error: null });
  useAuth.mockReturnValue({ user: { email: 'her@example.com' }, signOut });
  localStorage.setItem('ptAppSync', JSON.stringify({ lastSeen: 't1', dirty: false }));
  localStorage.setItem('ptAppSessionDraft', JSON.stringify({ patientId: 'p1' }));
  renderSettings();

  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText(/The note you started on this device/)).toBeInTheDocument();
  expect(signOut).not.toHaveBeenCalled();
});

test('asks before signing out with changes that have not reached the cloud', async () => {
  const signOut = jest.fn().mockResolvedValue({ error: null });
  useAuth.mockReturnValue({ user: { email: 'her@example.com' }, signOut });
  localStorage.setItem('ptAppSync', JSON.stringify({ lastSeen: 't1', dirty: true }));
  renderSettings();

  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Sign out with unsaved changes?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByText('Sign out with unsaved changes?')).toBeNull());
  expect(signOut).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out anyway' }));
  await waitFor(() => expect(signOut).toHaveBeenCalled());
});

describe('backups carry the provider profile', () => {
  const download = require('../utils/download');
  const backupData = { version: '1.4', patients: [], sessions: [], schools: [] };

  test('Download Backup includes the profile', () => {
    const save = jest.spyOn(download, 'downloadTextFile').mockImplementation(() => {});
    useAuth.mockReturnValue({ user: { email: 'her@example.com' }, signOut: jest.fn() });
    localStorage.setItem('pt-app-profile', JSON.stringify({ firstName: 'Jordan', lastName: 'Lee', credentials: ['PT'], license: 'PT1' }));
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: /Download Backup/ }));
    expect(JSON.parse(save.mock.calls[0][1]).profile).toMatchObject({ firstName: 'Jordan', license: 'PT1' });
    save.mockRestore();
  });

  const importFile = async (contents) => {
    const input = document.querySelector('input[type="file"]');
    const file = new File([JSON.stringify(contents)], 'backup.json', { type: 'application/json' });
    file.text = () => Promise.resolve(JSON.stringify(contents));
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Replace Data' }));
  };

  test('importing a backup with a profile restores it', async () => {
    useAuth.mockReturnValue({ user: { email: 'her@example.com' }, signOut: jest.fn() });
    renderSettings();
    await importFile({ ...backupData, profile: { firstName: 'Restored', lastName: 'Name', credentials: [], license: 'X9' } });
    await waitFor(() => expect(JSON.parse(localStorage.getItem('pt-app-profile'))).toMatchObject({ firstName: 'Restored', license: 'X9' }));
  });

  test('importing a backup without a profile leaves the profile alone', async () => {
    useAuth.mockReturnValue({ user: { email: 'her@example.com' }, signOut: jest.fn() });
    localStorage.setItem('pt-app-profile', JSON.stringify({ firstName: 'Kept', lastName: '', credentials: [], license: '' }));
    renderSettings();
    await importFile(backupData);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Replace Data' })).toBeNull());
    expect(JSON.parse(localStorage.getItem('pt-app-profile')).firstName).toBe('Kept');
  });
});
