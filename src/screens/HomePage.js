import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, ChevronRight, HardDrive, UserCog, X, Search, Building2, List } from 'lucide-react';
import { usePatients, usePatientData } from '../context/PatientDataContext';
import { useProfile } from '../context/ProfileContext';
import PatientActionsMenu from '../components/PatientActionsMenu';
import { useStartSession } from '../hooks/useStartSession';
import { parseAppDate, toDateInputValue, formatShortDate, isPatientDueThisWeek } from '../utils/sessionFormatting';
import { getAppMeta, daysSince } from '../utils/appMeta';

const BACKUP_NUDGE_AFTER_DAYS = 7;
const NO_SCHOOL_GROUP = 'No school';

const HomePage = () => {
  const navigate = useNavigate();
  const patients = usePatients();
  const { getSchoolById, sessions } = usePatientData();
  const startSession = useStartSession();
  const { profile, isLoading: profileLoading } = useProfile();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBySchool, setGroupBySchool] = useState(true);
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

  const getSchoolName = (patient) => {
    if (patient.schoolId) {
      const school = getSchoolById(patient.schoolId);
      if (school) return school.name;
    }
    return patient.school || '';
  };

  const byName = (a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);

  const filteredPatients = useMemo(() => {
    const sorted = [...patients].sort(byName);
    if (!searchTerm.trim()) return sorted;
    const term = searchTerm.toLowerCase().trim();
    return sorted.filter(patient =>
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(term) ||
      (patient.diagnosis && patient.diagnosis.toLowerCase().includes(term))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, searchTerm]);

  // School-name groups, alphabetical, with unassigned patients last
  const groupedPatients = useMemo(() => {
    if (!groupBySchool) return null;
    const groups = new Map();
    filteredPatients.forEach(patient => {
      const name = getSchoolName(patient) || NO_SCHOOL_GROUP;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(patient);
    });
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === NO_SCHOOL_GROUP) return 1;
      if (b[0] === NO_SCHOOL_GROUP) return -1;
      return a[0].localeCompare(b[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPatients, groupBySchool]);

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

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-xl font-semibold text-gray-700">Patients</h3>
          {patients.length > 0 && (
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
              <button
                onClick={() => setGroupBySchool(true)}
                className={`flex items-center gap-1.5 px-3 py-2 ${
                  groupBySchool ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Building2 size={16} />
                By school
              </button>
              <button
                onClick={() => setGroupBySchool(false)}
                className={`flex items-center gap-1.5 px-3 py-2 ${
                  !groupBySchool ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List size={16} />
                A–Z
              </button>
            </div>
          )}
        </div>

        {patients.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

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
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No patients match your search.</p>
          </div>
        ) : groupBySchool ? (
          <div className="space-y-6">
            {groupedPatients.map(([schoolName, group]) => (
              <div key={schoolName}>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={16} className="text-gray-400" />
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    {schoolName}
                  </h4>
                  <span className="text-xs text-gray-400">({group.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.map(patient => renderPatientCard(patient, false))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPatients.map(patient => renderPatientCard(patient, true))}
          </div>
        )}
      </div>
    </div>
  );

  function renderPatientCard(patient, showSchool) {
    const schoolName = showSchool ? getSchoolName(patient) : '';
    return (
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
          <h4 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            {patient.firstName} {patient.lastName}
            {isPatientDueThisWeek(patient, sessions) && (
              <span
                className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold"
                title={`Seen fewer than ${patient.visitFrequency.timesPerWeek}× this week`}
              >
                Due
              </span>
            )}
          </h4>
          <p className="text-sm text-gray-600">Age: {calculateAge(patient.dob)} years</p>
          <p className="text-sm text-gray-600">Diagnosis: {patient.diagnosis || 'Not specified'}</p>
          {schoolName && (
            <p className="text-sm text-gray-600">School: {schoolName}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Last session: {patient.lastSessionDate
              ? formatShortDate(patient.lastSessionDate)
              : 'No sessions yet'
            }
          </p>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => startSession(patient.id, { referrer: 'home', sessionDate: selectedDate })}
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
    );
  }
};

export default HomePage;
