import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Trash2, Calendar, Clock } from 'lucide-react';
import { useDeletedPatient, usePatientData } from '../context/PatientDataContext';
import { formatDate } from '../utils/sessionFormatting';

const DeletedPatientDetailPage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const patient = useDeletedPatient(patientId);
  const { restorePatient, permanentlyDeletePatient } = usePatientData();

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

  const daysUntilPermanentDeletion = () => {
    if (!patient?.permanently_deleted_at) return 0;
    const now = new Date();
    const expiration = new Date(patient.permanently_deleted_at);
    const diffTime = expiration - now;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleRestore = async () => {
    if (window.confirm('Restore this patient?')) {
      try {
        await restorePatient(patientId);
        navigate('/recently-deleted');
      } catch (error) {
        console.error('Failed to restore patient:', error);
        alert('Failed to restore patient. Please try again.');
      }
    }
  };

  const handlePermanentDelete = async () => {
    if (window.confirm(`Permanently delete ${patient.firstName} ${patient.lastName}? This action cannot be undone and the data will be lost forever.`)) {
      try {
        await permanentlyDeletePatient(patientId);
        navigate('/recently-deleted');
      } catch (error) {
        console.error('Failed to permanently delete patient:', error);
        alert('Failed to permanently delete patient. Please try again.');
      }
    }
  };

  if (!patient) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Deleted Patient Not Found</h2>
        <p className="text-gray-600">The deleted patient you're looking for could not be found.</p>
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
            Deleted on {formatDate(new Date(patient.deleted_at))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Clock size={16} />
            Will be permanently deleted in {daysUntilPermanentDeletion()} day{daysUntilPermanentDeletion() !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 opacity-75">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            {patient.firstName} {patient.lastName}
          </h1>
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

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Actions</h2>
        <div className="flex gap-4">
          <button
            onClick={handleRestore}
            className="flex items-center gap-2 bg-blue-100 text-blue-700 px-6 py-3 rounded-lg hover:bg-blue-200 font-medium"
          >
            <RotateCcw size={20} />
            Restore Patient
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
    </div>
  );
};

export default DeletedPatientDetailPage;
