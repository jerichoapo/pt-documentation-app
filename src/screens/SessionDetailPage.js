import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Edit2, Save, X, Trash2, Download } from 'lucide-react';
import { useSession, usePatient, usePatientData } from '../context/PatientDataContext';
import { useProfile } from '../context/ProfileContext';
import { useToastContext } from '../context/ToastContext';
import { formatDate, formatTimeRange, getSessionDurationMinutes, formatDuration, toDateInputValue } from '../utils/sessionFormatting';
import { exportSingleNoteToPDF, exportSingleNoteToDOCX } from '../utils/exportNotes';
import ExportFormatModal from '../components/ExportFormatModal';

const SessionDetailPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const session = useSession(sessionId);
  const patient = usePatient(session?.patientId ?? '');
  const { updateSession, softDeleteSession } = usePatientData();
  const { profile } = useProfile();
  const { addToast } = useToastContext();

  const [isEditing, setIsEditing] = useState(false);
  const [editedSession, setEditedSession] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Initialize edited session when session loads
  useEffect(() => {
    if (session && !editedSession) {
      setEditedSession({
        ...session,
        sessionDate: session.sessionDate ? toDateInputValue(session.sessionDate) : ''
      });
    }
  }, [session, editedSession]);

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedSession({
      ...session,
      sessionDate: session.sessionDate ? toDateInputValue(session.sessionDate) : ''
    });
    setIsEditing(false);
  };

  const getMissingSections = () => {
    const missing = [];
    if (!editedSession?.subjective?.trim()) missing.push('Subjective');
    const hasCategory = Object.values(editedSession?.objectiveCategories || {}).some(Boolean);
    if (!hasCategory || !editedSession?.objectiveNotes?.trim()) missing.push('Objective');
    if (!editedSession?.assessment?.trim()) missing.push('Assessment');
    if (!editedSession?.plan?.trim()) missing.push('Plan');
    return missing;
  };

  const handleSave = async () => {
    if (!editedSession) return;

    if (!editedSession.sessionDate) {
      addToast('Please select a valid session date before saving.', 'warning');
      return;
    }

    const missingSections = getMissingSections();
    if (missingSections.length > 0) {
      addToast(`Cannot save. Missing required sections: ${missingSections.join(', ')}`, 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await updateSession(sessionId, {
        sessionDate: editedSession.sessionDate,
        startTime: editedSession.startTime || null,
        endTime: editedSession.endTime || null,
        subjective: editedSession.subjective?.trim() || '',
        objectiveCategories: editedSession.objectiveCategories || {},
        objectiveNotes: editedSession.objectiveNotes?.trim() || '',
        assessment: editedSession.assessment?.trim() || '',
        plan: editedSession.plan?.trim() || '',
        therExMinutes: editedSession.therExMinutes || 0,
        therActMinutes: editedSession.therActMinutes || 0
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update session:', error);
      // Error toast is shown by the context
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Move this note to Recently Deleted?')) {
      try {
        await softDeleteSession(sessionId);
        navigate(`/patients/${patient.id}`);
      } catch (error) {
        console.error('Failed to delete session:', error);
        // Error toast is shown by the context
      }
    }
  };

  const updateEditedSession = (field, value) => {
    setEditedSession(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExportNote = async (format) => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        await exportSingleNoteToPDF(session, patient, profile);
      } else if (format === 'docx') {
        await exportSingleNoteToDOCX(session, patient, profile);
      }
      addToast('Note exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export note:', error);
      addToast('Failed to export note. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Session Not Found</h2>
        <p className="text-gray-600">The session you're looking for could not be found.</p>
        <Link
          to="/"
          className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (!patient || !patient.id) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Patient Not Found</h2>
        <p className="text-gray-600">The patient associated with this session could not be found.</p>
        <Link
          to="/"
          className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to={`/patients/${patient.id}`}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to {patient.firstName} {patient.lastName}
        </Link>
        <div className="flex items-center gap-3">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 font-medium"
              >
                <Download size={16} />
                Download Note
              </button>
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 font-medium"
              >
                <Edit2 size={16} />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 font-medium"
              >
                <Trash2 size={16} />
                Delete Note
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={16} />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="mb-6 pb-4 border-b-2">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-lg text-gray-700 mb-4">
            {patient.diagnosis}
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              {isEditing ? (
                <input
                  type="date"
                  value={editedSession?.sessionDate || ''}
                  onChange={(e) => updateEditedSession('sessionDate', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span>{formatDate(session.sessionDate)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={editedSession?.startTime || ''}
                    onChange={(e) => updateEditedSession('startTime', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span>-</span>
                  <input
                    type="time"
                    value={editedSession?.endTime || ''}
                    onChange={(e) => updateEditedSession('endTime', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <span>
                  {formatTimeRange(session.startTime, session.endTime)}
                  {getSessionDurationMinutes(session.startTime, session.endTime) > 0 && (
                    <span className="ml-2 text-blue-600">
                      ({formatDuration(getSessionDurationMinutes(session.startTime, session.endTime))})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
            <div>
              <strong>TherEx:</strong> {isEditing ? (
                <input
                  type="number"
                  min="0"
                  value={editedSession?.therExMinutes || 0}
                  onChange={(e) => updateEditedSession('therExMinutes', Math.max(0, parseInt(e.target.value) || 0))}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-16"
                />
              ) : (
                <span className="ml-2">{session.therExMinutes || 0} minutes</span>
              )}
            </div>
            <div>
              <strong>TherAct:</strong> {isEditing ? (
                <input
                  type="number"
                  min="0"
                  value={editedSession?.therActMinutes || 0}
                  onChange={(e) => updateEditedSession('therActMinutes', Math.max(0, parseInt(e.target.value) || 0))}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-16"
                />
              ) : (
                <span className="ml-2">{session.therActMinutes || 0} minutes</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Subjective */}
          <div className="border-l-4 border-purple-600 pl-6">
            <h3 className="text-xl font-bold text-purple-600 mb-3">SUBJECTIVE</h3>
            {isEditing ? (
              <textarea
                value={editedSession?.subjective || ''}
                onChange={(e) => updateEditedSession('subjective', e.target.value)}
                placeholder="Document the child's reported symptoms, feelings, and caregiver observations..."
                className="w-full h-32 p-3 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none text-base"
              />
            ) : (
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {session.subjective || 'No subjective notes recorded.'}
              </div>
            )}
          </div>

          {/* Objective */}
          <div className="border-l-4 border-blue-600 pl-6">
            <h3 className="text-xl font-bold text-blue-600 mb-3">OBJECTIVE</h3>

            {/* Categories */}
            {isEditing ? (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-600 mb-2">Objective Categories:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: 'balance', label: 'Balance & Coordination' },
                    { key: 'motorSkills', label: 'Gross Motor Skills' },
                    { key: 'therapeuticActivities', label: 'Therapeutic Activities' },
                    { key: 'transfers', label: 'Transfers & Positioning' },
                    { key: 'classroomMobility', label: 'Classroom Mobility' }
                  ].map(option => (
                    <button
                      key={option.key}
                      onClick={() => {
                        const currentCategories = editedSession?.objectiveCategories || {};
                        updateEditedSession('objectiveCategories', {
                          ...currentCategories,
                          [option.key]: !currentCategories[option.key]
                        });
                      }}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        editedSession?.objectiveCategories?.[option.key]
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{option.label}</span>
                        {editedSession?.objectiveCategories?.[option.key] && (
                          <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              session.objectiveCategories && Object.values(session.objectiveCategories).some(Boolean) && (
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
              )
            )}

            {/* Objective Notes */}
            {isEditing ? (
              <textarea
                value={editedSession?.objectiveNotes || ''}
                onChange={(e) => updateEditedSession('objectiveNotes', e.target.value)}
                placeholder="Document measurable observations from the session..."
                className="w-full h-32 p-3 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
              />
            ) : (
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {session.objectiveNotes || 'No objective observations recorded.'}
              </div>
            )}
          </div>

          {/* Assessment */}
          <div className="border-l-4 border-orange-600 pl-6">
            <h3 className="text-xl font-bold text-orange-600 mb-3">ASSESSMENT</h3>
            {isEditing ? (
              <textarea
                value={editedSession?.assessment || ''}
                onChange={(e) => updateEditedSession('assessment', e.target.value)}
                placeholder="Analyze the child's performance and progress toward goals..."
                className="w-full h-32 p-3 border-2 border-gray-300 rounded-lg focus:border-orange-600 focus:outline-none text-base"
              />
            ) : (
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {session.assessment || 'No assessment recorded.'}
              </div>
            )}
          </div>

          {/* Plan */}
          <div className="border-l-4 border-green-600 pl-6">
            <h3 className="text-xl font-bold text-green-600 mb-3">PLAN</h3>
            {isEditing ? (
              <textarea
                value={editedSession?.plan || ''}
                onChange={(e) => updateEditedSession('plan', e.target.value)}
                placeholder="Document treatment plan and next steps..."
                className="w-full h-32 p-3 border-2 border-gray-300 rounded-lg focus:border-green-600 focus:outline-none text-base"
              />
            ) : (
              <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {session.plan || 'No treatment plan recorded.'}
              </div>
            )}
          </div>
        </div>
      </div>

      <ExportFormatModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportNote}
        isExporting={isExporting}
        title="Download Session Note"
      />
    </div>
  );
};

export default SessionDetailPage;
