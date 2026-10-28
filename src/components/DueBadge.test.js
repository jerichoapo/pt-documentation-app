import React from 'react';
import { render, screen } from '@testing-library/react';
import DueBadge from './DueBadge';

// Wednesday July 1, 2026 (week runs Mon Jun 29 - Sun Jul 5)
const now = new Date(2026, 6, 1, 12, 0);
const patient = { id: 'p1', visitFrequency: { timesPerWeek: 2 } };

test('shows the visit count as visible text, not only a tooltip', () => {
  render(<DueBadge patient={patient} sessions={[{ patientId: 'p1', sessionDate: '2026-06-29' }]} now={now} />);
  expect(screen.getByText('Due · 1 of 2')).toBeVisible();
  expect(screen.getByText('visits this week', { exact: false })).toHaveClass('sr-only');
});

test('renders nothing when the patient is not due', () => {
  const sessions = [
    { patientId: 'p1', sessionDate: '2026-06-29' },
    { patientId: 'p1', sessionDate: '2026-06-30' }
  ];
  const { container } = render(<DueBadge patient={patient} sessions={sessions} now={now} />);
  expect(container).toBeEmptyDOMElement();
});
