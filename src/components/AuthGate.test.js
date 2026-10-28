import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthGate from './AuthGate';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <AuthGate>
      <div>the app</div>
    </AuthGate>
  </MemoryRouter>
);

test('a signed-out visitor to any route gets the sign-in form', () => {
  useAuth.mockReturnValue({ user: null, isLoading: false, signIn: jest.fn() });
  renderAt('/patients/p1');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.queryByText('the app')).toBeNull();
});

test('a signed-in user sees the app, even at /login', () => {
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'her@example.com' }, isLoading: false });
  renderAt('/login');
  expect(screen.getByText('the app')).toBeInTheDocument();
});

test('nothing renders but a loading line while the session is restored', () => {
  useAuth.mockReturnValue({ user: null, isLoading: true });
  renderAt('/');
  expect(screen.getByText('Loading…')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
});

test('offline with a session to restore shows an offline screen, not the sign-in form', () => {
  const retry = jest.fn();
  useAuth.mockReturnValue({ user: null, isLoading: false, isOffline: true, retry });
  renderAt('/');
  expect(screen.getByText("You're offline")).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  screen.getByRole('button', { name: 'Try again' }).click();
  expect(retry).toHaveBeenCalled();
});
