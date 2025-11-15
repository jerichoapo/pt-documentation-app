import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';

const PatientForm = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { addPatient, updatePatient, getPatientById } = usePatientData();

  const isEditMode = !!patientId;
  const existingPatient = isEditMode ? getPatientById(patientId) : null;

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    diagnosis: '',
    guardianName: '',
    guardianPhone: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with existing patient data in edit mode
  useEffect(() => {
    if (existingPatient) {
      setFormData({
        firstName: existingPatient.firstName || '',
        lastName: existingPatient.lastName || '',
        dob: existingPatient.dob ? new Date(existingPatient.dob).toISOString().split('T')[0] : '',
        diagnosis: existingPatient.diagnosis || '',
        guardianName: existingPatient.guardianName || '',
        guardianPhone: existingPatient.guardianPhone || '',
        notes: existingPatient.notes || ''
      });
    }
  }, [existingPatient]);

  const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 0 ? `${age} years` : '';
  };

  const normalizePhoneNumber = (phone) => {
    // Remove all non-digit characters
    return phone.replace(/\D/g, '');
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.dob) {
      newErrors.dob = 'Date of birth is required';
    } else {
      const birthDate = new Date(formData.dob);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

      if (birthDate >= today) {
        newErrors.dob = 'Date of birth cannot be in the future';
      }
    }

    // Phone validation (optional field, but validate format if provided)
    if (formData.guardianPhone && formData.guardianPhone.trim()) {
      const normalized = normalizePhoneNumber(formData.guardianPhone);
      if (normalized.length < 10) {
        newErrors.guardianPhone = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkForDuplicates = async () => {
    if (isEditMode) return true; // Skip duplicate check in edit mode

    try {
      // Try to add the patient - this will throw if duplicate found
      await addPatient({
        firstName: formData.firstName,
        lastName: formData.lastName,
        dob: formData.dob,
        diagnosis: formData.diagnosis,
        guardianName: formData.guardianName,
        guardianPhone: formData.guardianPhone,
        notes: formData.notes
      });
      return true;
    } catch (error) {
      if (error.message.startsWith('DUPLICATE_PATIENT:')) {
        // Show warning dialog
        const shouldContinue = window.confirm(
          'A patient with this name and birthdate already exists. Continue anyway?'
        );
        if (shouldContinue) {
          // Try again with skip duplicate check
          await addPatient({
            firstName: formData.firstName,
            lastName: formData.lastName,
            dob: formData.dob,
            diagnosis: formData.diagnosis,
            guardianName: formData.guardianName,
            guardianPhone: formData.guardianPhone,
            notes: formData.notes
          }, { skipDuplicateCheck: true });
          return true;
        }
        return false; // User chose not to continue
      }
      // Re-throw other errors
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const processedData = {
        ...formData,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        diagnosis: formData.diagnosis.trim(),
        guardianName: formData.guardianName.trim(),
        guardianPhone: formData.guardianPhone ? normalizePhoneNumber(formData.guardianPhone) : '',
        notes: formData.notes.trim()
      };

      if (isEditMode) {
        await updatePatient(patientId, processedData);
        navigate(`/patients/${patientId}`);
      } else {
        // For new patients, checkForDuplicates handles the duplicate detection and patient creation
        const success = await checkForDuplicates();
        if (success) {
          navigate('/patients');
        }
      }
    } catch (error) {
      console.error('Failed to save patient:', error);
      alert('Failed to save patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (isEditMode && !existingPatient) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Patient Not Found</h2>
        <p className="text-gray-600">The patient you're trying to edit could not be found.</p>
        <button
          onClick={() => navigate('/patients')}
          className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Back to Patients
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(isEditMode ? `/patients/${patientId}` : '/patients')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to {isEditMode ? 'Patient' : 'Patients'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          {isEditMode ? 'Edit Patient' : 'Add New Patient'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter first name"
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter last name"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* DOB and Age */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth *
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => handleInputChange('dob', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.dob ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.dob && (
                <p className="mt-1 text-sm text-red-600">{errors.dob}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age
              </label>
              <input
                type="text"
                value={calculateAge(formData.dob)}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                placeholder="Age will be calculated"
              />
            </div>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Diagnosis
            </label>
            <input
              type="text"
              value={formData.diagnosis}
              onChange={(e) => handleInputChange('diagnosis', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter diagnosis (optional)"
            />
          </div>

          {/* Guardian Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent/Guardian Name
              </label>
              <input
                type="text"
                value={formData.guardianName}
                onChange={(e) => handleInputChange('guardianName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter guardian name (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Phone Number
              </label>
              <input
                type="tel"
                value={formData.guardianPhone}
                onChange={(e) => handleInputChange('guardianPhone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.guardianPhone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="(555) 123-4567"
              />
              {errors.guardianPhone && (
                <p className="mt-1 text-sm text-red-600">{errors.guardianPhone}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter any additional notes (optional)"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Patient' : 'Add Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientForm;
