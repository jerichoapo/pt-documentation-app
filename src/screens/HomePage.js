import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, ChevronRight, MoreVertical } from 'lucide-react';
import { usePatients } from '../context/PatientDataContext';
import PatientActionsMenu from '../components/PatientActionsMenu';
import { useStartSession } from '../hooks/useStartSession';

const HomePage = () => {
  const navigate = useNavigate();
  const patients = usePatients();
  const startSession = useStartSession();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const calculateAge = (dob) => {
    const birthDate = new Date(dob);
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
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
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
                      ? new Date(patient.lastSessionDate).toLocaleDateString()
                      : 'No sessions yet'
                    }
                  </p>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => startSession(patient.id)}
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
