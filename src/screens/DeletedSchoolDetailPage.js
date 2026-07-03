import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Trash2, Calendar, Clock, MapPin, Phone, Mail, User as ContactIcon } from 'lucide-react';
import { useDeletedSchool, usePatientData } from '../context/PatientDataContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatDate } from '../utils/sessionFormatting';

const DeletedSchoolDetailPage = () => {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const school = useDeletedSchool(schoolId);
  const { restoreSchool, permanentlyDeleteSchool, createGoogleMapsUrl, formatPhoneNumber } = usePatientData();
  const confirm = useConfirm();

  const daysUntilPermanentDeletion = () => {
    if (!school?.permanently_deleted_at) return 0;
    const now = new Date();
    const expiration = new Date(school.permanently_deleted_at);
    const diffTime = expiration - now;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleRestore = async () => {
    const confirmed = await confirm({
      title: 'Restore school?',
      message: `Restore ${school.name}?`,
      confirmLabel: 'Restore'
    });
    if (confirmed) {
      try {
        await restoreSchool(schoolId);
        navigate('/recently-deleted');
      } catch (error) {
        console.error('Failed to restore school:', error);
        // Error toast is shown by the context
      }
    }
  };

  const handlePermanentDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete permanently?',
      message: `Permanently delete ${school.name}? This action cannot be undone and the data will be lost forever.`,
      confirmLabel: 'Delete Permanently',
      danger: true
    });
    if (confirmed) {
      try {
        await permanentlyDeleteSchool(schoolId);
        navigate('/recently-deleted');
      } catch (error) {
        console.error('Failed to permanently delete school:', error);
        // Error toast is shown by the context
      }
    }
  };

  if (!school) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Deleted School Not Found</h2>
        <p className="text-gray-600">The deleted school you're looking for could not be found.</p>
        <Link
          to="/recently-deleted"
          className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Recently Deleted
        </Link>
      </div>
    );
  }

  const mapsUrl = createGoogleMapsUrl(school);
  const address = `${school.street_address}, ${school.city}, ${school.state} ${school.zip_code}`;

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
            Deleted on {formatDate(new Date(school.deleted_at))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Clock size={16} />
            Will be permanently deleted in {daysUntilPermanentDeletion()} day{daysUntilPermanentDeletion() !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* School Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 opacity-75">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">{school.name}</h1>
        </div>

        <div className="space-y-6">
          {/* Address */}
          {school.street_address && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
              >
                <MapPin size={18} />
                <span>{address}</span>
              </a>
            </div>
          )}

          {/* Point of Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Point of Contact</label>
            <div className="flex items-center gap-2 text-gray-900">
              <ContactIcon size={18} />
              <span>{school.point_of_contact}</span>
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <div className="flex items-center gap-2 text-gray-900">
                <Phone size={18} />
                <a href={`tel:${school.phone}`} className="text-blue-600 hover:text-blue-800">
                  {formatPhoneNumber(school.phone)}
                </a>
              </div>
            </div>

            {school.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="flex items-center gap-2 text-gray-900">
                  <Mail size={18} />
                  <a href={`mailto:${school.email}`} className="text-blue-600 hover:text-blue-800">
                    {school.email}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {school.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <p className="text-gray-900 whitespace-pre-wrap">{school.notes}</p>
            </div>
          )}
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
            Restore School
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

export default DeletedSchoolDetailPage;
