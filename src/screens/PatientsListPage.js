import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { usePatients } from '../context/PatientDataContext';

const PatientsListPage = () => {
  const navigate = useNavigate();
  const patients = usePatients();
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) {
      return patients;
    }

    const term = searchTerm.toLowerCase().trim();
    return patients.filter(patient =>
      `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(term) ||
      (patient.diagnosis && patient.diagnosis.toLowerCase().includes(term))
    );
  }, [patients, searchTerm]);

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
                        {patient.lastSessionDate
                          ? new Date(patient.lastSessionDate).toLocaleDateString()
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
