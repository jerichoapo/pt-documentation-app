import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Input formatting helpers
const formatPhoneNumber = (value) => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX
  if (digits.length >= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  } else if (digits.length >= 3) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else if (digits.length > 0) {
    return `(${digits}`;
  }

  return digits;
};

const formatZipCode = (value) => {
  // Remove all non-digit characters and limit to 5 digits
  return value.replace(/\D/g, '').slice(0, 5);
};

const SchoolForm = ({ schoolId, isEdit = false }) => {
  const navigate = useNavigate();
  const { createSchool, updateSchool, getSchoolById, isLoading } = usePatientData();

  const [formData, setFormData] = useState({
    name: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    point_of_contact: '',
    phone: '',
    email: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing school data for edit mode
  useEffect(() => {
    if (isEdit && schoolId) {
      const school = getSchoolById(schoolId);
      if (school) {
        setFormData({
          name: school.name || '',
          street_address: school.street_address || '',
          city: school.city || '',
          state: school.state || '',
          zip_code: school.zip_code || '',
          point_of_contact: school.point_of_contact || '',
          phone: school.phone || '',
          email: school.email || '',
          notes: school.notes || ''
        });
      } else {
        // School not found, redirect to list
        navigate('/schools');
      }
    }
  }, [isEdit, schoolId, getSchoolById, navigate]);

  const validateField = (name, value) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'name':
        if (!value.trim()) {
          newErrors.name = 'School name is required';
        } else {
          delete newErrors.name;
        }
        break;

      case 'street_address':
        if (!value.trim()) {
          newErrors.street_address = 'Street address is required';
        } else {
          delete newErrors.street_address;
        }
        break;

      case 'city':
        if (!value.trim()) {
          newErrors.city = 'City is required';
        } else {
          delete newErrors.city;
        }
        break;

      case 'state':
        if (!value || !US_STATES.includes(value)) {
          newErrors.state = 'Valid state is required';
        } else {
          delete newErrors.state;
        }
        break;

      case 'zip_code':
        if (!value || !/^\d{5}$/.test(value)) {
          newErrors.zip_code = 'ZIP code must be exactly 5 digits';
        } else {
          delete newErrors.zip_code;
        }
        break;

      case 'point_of_contact':
        if (!value.trim()) {
          newErrors.point_of_contact = 'Point of contact is required';
        } else {
          delete newErrors.point_of_contact;
        }
        break;

      case 'phone':
        if (!value || !/^[\d\s\-\(\)\+\.]+$/.test(value)) {
          newErrors.phone = 'Valid phone number is required';
        } else {
          delete newErrors.phone;
        }
        break;

      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = 'Valid email address is required';
        } else {
          delete newErrors.email;
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    let processedValue = value;

    // Apply formatting for specific fields
    if (name === 'phone') {
      processedValue = formatPhoneNumber(value);
    } else if (name === 'zip_code') {
      processedValue = formatZipCode(value);
    }

    setFormData(prev => ({ ...prev, [name]: processedValue }));
    validateField(name, processedValue);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'School name is required';
    if (!formData.street_address.trim()) newErrors.street_address = 'Street address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state || !US_STATES.includes(formData.state)) newErrors.state = 'Valid state is required';
    if (!formData.zip_code || !/^\d{5}$/.test(formData.zip_code)) newErrors.zip_code = 'ZIP code must be exactly 5 digits';
    if (!formData.point_of_contact.trim()) newErrors.point_of_contact = 'Point of contact is required';
    if (!formData.phone || !/^[\d\s\-\(\)\+\.]+$/.test(formData.phone)) newErrors.phone = 'Valid phone number is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Valid email address is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await updateSchool(schoolId, formData);
      } else {
        await createSchool(formData);
      }
      navigate('/schools');
    } catch (error) {
      // Error handling is done in the context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/schools');
  };

  if (isLoading && isEdit) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading school...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link
          to="/schools"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Schools
        </Link>
      </div>

      {/* Form */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {isEdit ? 'Edit School' : 'Add School'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* School Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              School Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter school name"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Address Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Address</h3>

            <div>
              <label htmlFor="street_address" className="block text-sm font-medium text-gray-700 mb-1">
                Street Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="street_address"
                name="street_address"
                value={formData.street_address}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.street_address ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter street address"
              />
              {errors.street_address && <p className="mt-1 text-sm text-red-600">{errors.street_address}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.city ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter city"
                />
                {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.state ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select state</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                {errors.state && <p className="mt-1 text-sm text-red-600">{errors.state}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="zip_code"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.zip_code ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="12345"
                maxLength={5}
              />
              {errors.zip_code && <p className="mt-1 text-sm text-red-600">{errors.zip_code}</p>}
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>

            <div>
              <label htmlFor="point_of_contact" className="block text-sm font-medium text-gray-700 mb-1">
                Point of Contact <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="point_of_contact"
                name="point_of_contact"
                value={formData.point_of_contact}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.point_of_contact ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter contact person name"
              />
              {errors.point_of_contact && <p className="mt-1 text-sm text-red-600">{errors.point_of_contact}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="(555) 123-4567"
                />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="contact@school.edu"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes about the school..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2"
            >
              <X size={20} />
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Object.keys(errors).length > 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              <Save size={20} />
              {isEdit ? 'Save Changes' : 'Save School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchoolForm;
