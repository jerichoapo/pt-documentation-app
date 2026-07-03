import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, MapPin, Users } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';

const SchoolsListPage = () => {
  const navigate = useNavigate();
  const {
    schools,
    isLoading,
    searchSchools,
    getPatientCountForSchool,
    createGoogleMapsUrl,
    deleteSchool
  } = usePatientData();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Debounced search
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtered and sorted schools
  const filteredSchools = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return schools;
    }
    return searchSchools(debouncedSearchQuery, { sortBy, sortOrder });
  }, [schools, debouncedSearchQuery, sortBy, sortOrder, searchSchools]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleDeleteClick = (school) => {
    setDeleteConfirm(school);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteSchool(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error) {
      // Error handling is done in the context
    }
  };

  const handlePatientCountClick = (schoolId) => {
    navigate(`/patients?schoolId=${schoolId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading schools...</div>
      </div>
    );
  }

  const deleteConfirmPatientCount = deleteConfirm ? getPatientCountForSchool(deleteConfirm.id) : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Schools</h1>
        <Link
          to="/schools/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
        >
          <Plus size={20} />
          Add School
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="🔍 Search schools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Schools Table */}
      {filteredSchools.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            {searchQuery ? 'No schools found matching your search.' : 'No schools have been added yet.'}
          </div>
          <Link
            to="/schools/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus size={20} />
            Add Your First School
          </Link>
        </div>
      ) : (
        <>
        {/* Card list on narrow screens */}
        <div className="md:hidden bg-white shadow-sm rounded-lg overflow-hidden divide-y divide-gray-200">
          {filteredSchools.map((school) => {
            const patientCount = getPatientCountForSchool(school.id);
            const mapsUrl = createGoogleMapsUrl(school);
            const address = `${school.street_address}, ${school.city}, ${school.state} ${school.zip_code}`;

            return (
              <div key={school.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/schools/${school.id}`}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {school.name}
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      to={`/schools/${school.id}/edit`}
                      className="h-11 w-11 inline-flex items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50"
                      aria-label={`Edit ${school.name}`}
                    >
                      <Edit size={18} />
                    </Link>
                    <button
                      onClick={() => handleDeleteClick(school)}
                      className="h-11 w-11 inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      aria-label={`Delete ${school.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                {school.street_address && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                  >
                    <MapPin size={14} className="flex-shrink-0" />
                    {address}
                  </a>
                )}
                <div className="text-sm text-gray-600 mt-1">
                  {school.point_of_contact}{school.phone ? ` · ${school.phone}` : ''}
                </div>
                <button
                  onClick={() => handlePatientCountClick(school.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2"
                >
                  <Users size={14} />
                  {patientCount} patient{patientCount !== 1 ? 's' : ''}
                </button>
              </div>
            );
          })}
        </div>

        {/* Table on md+ */}
        <div className="hidden md:block bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  School Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Point of Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('patient_count')}
                >
                  Patients {sortBy === 'patient_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSchools.map((school) => {
                const patientCount = getPatientCountForSchool(school.id);
                const mapsUrl = createGoogleMapsUrl(school);
                const address = `${school.street_address}, ${school.city}, ${school.state} ${school.zip_code}`;

                return (
                  <tr key={school.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/schools/${school.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {school.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {school.street_address && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <MapPin size={14} />
                            {address}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{school.point_of_contact}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{school.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handlePatientCountClick(school.id)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Users size={14} />
                        {patientCount}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/schools/${school.id}/edit`}
                          className="h-11 w-11 inline-flex items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50"
                          aria-label={`Edit ${school.name}`}
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => handleDeleteClick(school)}
                          className="h-11 w-11 inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                          aria-label={`Delete ${school.name}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete School</h3>
            <p className="text-gray-600 mb-4">
              Move "{deleteConfirm.name}" to Recently Deleted? You can restore it within 30 days.
            </p>
            {deleteConfirmPatientCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-800 text-sm">
                  ⚠️ This school has {deleteConfirmPatientCount} assigned patient{deleteConfirmPatientCount === 1 ? '' : 's'}.
                  You must reassign {deleteConfirmPatientCount === 1 ? 'this patient' : 'these patients'} to other schools before deleting.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmPatientCount > 0}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move to Recently Deleted
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolsListPage;
