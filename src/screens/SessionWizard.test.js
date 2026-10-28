import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { PatientDataProvider } from '../context/PatientDataContext';
import SessionWizard from './SessionWizard';

const seedData = () => localStorage.setItem('ptAppData', JSON.stringify({
  version: '1.4',
  schools: [],
  patients: [{
    id: 'p1', firstName: 'Test', lastName: 'Child', dob: '2018-03-14', diagnosis: 'CP',
    guardianName: 'G', guardianPhone: '5551234567', notes: '', grade: '2', schoolId: null, school: '',
    goals: [], visitFrequency: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', lastSessionDate: '2026-10-27', sessionCount: 1
  }],
  sessions: [{
    id: 's1', patientId: 'p1', sessionDate: '2026-10-27', startTime: '09:30', endTime: '10:00',
    subjective: 'S', objectiveCategories: { balance: true }, objectiveNotes: 'O', assessment: 'A',
    plan: 'P', therExMinutes: 15, therActMinutes: 15,
    createdAt: '2026-10-27T15:00:00.000Z', updatedAt: '2026-10-27T15:00:00.000Z', amendments: []
  }]
}));

const seedDraft = (stateExtra) => localStorage.setItem('ptAppSessionDraft', JSON.stringify({
  patientId: 'p1',
  savedAt: '2026-10-28T08:00:00.000Z',
  state: {
    currentStep: 1,
    selectedDate: '2026-10-28',
    therExMinutes: 0,
    therActMinutes: 0,
    soapNote: {
      subjective: 'Draft text',
      objectiveCategories: { balance: false, motorSkills: false, therapeuticActivities: false, transfers: false, classroomMobility: false },
      objectiveNotes: '', assessment: '', plan: ''
    },
    ...stateExtra
  }
}));

const renderWizardAndResume = async () => {
  render(
    <MemoryRouter initialEntries={['/sessions/new/p1/subjective?referrer=home']}>
      <ToastProvider>
        <ConfirmProvider>
          <PatientDataProvider>
            <Routes>
              <Route path="/sessions/new/:patientId/:section?" element={<SessionWizard />} />
            </Routes>
          </PatientDataProvider>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
  await screen.findByDisplayValue('Draft text');
};

beforeEach(() => {
  localStorage.clear();
  seedData();
});

test('an old-format draft saved before Review takes the defaults, not its placeholder times', async () => {
  // The old wizard stored 14:00-15:30 placeholders until Review, with this flag false
  seedDraft({ sessionStartTime: '14:00', sessionEndTime: '15:30', timesInitialized: false });
  await renderWizardAndResume();
  await waitFor(() => expect(screen.getByLabelText('Session start')).toHaveValue('09:30'));
  expect(screen.getByLabelText('Session end')).toHaveValue('10:00');
});

test('a current draft keeps the times it was saved with', async () => {
  seedDraft({ sessionStartTime: '08:00', sessionEndTime: '08:30' });
  await renderWizardAndResume();
  expect(screen.getByLabelText('Session start')).toHaveValue('08:00');
  expect(screen.getByLabelText('Session end')).toHaveValue('08:30');
});
