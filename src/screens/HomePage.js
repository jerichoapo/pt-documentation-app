import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, ChevronRight, HardDrive, UserCog, X } from 'lucide-react';
import { usePatients } from '../context/PatientDataContext';
import { useProfile } from '../context/ProfileContext';
import PatientActionsMenu from '../components/PatientActionsMenu';
import { useStartSession } from '../hooks/useStartSession';
import { parseAppDate, toDateInputValue, formatShortDate } from '../utils/sessionFormatting';
import { getAppMeta, daysSince } from '../utils/appMeta';

const BACKUP_NUDGE_AFTER_DAYS = 7;

const HomePage = () => {
  const navigate = useNavigate();
  const patients = usePatients();
  const startSession = useStartSession();
  const { profile, isLoading: profileLoading } = useProfile();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [backupNudgeDismissed, setBackupNudgeDismissed] = useState(
    () => sessionStorage.getItem('ptAppBackupNudgeDismissed') === '1'
  );

  const lastBackupAt = getAppMeta().lastBackupAt || null;
  const backupAge = daysSince(lastBackupAt);
  const showBackupNudge =
    !backupNudgeDismissed &&
    patients.length > 0 &&
    (backupAge === null || backupAge >= BACKUP_NUDGE_AFTER_DAYS);
  const showProfileNudge = !profileLoading && !profile?.firstName;

  const dismissBackupNudge = () => {
    sessionStorage.setItem('ptAppBackupNudgeDismissed', '1');
    setBackupNudgeDismissed(true);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const calculateAge = (dob) => {
    const birthDate = parseAppDate(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const handleViewPatient = (patientId) => {
    navigate(`/patients/${patientId}`);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {showBackupNudge && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <HardDrive size={18} className="flex-shrink-0" />
            <span>
              {lastBackupAt
                ? `Last backup: ${backupAge} day${backupAge !== 1 ? 's' : ''} ago.`
                : 'Your data has never been backed up.'}{' '}
              <Link to="/settings" className="font-semibold underline hover:text-amber-900">
                Download a backup
              </Link>
            </span>
          </div>
          <button
            onClick={dismissBackupNudge}
            className="text-amber-600 hover:text-amber-800 flex-shrink-0"
            aria-label="Dismiss backup reminder"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {showProfileNudge && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-800">
          <UserCog size={18} className="flex-shrink-0" />
          <span>
            Add your provider info so exported notes are signed.{' '}
            <Link to="/settings/profile" className="font-semibold underline hover:text-blue-900">
              Set up profile
            </Link>
          </span>
        </div>
      )}

      <h2 className="text-3xl font-bold text-gray-800 mb-6">Select Patient & Session</h2>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-700">Session Date</h3>
          <div className="flex items-center gap-2">
            <Calendar className="text-blue-600" size={24} />
            <span className="text-lg font-medium text-gray-700">{formatDate(selectedDate)}</span>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Session Date</label>
          <input
            type="date"
            value={toDateInputValue(selectedDate)}
            onChange={(e) => { if (e.target.value) setSelectedDate(parseAppDate(e.target.value)); }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mb-6">
        <Link
          to="/patients"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-lg"
        >
          Manage All Patients →
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Patients</h3>
        {patients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No patients found. Add your first patient to get started.</p>
            <Link
              to="/patients/new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
            >
              + Add Patient
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patients.map(patient => (
              <div
                key={patient.id}
                className="p-6 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:shadow-md transition-all relative"
              >
                <div className="absolute top-4 right-4">
                  <PatientActionsMenu
                    patientId={patient.id}
                    patientName={`${patient.firstName} ${patient.lastName}`}
                  />
                </div>

                <div className="pr-8">
                  <h4 className="text-lg font-bold text-gray-800 mb-2">
                    {patient.firstName} {patient.lastName}
                  </h4>
                  <p className="text-sm text-gray-600">Age: {calculateAge(patient.dob)} years</p>
                  <p className="text-sm text-gray-600">Diagnosis: {patient.diagnosis || 'Not specified'}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Last session: {patient.lastSessionDate
                      ? formatShortDate(patient.lastSessionDate)
                      : 'No sessions yet'
                    }
                  </p>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => startSession(patient.id, 'home', selectedDate)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                  >
                    Start Session
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => handleViewPatient(patient.id)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    View ↗
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
