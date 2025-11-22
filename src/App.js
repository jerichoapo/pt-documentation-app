import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { User } from 'lucide-react';
import HomePage from './screens/HomePage';
import PatientsListPage from './screens/PatientsListPage';
import PatientDetailPage from './screens/PatientDetailPage';
import SessionWizard from './screens/SessionWizard';
import SessionDetailPage from './screens/SessionDetailPage';
import RecentlyDeletedPage from './screens/RecentlyDeletedPage';
import DeletedPatientDetailPage from './screens/DeletedPatientDetailPage';
import DeletedSessionDetailPage from './screens/DeletedSessionDetailPage';
import ProfilePage from './screens/ProfilePage';
import PatientForm from './components/PatientForm';
import ErrorModal from './components/ErrorModal';
import { usePatientData } from './context/PatientDataContext';

const App = () => {
  const { error, clearError, clearAllData, exportData } = usePatientData();
  const handleClearData = () => {
    if (window.confirm('This will permanently delete all data. Are you sure?')) {
      clearAllData();
      clearError();
    }
  };

  const handleExportData = () => {
    const data = exportData();
    const dataBlob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pt-app-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Pediatric Therapy Notes</h1>
              <p className="text-sm text-gray-600">Structured session documentation system</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Home
              </Link>
              <Link
                to="/recently-deleted"
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Recently Deleted
              </Link>
              <Link
                to="/settings/profile"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                <User size={20} />
                My Profile
              </Link>
              <Link
                to="/patients/new"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                + Add Patient
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="py-8 px-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/patients" element={<PatientsListPage />} />
          <Route path="/patients/new" element={<PatientForm />} />
          <Route path="/patients/:patientId" element={<PatientDetailPage />} />
          <Route path="/patients/:patientId/edit" element={<PatientForm />} />
          <Route path="/sessions/new/:patientId/:section?" element={<SessionWizard />} />
          <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
          <Route path="/recently-deleted" element={<RecentlyDeletedPage />} />
          <Route path="/recently-deleted/patients/:patientId" element={<DeletedPatientDetailPage />} />
          <Route path="/recently-deleted/sessions/:sessionId" element={<DeletedSessionDetailPage />} />
          <Route path="/settings/profile" element={<ProfilePage />} />
        </Routes>
      </main>

      <ErrorModal
        error={error}
        onClearData={handleClearData}
        onExportData={handleExportData}
        onDismiss={clearError}
      />
    </div>
  );
};

export default App;