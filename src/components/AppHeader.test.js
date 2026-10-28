import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppHeader from './AppHeader';

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <AppHeader />
  </MemoryRouter>
);

test('highlights the current route, not Home', () => {
  renderAt('/patients');
  expect(screen.getByRole('link', { name: 'Patients' })).toHaveClass('text-blue-600');
  expect(screen.getByRole('link', { name: 'Home' })).not.toHaveClass('text-blue-600');
});

test('Home is active only at the root', () => {
  renderAt('/');
  expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('text-blue-600');
});

test('does not render the tagline', () => {
  renderAt('/');
  expect(screen.queryByText(/structured session documentation/i)).toBeNull();
});
