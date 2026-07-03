import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Edit, ArrowLeft, Users, ChevronRight } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';
import { formatShortDate } from '../utils/sessionFormatting';

const SchoolProfilePage = () => {
  const { schoolId } = useParams();
  const { getSchoolById, getPatientsForSchool, isLoading } = usePatientData();

  const school = getSchoolById(schoolId);
  const assignedPatients = [...getPatientsForSchool(schoolId)].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading school...</div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">School Not Found</h1>
          <p className="text-gray-600 mb-6">The requested school could not be found.</p>
          <Link
            to="/schools"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Schools
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">School Profile</h1>
        <div className="flex items-center gap-3">
          <Link
            to={`/schools/${schoolId}/edit`}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <Edit size={20} />
            Edit School
          </Link>
          <Link
            to="/schools"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Schools
          </Link>
        </div>
      </div>

      {/* School Information */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        {/* School Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            School Name
          </label>
          <div className="px-3 py-2 bg-gray-50 text-gray-900 font-medium">
            {school.name}
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900">Address</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address
            </label>
            <div className="px-3 py-2 bg-gray-50 text-gray-900">
              {school.street_address}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <div className="px-3 py-2 bg-gray-50 text-gray-900">
                {school.city}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <div className="px-3 py-2 bg-gray-50 text-gray-900">
                {school.state}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIP Code
            </label>
            <div className="px-3 py-2 bg-gray-50 text-gray-900">
              {school.zip_code}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Point of Contact
            </label>
            <div className="px-3 py-2 bg-gray-50 text-gray-900">
              {school.point_of_contact}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="px-3 py-2 bg-gray-50 text-gray-900">
                {school.phone}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="px-3 py-2 bg-gray-50 text-gray-900">
                {school.email || 'Not provided'}
              </div>
            </div>
          </div>

          {/* Notes */}
          {school.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <div className="px-3 py-2 bg-gray-50 text-gray-900 whitespace-pre-wrap">
                {school.notes}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assigned Patients */}
      <div className="bg-white shadow-sm rounded-lg p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-gray-500" size={20} />
          <h3 className="text-lg font-medium text-gray-900">
            Assigned Patients ({assignedPatients.length})
          </h3>
        </div>

        {assignedPatients.length === 0 ? (
          <p className="text-gray-600 text-sm py-2">No patients assigned to this school.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {assignedPatients.map(patient => (
              <Link
                key={patient.id}
                to={`/patients/${patient.id}`}
                className="flex items-center justify-between py-3 px-2 -mx-2 rounded-lg hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {patient.firstName} {patient.lastName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {patient.grade ? `Grade ${patient.grade}` : 'Grade not specified'}
                    {' · '}
                    {patient.lastSessionDate
                      ? `Last session ${formatShortDate(patient.lastSessionDate)}`
                      : 'No sessions yet'}
                  </div>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0" size={18} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolProfilePage;
