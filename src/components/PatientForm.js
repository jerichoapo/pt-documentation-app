import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';

const PatientForm = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { addPatient, updatePatient, getPatientById, getSchoolSuggestions } = usePatientData();

  const isEditMode = !!patientId;
  const existingPatient = isEditMode ? getPatientById(patientId) : null;

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    diagnosis: '',
    guardianName: '',
    guardianPhone: '',
    notes: '',
    grade: '',
    school: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolSuggestions, setSchoolSuggestions] = useState([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [schoolInputValue, setSchoolInputValue] = useState('');

  // Sync school input value with formData.school
  useEffect(() => {
    setSchoolInputValue(formData.school);
  }, [formData.school]);

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
        notes: existingPatient.notes || '',
        grade: existingPatient.grade || '',
        school: existingPatient.school || ''
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

  const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Apply formatting: (xxx) xxx - xxxx
    if (digits.length >= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6, 10)}`;
    } else if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length > 0) {
      return `(${digits}`;
    }

    return '';
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

    if (!formData.guardianName.trim()) {
      newErrors.guardianName = 'Parent/Guardian name is required';
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

      // Ensure year is limited to 4 digits
      const year = formData.dob.split('-')[0];
      if (year && year.length > 4) {
        newErrors.dob = 'Year must be 4 digits or less';
      }
    }

    // Phone validation (required field)
    if (!formData.guardianPhone || !formData.guardianPhone.trim()) {
      newErrors.guardianPhone = 'Contact phone number is required';
    } else {
      const normalized = normalizePhoneNumber(formData.guardianPhone);
      if (normalized.length !== 10) {
        newErrors.guardianPhone = 'Please enter a valid 10-digit phone number';
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
        notes: formData.notes,
        grade: formData.grade,
        school: formData.school
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
            notes: formData.notes,
            grade: formData.grade,
            school: formData.school
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
        notes: formData.notes.trim(),
        grade: formData.grade,
        school: formData.school.trim()
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

  const handleSchoolInputChange = (value) => {
    setSchoolInputValue(value);
    setFormData(prev => ({ ...prev, school: value }));

    // Get suggestions if input is long enough
    if (value.trim().length >= 2) {
      const suggestions = getSchoolSuggestions(value.trim(), 10);
      setSchoolSuggestions(suggestions);
      setShowSchoolSuggestions(true);
    } else {
      setSchoolSuggestions([]);
      setShowSchoolSuggestions(false);
    }

    // Clear error when user starts typing
    if (errors.school) {
      setErrors(prev => ({ ...prev, school: '' }));
    }
  };

  const handleSchoolSuggestionSelect = (suggestion) => {
    setSchoolInputValue(suggestion.name);
    setFormData(prev => ({ ...prev, school: suggestion.name }));
    setShowSchoolSuggestions(false);
  };

  const handleSchoolInputBlur = () => {
    // Delay hiding suggestions to allow for click selection
    setTimeout(() => setShowSchoolSuggestions(false), 150);
  };

  const handleInputChange = (field, value) => {
    let processedValue = value;

    // Special handling for phone number formatting
    if (field === 'guardianPhone') {
      processedValue = formatPhoneNumber(value);
    }

    // Special handling for DOB year limitation
    if (field === 'dob' && value) {
      // Split date into components: YYYY-MM-DD
      const parts = value.split('-');
      if (parts.length >= 1) {
        // Limit year to 4 digits maximum
        parts[0] = parts[0].substring(0, 4);
        processedValue = parts.join('-');
      }
    }

    setFormData(prev => ({ ...prev, [field]: processedValue }));
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

          {/* Grade and School */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade
              </label>
              <select
                value={formData.grade}
                onChange={(e) => handleInputChange('grade', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select grade (optional)</option>
                <option value="K">K</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="11">11</option>
                <option value="12">12</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                School
              </label>
              <input
                type="text"
                value={schoolInputValue}
                onChange={(e) => handleSchoolInputChange(e.target.value)}
                onBlur={handleSchoolInputBlur}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter school name (optional)"
              />
              {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {schoolSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSchoolSuggestionSelect(suggestion)}
                    >
                      {suggestion.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Guardian Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent/Guardian Name *
              </label>
              <input
                type="text"
                value={formData.guardianName}
                onChange={(e) => handleInputChange('guardianName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.guardianName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter guardian name"
              />
              {errors.guardianName && (
                <p className="mt-1 text-sm text-red-600">{errors.guardianName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Phone Number *
              </label>
              <input
                type="tel"
                value={formData.guardianPhone}
                onChange={(e) => handleInputChange('guardianPhone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.guardianPhone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="(555) 123 - 4567"
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
