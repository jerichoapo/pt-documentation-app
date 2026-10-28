import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/login']}>
    <LoginPage />
  </MemoryRouter>
);

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'her@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pass' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

test('submitting signs in with the typed email and password', async () => {
  const signIn = jest.fn().mockResolvedValue({ error: null });
  useAuth.mockReturnValue({ signIn });
  renderPage();
  fillAndSubmit();
  await waitFor(() => expect(signIn).toHaveBeenCalledWith('her@example.com', 'secret-pass'));
});

test('a rejected sign-in says the email or password is wrong', async () => {
  useAuth.mockReturnValue({ signIn: jest.fn().mockResolvedValue({ error: { status: 400, message: 'Invalid login credentials' } }) });
  renderPage();
  fillAndSubmit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
});

test('a network failure says the server cannot be reached', async () => {
  useAuth.mockReturnValue({ signIn: jest.fn().mockResolvedValue({ error: new TypeError('Failed to fetch') }) });
  renderPage();
  fillAndSubmit();
  expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
});

test('the button reads Signing in while the request is pending', async () => {
  useAuth.mockReturnValue({ signIn: jest.fn(() => new Promise(() => {})) });
  renderPage();
  fillAndSubmit();
  expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled();
});
