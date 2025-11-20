import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { useToastContext } from '../context/ToastContext';
import CredentialsInput from '../components/CredentialsInput';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, updateProfile, isLoading } = useProfile();
  const { addToast } = useToastContext();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    credentials: [],
    license: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with existing profile data
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        credentials: profile.credentials || [],
        license: profile.license || ''
      });
    }
  }, [profile]);

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

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
      const processedData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        credentials: formData.credentials,
        license: formData.license.trim()
      };

      await updateProfile(processedData);
      addToast('Profile updated successfully', 'success');
      navigate('/');
    } catch (error) {
      console.error('Failed to save profile:', error);
      addToast('Failed to save profile. Please try again.', 'error');
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

  const handleCredentialsChange = (credentials) => {
    setFormData(prev => ({ ...prev, credentials }));
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">My Profile</h1>

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

          {/* Credentials */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credentials
            </label>
            <CredentialsInput
              credentials={formData.credentials}
              onChange={handleCredentialsChange}
            />
            <p className="mt-1 text-sm text-gray-500">
              Add your professional credentials (e.g., PT, DPT, OCS). Press Enter to add each one.
            </p>
          </div>

          {/* License Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              License Number
            </label>
            <input
              type="text"
              value={formData.license}
              onChange={(e) => handleInputChange('license', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter license number (optional)"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-4 pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              {isSubmitting ? 'Saving...' : 'Save Profile'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
