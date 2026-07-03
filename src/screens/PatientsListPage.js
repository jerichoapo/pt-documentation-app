import React, { useState, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, X } from 'lucide-react';
import { usePatients, usePatientData } from '../context/PatientDataContext';
import { parseAppDate, formatShortDate } from '../utils/sessionFormatting';

const PatientsListPage = () => {
  const navigate = useNavigate();
  const patients = usePatients();
  const { getSchoolById } = usePatientData();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const schoolIdFilter = searchParams.get('schoolId');
  const filterSchool = schoolIdFilter ? getSchoolById(schoolIdFilter) : null;

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

  const getSchoolName = (patient) => {
    if (patient.schoolId) {
      const school = getSchoolById(patient.schoolId);
      if (school) return school.name;
    }
    return patient.school || '';
  };

  const filteredPatients = useMemo(() => {
    let result = patients;

    if (schoolIdFilter) {
      result = result.filter(patient => patient.schoolId === schoolIdFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(patient =>
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(term) ||
        (patient.diagnosis && patient.diagnosis.toLowerCase().includes(term))
      );
    }

    return result;
  }, [patients, searchTerm, schoolIdFilter]);

  const clearSchoolFilter = () => {
    searchParams.delete('schoolId');
    setSearchParams(searchParams, { replace: true });
  };

  const handlePatientClick = (patientId) => {
    navigate(`/patients/${patientId}`);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Patients</h1>
        <Link
          to="/patients/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
        >
          <Plus size={20} />
          Add Patient
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or diagnosis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {schoolIdFilter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              School: {filterSchool ? filterSchool.name : 'Unknown school'}
              <button
                onClick={clearSchoolFilter}
                className="hover:text-blue-600"
                aria-label="Clear school filter"
              >
                <X size={14} />
              </button>
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredPatients.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 mb-4">
              {patients.length === 0
                ? "No patients found. Add your first patient to get started."
                : "No patients match your search criteria."
              }
            </p>
            {patients.length === 0 && (
              <Link
                to="/patients/new"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium inline-flex items-center gap-2"
              >
                <Plus size={20} />
                Add Patient
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Age</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Diagnosis</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Grade</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">School</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Last Session</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPatients.map(patient => (
                  <tr
                    key={patient.id}
                    onClick={() => handlePatientClick(patient.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {patient.firstName} {patient.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {calculateAge(patient.dob)} years
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {patient.diagnosis || 'Not specified'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {patient.grade || 'Not specified'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {getSchoolName(patient) || 'Not specified'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {patient.lastSessionDate
                          ? formatShortDate(patient.lastSessionDate)
                          : 'No sessions'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {patient.sessionCount || 0}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientsListPage;
