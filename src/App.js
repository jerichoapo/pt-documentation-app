import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './screens/HomePage';
import PatientsListPage from './screens/PatientsListPage';
import PatientDetailPage from './screens/PatientDetailPage';
import SessionWizard from './screens/SessionWizard';
import SessionDetailPage from './screens/SessionDetailPage';
import RecentlyDeletedPage from './screens/RecentlyDeletedPage';
import DeletedPatientDetailPage from './screens/DeletedPatientDetailPage';
import DeletedSessionDetailPage from './screens/DeletedSessionDetailPage';
import DeletedSchoolDetailPage from './screens/DeletedSchoolDetailPage';
import ProfilePage from './screens/ProfilePage';
import SettingsPage from './screens/SettingsPage';
import SchoolsListPage from './screens/SchoolsListPage';
import AddSchoolPage from './screens/AddSchoolPage';
import EditSchoolPage from './screens/EditSchoolPage';
import SchoolProfilePage from './screens/SchoolProfilePage';
import PatientForm from './components/PatientForm';
import ErrorModal from './components/ErrorModal';
import AppHeader from './components/AppHeader';
import BottomNav from './components/BottomNav';
import SyncBanner from './components/SyncBanner';
import { usePatientData } from './context/PatientDataContext';
import { useConfirm } from './context/ConfirmContext';
import { useSync } from './context/SyncContext';

const App = () => {
  const { error, clearError, clearAllData, exportData } = usePatientData();
  const confirm = useConfirm();
  const { reloadFromCloud } = useSync();
  const handleClearData = async () => {
    const confirmed = await confirm({
      title: 'Delete all data?',
      message: 'This will permanently delete all patients, notes, and schools, on this device and in the cloud. This cannot be undone.',
      confirmLabel: 'Delete Everything',
      danger: true
    });
    if (confirmed) {
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
      <AppHeader />
      <SyncBanner />

      <main className="py-6 px-4 pb-24 sm:pb-8">
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
          <Route path="/recently-deleted/schools/:schoolId" element={<DeletedSchoolDetailPage />} />
          <Route path="/schools" element={<SchoolsListPage />} />
          <Route path="/schools/new" element={<AddSchoolPage />} />
          <Route path="/schools/:schoolId" element={<SchoolProfilePage />} />
          <Route path="/schools/:schoolId/edit" element={<EditSchoolPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<ProfilePage />} />
        </Routes>
      </main>

      <BottomNav />

      <ErrorModal
        error={error}
        onClearData={handleClearData}
        onExportData={handleExportData}
        onDismiss={clearError}
        onReloadFromCloud={() => {
          clearError();
          reloadFromCloud();
        }}
      />
    </div>
  );
};

export default App;