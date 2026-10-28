import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { getSupabase } from '../data/supabaseClient';

jest.mock('../data/supabaseClient', () => ({ getSupabase: jest.fn() }));

let auth;
const Probe = () => {
  auth = useAuth();
  return <div>{auth.user ? auth.user.email : 'signed out'}</div>;
};

const mockClient = (overrides = {}) => {
  const client = {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'her@example.com' } } } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      ...overrides
    }
  };
  getSupabase.mockReturnValue(client);
  return client;
};

beforeEach(() => {
  localStorage.clear();
});

test('restores the saved session on load', async () => {
  mockClient();
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(await screen.findByText('her@example.com')).toBeInTheDocument();
});

test('sign out ends only this device session and leaves no patient data behind', async () => {
  const client = mockClient();
  localStorage.setItem('ptAppData', JSON.stringify({ patients: [{ id: 'p1' }], sessions: [], schools: [] }));
  localStorage.setItem('pt-app-profile', JSON.stringify({ firstName: 'Jordan' }));
  localStorage.setItem('ptAppSync', JSON.stringify({ lastSeen: 't1', dirty: false }));
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('her@example.com');
  await act(async () => {
    await auth.signOut();
  });
  expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(localStorage.getItem('ptAppData')).toBeNull();
  expect(localStorage.getItem('pt-app-profile')).toBeNull();
  expect(localStorage.getItem('ptAppSync')).toBeNull();
});

test('a failed sign-out keeps the cache and reports the error', async () => {
  mockClient({ signOut: jest.fn().mockResolvedValue({ error: new TypeError('Failed to fetch') }) });
  localStorage.setItem('ptAppData', '{"patients":[],"sessions":[],"schools":[]}');
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('her@example.com');
  let result;
  await act(async () => {
    result = await auth.signOut();
  });
  expect(result.error).toBeTruthy();
  expect(localStorage.getItem('ptAppData')).not.toBeNull();
});
