import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';

const PatientActionsMenu = ({ patientId, patientName }) => {
  const navigate = useNavigate();
  const { deletePatient, getSessionsForPatient } = usePatientData();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleViewAllNotes = () => {
    navigate(`/patients/${patientId}`);
    setIsOpen(false);
  };

  const handleEditPatient = () => {
    navigate(`/patients/${patientId}/edit`);
    setIsOpen(false);
  };

  const handleDeletePatient = async () => {
    const sessions = getSessionsForPatient(patientId);
    const sessionCount = sessions.length;

    let confirmMessage = `Move ${patientName} to Recently Deleted?`;
    if (sessionCount > 0) {
      confirmMessage = `Move ${patientName} and ${sessionCount} session note${sessionCount === 1 ? '' : 's'} to Recently Deleted?`;
    }

    if (window.confirm(confirmMessage)) {
      try {
        await deletePatient(patientId);
        navigate('/');
      } catch (error) {
        console.error('Failed to delete patient:', error);
        alert('Failed to delete patient. Please try again.');
      }
    }

    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Patient actions"
      >
        <MoreVertical size={20} className="text-gray-600" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
          <div className="py-1">
            <button
              onClick={handleViewAllNotes}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              View All Notes
            </button>
            <button
              onClick={handleEditPatient}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Edit Patient
            </button>
            <button
              onClick={handleDeletePatient}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete Patient
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientActionsMenu;
