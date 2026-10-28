import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackLink from './BackLink';

test('renders both labels', () => {
  render(
    <MemoryRouter>
      <BackLink to="/patients" label="Patients" />
    </MemoryRouter>
  );
  expect(screen.getByText('Back to Patients')).toHaveClass('hidden', 'sm:inline');
  expect(screen.getByText('Back')).toHaveClass('sm:hidden');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/patients');
});
