import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, RotateCcw, Trash2, Calendar, User, FileText, Building2 } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';
import { useToastContext } from '../context/ToastContext';
import { formatDate } from '../utils/sessionFormatting';
import RestoreNoteDecisionModal from '../components/RestoreNoteDecisionModal';

const RecentlyDeletedPage = () => {
  const {
    getRecentlyDeletedPatients,
    getRecentlyDeletedSessions,
    getRecentlyDeletedSchools,
    restorePatient,
    restoreSession,
    restoreSchool,
    permanentlyDeletePatient,
    permanentlyDeleteSession,
    permanentlyDeleteSchool,
    getDeletedPatientById
  } = usePatientData();
  const { addToast } = useToastContext();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('patients');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Modal state
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoringSession, setRestoringSession] = useState(null);

  const patients = useMemo(() => getRecentlyDeletedPatients(), [getRecentlyDeletedPatients]);
  const sessions = useMemo(() => getRecentlyDeletedSessions(), [getRecentlyDeletedSessions]);
  const schools = useMemo(() => getRecentlyDeletedSchools(), [getRecentlyDeletedSchools]);

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;
    const term = searchTerm.toLowerCase().trim();
    return patients.filter(patient =>
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(term) ||
      (patient.diagnosis && patient.diagnosis.toLowerCase().includes(term))
    );
  }, [patients, searchTerm]);

  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions;
    const term = searchTerm.toLowerCase().trim();
    return sessions.filter(session =>
      session.subjective?.toLowerCase().includes(term) ||
      session.objectiveNotes?.toLowerCase().includes(term) ||
      session.assessment?.toLowerCase().includes(term) ||
      session.plan?.toLowerCase().includes(term)
    );
  }, [sessions, searchTerm]);

  const filteredSchools = useMemo(() => {
    if (!searchTerm.trim()) return schools;
    const term = searchTerm.toLowerCase().trim();
    return schools.filter(school =>
      school.name?.toLowerCase().includes(term) ||
      school.city?.toLowerCase().includes(term) ||
      school.point_of_contact?.toLowerCase().includes(term)
    );
  }, [schools, searchTerm]);

  const currentItems = activeTab === 'patients' ? filteredPatients : activeTab === 'sessions' ? filteredSessions : filteredSchools;
  const hasItems = currentItems.length > 0;
  const hasSelectedItems = selectedItems.size > 0;

  const handleSelectItem = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === currentItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentItems.map(item => item.id)));
    }
  };

  const handleRestore = async (id) => {
    try {
      if (activeTab === 'patients') {
        await restorePatient(id);
      } else if (activeTab === 'sessions') {
        // Check if the session's patient is deleted
        const session = sessions.find(s => s.id === id);
        const patient = session ? getDeletedPatientById(session.patientId) : null;

        if (patient && patient.deleted_at) {
          // Show decision modal
          setRestoringSession(session);
          setRestoreModalOpen(true);
        } else {
          // Patient not deleted, restore session normally
          await restoreSession(id);
        }
      } else {
        await restoreSchool(id);
      }
    } catch (error) {
      // Error handled by context
    }
  };

  const handleModalConfirm = async (selectedOption) => {
    if (!restoringSession) return;

    try {
      const patient = getDeletedPatientById(restoringSession.patientId);
      const patientName = `${patient.firstName} ${patient.lastName}`;

      if (selectedOption === 'note-only') {
        // Restore only the note
        await restoreSession(restoringSession.id, {
          skipToast: true // Skip default toast, show custom one
        });
        addToast(`Note restored successfully. This note won't appear in ${patientName}'s profile until the patient is restored.`, 'success');
        // Stay on Recently Deleted page
      } else {
        // Restore note and patient
        await restorePatient(patient.id);
        // Navigate to patient profile (existing restorePatient handles the toast)
        navigate(`/patients/${patient.id}`);
      }
    } catch (error) {
      // Error handled by context
    } finally {
      setRestoreModalOpen(false);
      setRestoringSession(null);
    }
  };

  const handleModalCancel = () => {
    setRestoreModalOpen(false);
    setRestoringSession(null);
  };

  const handlePermanentDelete = async (id) => {
    const itemName = activeTab === 'patients'
      ? `${currentItems.find(p => p.id === id)?.firstName} ${currentItems.find(p => p.id === id)?.lastName}`
      : activeTab === 'schools'
        ? currentItems.find(s => s.id === id)?.name
        : 'this note';

    if (window.confirm(`Permanently delete ${itemName}? This action cannot be undone and the data will be lost forever.`)) {
      try {
        if (activeTab === 'patients') {
          await permanentlyDeletePatient(id);
        } else if (activeTab === 'sessions') {
          await permanentlyDeleteSession(id);
        } else {
          await permanentlyDeleteSchool(id);
        }
      } catch (error) {
        // Error handled by context
      }
    }
  };

  const handleBulkRestore = async () => {
    const count = selectedItems.size;

    let confirmMessage = `Restore ${count} ${activeTab}?`;
    if (activeTab === 'sessions') {
      const orphanCount = [...selectedItems].filter(id => {
        const session = sessions.find(s => s.id === id);
        const patient = session ? getDeletedPatientById(session.patientId) : null;
        return patient && patient.deleted_at;
      }).length;
      if (orphanCount > 0) {
        confirmMessage = `Restore ${count} notes? ${orphanCount} of them belong to deleted patients and won't appear anywhere until those patients are restored.`;
      }
    }

    if (window.confirm(confirmMessage)) {
      for (const id of selectedItems) {
        try {
          if (activeTab === 'patients') {
            await restorePatient(id);
          } else if (activeTab === 'sessions') {
            await restoreSession(id);
          } else {
            await restoreSchool(id);
          }
        } catch (error) {
          // Continue with other items
        }
      }
      setSelectedItems(new Set());
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedItems.size;
    if (window.confirm(`Permanently delete ${count} ${activeTab}? This action cannot be undone and the data will be lost forever.`)) {
      for (const id of selectedItems) {
        try {
          if (activeTab === 'patients') {
            await permanentlyDeletePatient(id);
          } else if (activeTab === 'sessions') {
            await permanentlyDeleteSession(id);
          } else {
            await permanentlyDeleteSchool(id);
          }
        } catch (error) {
          // Continue with other items
        }
      }
      setSelectedItems(new Set());
    }
  };

  const handleEmptyTrash = async () => {
    const count = currentItems.length;
    if (window.confirm(`Permanently delete all ${count} ${activeTab}? This action cannot be undone and the data will be lost forever.`)) {
      for (const item of currentItems) {
        try {
          if (activeTab === 'patients') {
            await permanentlyDeletePatient(item.id);
          } else if (activeTab === 'sessions') {
            await permanentlyDeleteSession(item.id);
          } else {
            await permanentlyDeleteSchool(item.id);
          }
        } catch (error) {
          // Continue with other items
        }
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Recently Deleted</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              setActiveTab('patients');
              setSelectedItems(new Set());
              setSearchTerm('');
            }}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'patients'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Patients ({patients.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('sessions');
              setSelectedItems(new Set());
              setSearchTerm('');
            }}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Notes ({sessions.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('schools');
              setSelectedItems(new Set());
              setSearchTerm('');
            }}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'schools'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Schools ({schools.length})
          </button>
        </div>

        {/* Search */}
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {hasItems && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedItems.size === currentItems.length && currentItems.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({currentItems.length})
                </span>
              </label>
              {hasSelectedItems && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkRestore}
                    className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 font-medium text-sm"
                  >
                    <RotateCcw size={16} />
                    Restore ({selectedItems.size})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200 font-medium text-sm"
                  >
                    <Trash2 size={16} />
                    Delete Permanently ({selectedItems.size})
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleEmptyTrash}
              className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200 font-medium text-sm"
            >
              <Trash2 size={16} />
              Empty Trash
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {!hasItems ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 mb-4">
              No {activeTab} in Recently Deleted.
            </p>
            <Link
              to="/"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium inline-flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-12"></th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    {activeTab === 'patients' ? 'Patient' : activeTab === 'sessions' ? 'Note' : 'School'}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Deleted</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Days Left</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 opacity-75">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {activeTab === 'patients' ? (
                          <>
                            <User className="text-gray-400" size={20} />
                            <div>
                              <Link
                                to={`/recently-deleted/patients/${item.id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {item.firstName} {item.lastName}
                              </Link>
                              {item.diagnosis && (
                                <div className="text-sm text-gray-600">{item.diagnosis}</div>
                              )}
                            </div>
                          </>
                        ) : activeTab === 'sessions' ? (
                          <>
                            <FileText className="text-gray-400" size={20} />
                            <div>
                              <Link
                                to={`/recently-deleted/sessions/${item.id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                Session on {formatDate(item.sessionDate)}
                              </Link>
                              <div className="text-sm text-gray-600">
                                {item.subjective?.substring(0, 50)}
                                {item.subjective?.length > 50 && '...'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <Building2 className="text-gray-400" size={20} />
                            <div>
                              <Link
                                to={`/recently-deleted/schools/${item.id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {item.name}
                              </Link>
                              <div className="text-sm text-gray-600">
                                {item.city && item.state && `${item.city}, ${item.state}`}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={16} />
                        {formatDate(item.deleted_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-medium">
                        {item.daysUntilPermanentDeletion} day{item.daysUntilPermanentDeletion !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestore(item.id)}
                          className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 font-medium text-sm"
                        >
                          <RotateCcw size={14} />
                          Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(item.id)}
                          className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200 font-medium text-sm"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore Decision Modal */}
      {restoringSession && (
        <RestoreNoteDecisionModal
          isOpen={restoreModalOpen}
          onClose={handleModalCancel}
          onConfirm={handleModalConfirm}
          patientName={(() => {
            const patient = getDeletedPatientById(restoringSession.patientId);
            return patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
          })()}
          additionalNotesCount={(() => {
            if (!restoringSession) return 0;
            const patient = getDeletedPatientById(restoringSession.patientId);
            if (!patient) return 0;
            return sessions.filter(s => s.patientId === patient.id && s.deleted_with_patient_id === patient.id).length;
          })()}
        />
      )}
    </div>
  );
};

export default RecentlyDeletedPage;
