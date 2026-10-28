import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { PatientDataProvider } from '../context/PatientDataContext';
import PatientForm from './PatientForm';

const renderNewPatientForm = () => render(
  <MemoryRouter initialEntries={['/patients/new']}>
    <ToastProvider>
      <ConfirmProvider>
        <PatientDataProvider>
          <Routes>
            <Route path="/patients/new" element={<PatientForm />} />
          </Routes>
        </PatientDataProvider>
      </ConfirmProvider>
    </ToastProvider>
  </MemoryRouter>
);

beforeEach(() => localStorage.clear());

test('the five required fields come first', () => {
  const { container } = renderNewPatientForm();
  const labels = [...container.querySelectorAll('label')].map(l => l.textContent.trim());
  expect(labels.slice(0, 5)).toEqual([
    'First Name *',
    'Last Name *',
    'Date of Birth *',
    'Parent/Guardian Name *',
    'Contact Phone Number *'
  ]);
});

test('shows age as text under the birth date, with no read-only age box', () => {
  const { container } = renderNewPatientForm();
  expect(screen.queryByPlaceholderText(/age will be calculated/i)).toBeNull();
  fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2018-03-14' } });
  expect(screen.getByText(/^Age: \d+ years$/)).toBeInTheDocument();
});
