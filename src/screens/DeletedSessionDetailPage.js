import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Trash2, Calendar, Clock, User } from 'lucide-react';
import { useDeletedSession, usePatientData } from '../context/PatientDataContext';
import { useToastContext } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatDate, formatTimeRange, getSessionDurationMinutes, formatDuration } from '../utils/sessionFormatting';
import RestoreNoteDecisionModal from '../components/RestoreNoteDecisionModal';

const DeletedSessionDetailPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const session = useDeletedSession(sessionId);
  const { getDeletedPatientById, restoreSession, restorePatient, permanentlyDeleteSession, getRecentlyDeletedSessions } = usePatientData();
  const { addToast } = useToastContext();
  const confirm = useConfirm();

  // Modal state
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  const patient = session ? getDeletedPatientById(session.patientId) : null;

  const daysUntilPermanentDeletion = () => {
    if (!session?.permanently_deleted_at) return 0;
    const now = new Date();
    const expiration = new Date(session.permanently_deleted_at);
    const diffTime = expiration - now;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleRestore = async () => {
    if (patient && patient.deleted_at) {
      // Patient is deleted, show decision modal
      setRestoreModalOpen(true);
    } else {
      // Patient not deleted, restore normally
      const confirmed = await confirm({
        title: 'Restore note?',
        message: 'Restore this note to the patient record?',
        confirmLabel: 'Restore'
      });
      if (confirmed) {
        try {
          await restoreSession(sessionId);
          navigate('/recently-deleted');
        } catch (error) {
          console.error('Failed to restore session:', error);
          // Error toast is shown by the context
        }
      }
    }
  };

  const handleModalConfirm = async (selectedOption) => {
    try {
      const patientName = `${patient.firstName} ${patient.lastName}`;

      if (selectedOption === 'note-only') {
        // Restore only the note
        await restoreSession(sessionId, {
          skipToast: true // Skip default toast, show custom one
        });
        addToast(`Note restored successfully. This note won't appear in ${patientName}'s profile until the patient is restored.`, 'success');
        navigate('/recently-deleted');
      } else {
        // Restore note and patient
        await restorePatient(patient.id);
        // Navigate to patient profile (existing restorePatient handles the toast)
        navigate(`/patients/${patient.id}`);
      }
    } catch (error) {
      console.error('Failed to restore:', error);
      // Error toast is shown by the context
    } finally {
      setRestoreModalOpen(false);
    }
  };

  const handleModalCancel = () => {
    setRestoreModalOpen(false);
  };

  const handlePermanentDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete permanently?',
      message: 'Permanently delete this note? This action cannot be undone and the data will be lost forever.',
      confirmLabel: 'Delete Permanently',
      danger: true
    });
    if (confirmed) {
      try {
        await permanentlyDeleteSession(sessionId);
        navigate('/recently-deleted');
      } catch (error) {
        console.error('Failed to permanently delete session:', error);
        // Error toast is shown by the context
      }
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Deleted Session Not Found</h2>
        <p className="text-gray-600">The deleted session you're looking for could not be found.</p>
        <Link
          to="/recently-deleted"
          className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Recently Deleted
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/recently-deleted"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Recently Deleted
        </Link>
      </div>

      {/* Deleted Banner */}
      <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-red-800 font-semibold">
          <Trash2 size={20} />
          DELETED
        </div>
        <div className="mt-2 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <Calendar size={16} />
            Deleted on {formatDate(session.deleted_at)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Clock size={16} />
            Will be permanently deleted in {daysUntilPermanentDeletion()} day{daysUntilPermanentDeletion() !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8 opacity-75">
        <div className="mb-6 pb-4 border-b-2">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <User size={28} />
            {patient ? (
              <>
                {patient.firstName} {patient.lastName}
                {patient.deleted_at && (
                  <span className="text-red-600 text-sm">(Deleted)</span>
                )}
              </>
            ) : (
              'Patient not found'
            )}
          </h1>
          <div className="text-lg text-gray-700 mb-4">
            {patient?.diagnosis || 'No diagnosis'}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>{formatDate(session.sessionDate)}</span>
            </div>
            <div className="flex items-center gap-2">
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
        </div>

        <div className="space-y-8">
          {/* Subjective */}
          <div className="border-l-4 border-purple-600 pl-6">
            <h3 className="text-xl font-bold text-purple-600 mb-3">SUBJECTIVE</h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {session.subjective || 'No subjective notes recorded.'}
            </div>
          </div>

          {/* Objective */}
          <div className="border-l-4 border-blue-600 pl-6">
            <h3 className="text-xl font-bold text-blue-600 mb-3">OBJECTIVE</h3>

            {/* Categories */}
            {session.objectiveCategories && Object.values(session.objectiveCategories).some(Boolean) && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">Objective Categories:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(session.objectiveCategories).map(([key, isSelected]) => {
                    if (!isSelected) return null;

                    const categoryLabels = {
                      balance: 'Balance & Coordination',
                      motorSkills: 'Gross Motor Skills',
                      therapeuticActivities: 'Therapeutic Activities',
                      transfers: 'Transfers & Positioning',
                      classroomMobility: 'Classroom Mobility'
                    };

                    return (
                      <span
                        key={key}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                      >
                        {categoryLabels[key] || key}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Objective Notes */}
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {session.objectiveNotes || 'No objective observations recorded.'}
            </div>
          </div>

          {/* Assessment */}
          <div className="border-l-4 border-orange-600 pl-6">
            <h3 className="text-xl font-bold text-orange-600 mb-3">ASSESSMENT</h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {session.assessment || 'No assessment recorded.'}
            </div>
          </div>

          {/* Plan */}
          <div className="border-l-4 border-green-600 pl-6">
            <h3 className="text-xl font-bold text-green-600 mb-3">PLAN</h3>
            <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {session.plan || 'No treatment plan recorded.'}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Actions</h2>
        <div className="flex gap-4">
          <button
            onClick={handleRestore}
            className="flex items-center gap-2 bg-blue-100 text-blue-700 px-6 py-3 rounded-lg hover:bg-blue-200 font-medium"
          >
            <RotateCcw size={20} />
            Restore Note
          </button>
          <button
            onClick={handlePermanentDelete}
            className="flex items-center gap-2 bg-red-100 text-red-700 px-6 py-3 rounded-lg hover:bg-red-200 font-medium"
          >
            <Trash2 size={20} />
            Delete Permanently
          </button>
        </div>
      </div>

      {/* Restore Decision Modal */}
      {patient && patient.deleted_at && (
        <RestoreNoteDecisionModal
          isOpen={restoreModalOpen}
          onClose={handleModalCancel}
          onConfirm={handleModalConfirm}
          patientName={`${patient.firstName} ${patient.lastName}`}
          additionalNotesCount={(() => {
            const sessions = getRecentlyDeletedSessions();
            return sessions.filter(s => s.patientId === patient.id && s.deleted_with_patient_id === patient.id).length;
          })()}
        />
      )}
    </div>
  );
};

export default DeletedSessionDetailPage;
