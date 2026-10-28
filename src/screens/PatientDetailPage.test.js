import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { PatientDataProvider } from '../context/PatientDataContext';
import { ProfileProvider } from '../context/ProfileContext';
import PatientDetailPage from './PatientDetailPage';

const school = {
  id: 'sch1', name: 'Lincoln Elementary', street_address: '1 Main St', city: 'Springfield',
  state: 'IL', zip_code: '62701', point_of_contact: '', phone: '', email: '', notes: '',
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', patient_count: 1
};

const patient = (id, extra) => ({
  id, firstName: 'Test', lastName: id.toUpperCase(), dob: '2018-03-14', diagnosis: 'CP',
  guardianName: 'Guardian', guardianPhone: '5551234567', notes: '', grade: '2',
  goals: [], visitFrequency: null, createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z', lastSessionDate: null, sessionCount: 0, ...extra
});

const session = (id, sessionDate, assessment) => ({
  id, patientId: 'p1', sessionDate, startTime: '09:30', endTime: '10:00',
  subjective: 'S', objectiveCategories: { balance: true }, objectiveNotes: 'O',
  assessment, plan: 'P', therExMinutes: 15, therActMinutes: 15,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', amendments: []
});

const seed = () => localStorage.setItem('ptAppData', JSON.stringify({
  version: '1.4',
  schools: [school],
  patients: [
    patient('p1', { schoolId: 'sch1', school: 'Old Name', lastSessionDate: '2026-10-27', sessionCount: 2 }),
    patient('p2', { schoolId: 'missing', school: 'Legacy School' }),
    patient('p3', { schoolId: null, school: '' })
  ],
  sessions: [
    session('s1', '2026-10-27', 'Progressing toward goal 1'),
    session('s2', '2026-10-20', 'Baseline')
  ]
}));

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <ToastProvider>
      <ConfirmProvider>
        <PatientDataProvider>
          <ProfileProvider>
            <Routes>
              <Route path="/patients/:patientId" element={<PatientDetailPage />} />
            </Routes>
          </ProfileProvider>
        </PatientDataProvider>
      </ConfirmProvider>
    </ToastProvider>
  </MemoryRouter>
);

beforeEach(() => {
  localStorage.clear();
  seed();
});

test('shows the school by id, not the legacy string', () => {
  renderAt('/patients/p1');
  expect(screen.getByText('Lincoln Elementary')).toBeInTheDocument();
  expect(screen.queryByText('Old Name')).toBeNull();
});

test('falls back to the legacy string when the school id is missing', () => {
  renderAt('/patients/p2');
  expect(screen.getByText('Legacy School')).toBeInTheDocument();
});

test('shows Not specified when there is no school at all', () => {
  renderAt('/patients/p3');
  expect(screen.getByText('Not specified', { selector: '[data-field="school"]' })).toBeInTheDocument();
});

test('session history comes before details', () => {
  renderAt('/patients/p1');
  const history = screen.getByText(/session history/i);
  const guardian = screen.getByText(/parent\/guardian/i);
  expect(history.compareDocumentPosition(guardian) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('history rows preview the assessment', () => {
  renderAt('/patients/p1');
  expect(screen.getByText('Progressing toward goal 1')).toBeInTheDocument();
});
