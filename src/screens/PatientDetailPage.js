import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Plus, Calendar, FileText, Clock } from 'lucide-react';
import { usePatient, useSessionsForPatient, usePatientData } from '../context/PatientDataContext';
import { formatDate, formatTimeRange, getSessionDurationMinutes, formatDuration } from '../utils/sessionFormatting';
import { useStartSession } from '../hooks/useStartSession';

const PatientDetailPage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const patient = usePatient(patientId);
  const { softDeletePatient } = usePatientData();
  const allSessions = useSessionsForPatient(patientId);
  const startSession = useStartSession();

  const [visibleSessions, setVisibleSessions] = useState(10);
  const sessionsToShow = allSessions.slice(0, visibleSessions);

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

  const handleEditPatient = () => {
    navigate(`/patients/${patientId}/edit`);
  };

  const handleDeletePatient = async () => {
    const sessionCount = allSessions.length;

    let confirmMessage = `Move ${patient.firstName} ${patient.lastName} to Recently Deleted?`;
    if (sessionCount > 0) {
      confirmMessage = `Move ${patient.firstName} ${patient.lastName} and ${sessionCount} session note${sessionCount === 1 ? '' : 's'} to Recently Deleted?`;
    }

    if (window.confirm(confirmMessage)) {
      try {
        await softDeletePatient(patientId);
        navigate('/');
      } catch (error) {
        console.error('Failed to delete patient:', error);
        alert('Failed to delete patient. Please try again.');
      }
    }
  };

  const handleViewSession = (sessionId) => {
    navigate(`/sessions/${sessionId}`);
  };

  const handleLoadMore = () => {
    setVisibleSessions(prev => prev + 10);
  };


  if (!patient) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Patient Not Found</h2>
        <p className="text-gray-600">The patient you're looking for could not be found.</p>
        <Link
          to="/patients"
          className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Patients
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/patients"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Patients
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleEditPatient}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
          >
            <Edit2 size={16} />
            Edit
          </button>
          <button
            onClick={handleDeletePatient}
            className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 font-medium"
          >
            <Trash2 size={16} />
            Delete Patient
          </button>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            {patient.firstName} {patient.lastName}
          </h1>
          <button
            onClick={() => startSession(patientId)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
          >
            <Plus size={20} />
            Start New Session
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <p className="text-lg text-gray-900">{calculateAge(patient.dob)} years</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <p className="text-lg text-gray-900">{new Date(patient.dob).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
              <p className="text-lg text-gray-900">{patient.diagnosis || 'Not specified'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent/Guardian</label>
              <p className="text-lg text-gray-900">{patient.guardianName || 'Not specified'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <p className="text-lg text-gray-900">{patient.guardianPhone || 'Not specified'}</p>
            </div>
            {patient.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <p className="text-lg text-gray-900">{patient.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Session History ({patient.sessionCount || 0} total)
        </h2>

        {allSessions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 mb-4">No sessions recorded yet.</p>
            <button
              onClick={() => startSession(patientId)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Start First Session
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessionsToShow.map(session => (
              <div
                key={session.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="text-blue-600" size={16} />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(new Date(session.sessionDate))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Clock size={16} />
                      <span>
                        {formatTimeRange(session.startTime, session.endTime)}
                        {getSessionDurationMinutes(session.startTime, session.endTime) > 0 && (
                          <span className="ml-2 text-blue-600">
                            ({formatDuration(getSessionDurationMinutes(session.startTime, session.endTime))})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewSession(session.id)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium text-sm"
                  >
                    View →
                  </button>
                </div>
              </div>
            ))}

            {visibleSessions < allSessions.length && (
              <div className="text-center pt-4">
                <button
                  onClick={handleLoadMore}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Load More Sessions
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDetailPage;
