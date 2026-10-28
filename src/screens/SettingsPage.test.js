import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { PatientDataProvider } from '../context/PatientDataContext';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const renderSettings = () => render(
  <MemoryRouter>
    <ToastProvider>
      <ConfirmProvider>
        <PatientDataProvider>
          <SettingsPage />
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
