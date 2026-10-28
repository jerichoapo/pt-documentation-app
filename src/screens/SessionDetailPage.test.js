import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SessionDetailPage from './SessionDetailPage';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { PatientDataProvider, usePatientData } from '../context/PatientDataContext';
import { ProfileProvider } from '../context/ProfileContext';

const seed = {
  version: '1.4',
  patients: [{ id: 'p1', firstName: 'Ava', lastName: 'Martinez', dob: '2018-03-02', goals: [], visitFrequency: null }],
  sessions: [{
    id: 's1',
    patientId: 'p1',
    sessionDate: '2026-10-27',
    startTime: '09:00',
    endTime: '09:30',
    subjective: 'Old text',
    objectiveCategories: { balance: true },
    objectiveNotes: 'O',
    assessment: 'A',
    plan: 'P',
    therExMinutes: 15,
    therActMinutes: 15,
    amendments: []
  }],
  schools: []
};

let data;
const Probe = () => {
  data = usePatientData();
  return null;
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ptAppData', JSON.stringify(seed));
});

test('Edit starts from the note as it is now, not as it was when the page opened', async () => {
  render(
    <MemoryRouter initialEntries={['/sessions/s1']}>
      <ToastProvider>
        <ConfirmProvider>
          <PatientDataProvider>
            <ProfileProvider>
              <Probe />
              <Routes>
                <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
              </Routes>
            </ProfileProvider>
          </PatientDataProvider>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>
  );
  expect(await screen.findByText('Old text')).toBeInTheDocument();

  // The note changes underneath the open page, as when the other device edits it
  await act(async () => {
    await data.updateSession('s1', { subjective: 'Laptop text' });
  });
  expect(await screen.findByText('Laptop text')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByDisplayValue('Laptop text')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('Old text')).toBeNull();
});
