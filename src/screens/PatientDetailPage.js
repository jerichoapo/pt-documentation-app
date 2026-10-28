import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit2, Trash2, Plus, Calendar, FileText, Clock, Download, Copy, ChevronDown } from 'lucide-react';
import { usePatient, useSessionsForPatient, usePatientData } from '../context/PatientDataContext';
import { useProfile } from '../context/ProfileContext';
import { useToastContext } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatMediumDate, formatShortDate, formatTimeRange, getSessionDurationMinutes, formatDuration, formatDisplayPhone, formatAge } from '../utils/sessionFormatting';
import { useStartSession } from '../hooks/useStartSession';
import { exportBulkNotesToPDF, exportBulkNotesToDOCX } from '../utils/exportNotes';
import ExportFormatModal from '../components/ExportFormatModal';
import BackLink from '../components/BackLink';

const PatientDetailPage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const patient = usePatient(patientId);
  const { softDeletePatient, getSchoolById } = usePatientData();
  const allSessions = useSessionsForPatient(patientId);
  const startSession = useStartSession();
  const { profile } = useProfile();
  const { addToast } = useToastContext();
  const confirm = useConfirm();

  const [visibleSessions, setVisibleSessions] = useState(10);
  const sessionsToShow = allSessions.slice(0, visibleSessions);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleEditPatient = () => {
    navigate(`/patients/${patientId}/edit`);
  };

  const handleDeletePatient = async () => {
    const sessionCount = allSessions.length;

    let confirmMessage = `Move ${patient.firstName} ${patient.lastName} to Recently Deleted?`;
    if (sessionCount > 0) {
      confirmMessage = `Move ${patient.firstName} ${patient.lastName} and ${sessionCount} session note${sessionCount === 1 ? '' : 's'} to Recently Deleted?`;
    }

    const confirmed = await confirm({
      title: 'Delete patient?',
      message: `${confirmMessage} You can restore them within 30 days.`,
      confirmLabel: 'Move to Recently Deleted',
      danger: true
    });
    if (confirmed) {
      try {
        await softDeletePatient(patientId);
        navigate('/');
      } catch (error) {
        console.error('Failed to delete patient:', error);
        // Error toast is shown by the context
      }
    }
  };

  const handleViewSession = (sessionId) => {
    navigate(`/sessions/${sessionId}`);
  };

  const handleLoadMore = () => {
    setVisibleSessions(prev => prev + 10);
  };

  const handleExportAllNotes = async (format) => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        await exportBulkNotesToPDF(allSessions, patient, profile);
      } else if (format === 'docx') {
        await exportBulkNotesToDOCX(allSessions, patient, profile);
      }
      addToast('All notes exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export notes:', error);
      addToast('Failed to export notes. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
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

  const school = patient.schoolId ? getSchoolById(patient.schoolId) : null;
  const schoolName = school?.name || patient.school || 'Not specified';

  const detailRow = (label, value, field) => (
    <div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-base text-gray-900" data-field={field}>{value}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <BackLink to="/patients" label="Patients" />
        <div className="flex gap-2">
          <button
            onClick={handleEditPatient}
            className="flex items-center gap-2 min-h-[44px] bg-gray-100 text-gray-700 px-4 rounded-lg hover:bg-gray-200 font-medium"
          >
            <Edit2 size={16} />
            Edit
          </button>
          <button
            onClick={handleDeletePatient}
            className="flex items-center gap-2 min-h-[44px] bg-red-100 text-red-700 px-4 rounded-lg hover:bg-red-200 font-medium"
          >
            <Trash2 size={16} />
            <span className="sm:hidden">Delete</span>
            <span className="hidden sm:inline">Delete Patient</span>
          </button>
        </div>
      </div>

      {/* Name and the two ways to start a note */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              {patient.firstName} {patient.lastName}
            </h1>
            {patient.diagnosis && (
              <p className="text-lg text-gray-700 mt-1">{patient.diagnosis}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {allSessions.length > 0 && (
              <button
                onClick={() => startSession(patientId, { copyFrom: allSessions[0].id })}
                title="Start a new session prefilled with the most recent note"
                className="w-full sm:w-auto min-h-[44px] justify-center bg-blue-50 text-blue-700 border border-blue-200 px-5 py-2 rounded-lg hover:bg-blue-100 font-medium flex items-center gap-2"
              >
                <Copy size={20} />
                Start from Last Session
              </button>
            )}
            <button
              onClick={() => startSession(patientId)}
              className="w-full sm:w-auto min-h-[44px] justify-center bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Plus size={20} />
              Start New Session
            </button>
          </div>
        </div>
      </div>

      {/* Session History */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            Session History ({patient.sessionCount || 0} total)
          </h2>
          {allSessions.length > 0 && (
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 min-h-[44px] bg-green-100 text-green-700 px-4 rounded-lg hover:bg-green-200 font-medium"
            >
              <Download size={16} />
              Download All Notes
            </button>
          )}
        </div>

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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="text-blue-600 shrink-0" size={16} />
                      <span className="text-sm font-medium text-gray-900">
                        {formatMediumDate(session.sessionDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Clock className="shrink-0" size={16} />
                      <span>
                        {formatTimeRange(session.startTime, session.endTime)}
                        {getSessionDurationMinutes(session.startTime, session.endTime) > 0 && (
                          <span className="ml-2 text-blue-600">
                            ({formatDuration(getSessionDurationMinutes(session.startTime, session.endTime))})
                          </span>
                        )}
                      </span>
                    </div>
                    {session.assessment && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{session.assessment}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleViewSession(session.id)}
                    className="shrink-0 min-h-[44px] bg-gray-100 text-gray-700 px-4 rounded-lg hover:bg-gray-200 font-medium text-sm"
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

      {/* Therapy Goals */}
      {(patient.goals || []).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Therapy Goals</h2>
          <ul className="space-y-3">
            {patient.goals.map(goal => (
              <li key={goal.id} className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    goal.status === 'active'
                      ? 'bg-blue-100 text-blue-800'
                      : goal.status === 'met'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {goal.status === 'active' ? 'Active' : goal.status === 'met' ? 'Met' : 'Discontinued'}
                </span>
                <span className={`text-gray-900 ${goal.status !== 'active' ? 'line-through text-gray-500' : ''}`}>
                  {goal.text}
                </span>
                {goal.targetDate && (
                  <span className="text-sm text-gray-500">target {formatShortDate(goal.targetDate)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Demographics, folded away: she comes here to write or re-read notes */}
      <details className="bg-white rounded-lg shadow-md mb-6 group">
        <summary className="px-6 min-h-[44px] flex items-center justify-between cursor-pointer text-xl font-bold text-gray-800 list-none">
          Details
          <ChevronDown className="text-gray-500 transition-transform group-open:rotate-180" size={20} />
        </summary>
        <div className="px-6 pb-6 pt-2 grid grid-cols-1 md:grid-cols-2 gap-5">
          {detailRow('Age', formatAge(patient.dob), 'age')}
          {detailRow('Date of Birth', formatShortDate(patient.dob), 'dob')}
          {detailRow('Parent/Guardian', patient.guardianName || 'Not specified', 'guardian')}
          {detailRow('Contact Phone', patient.guardianPhone ? formatDisplayPhone(patient.guardianPhone) : 'Not specified', 'phone')}
          {detailRow('Grade', patient.grade || 'Not specified', 'grade')}
          {detailRow('School', schoolName, 'school')}
          {patient.notes && (
            <div className="md:col-span-2">
              {detailRow('Additional Notes', patient.notes, 'notes')}
            </div>
          )}
        </div>
      </details>

      <ExportFormatModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportAllNotes}
        isExporting={isExporting}
        title="Download All Session Notes"
        warning={!profile?.firstName ? (
          <span>
            Exports will show "Provider: N/A" —{' '}
            <Link to="/settings/profile" className="font-semibold underline">set up your profile</Link>{' '}
            to sign your notes.
          </span>
        ) : null}
      />
    </div>
  );
};

export default PatientDetailPage;
