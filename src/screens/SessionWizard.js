import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Calendar, ChevronRight, ChevronLeft, Check, Edit2, Save, User, Clock, FileText, Home } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';
import { useToastContext } from '../context/ToastContext';

const SessionWizard = () => {
  const { patientId, section } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getPatientById, addSession } = usePatientData();
  const { addToast } = useToastContext();

  // Extract referrer from query parameters, default to 'profile'
  const searchParams = new URLSearchParams(location.search);
  const referrer = searchParams.get('referrer') || 'profile';

  const [currentStep, setCurrentStep] = useState(section === 'subjective' ? 1 : 0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessionStartTime, setSessionStartTime] = useState('14:00');
  const [sessionEndTime, setSessionEndTime] = useState('15:30');
  const [therExMinutes, setTherExMinutes] = useState(0);
  const [therActMinutes, setTherActMinutes] = useState(0);
  const [soapNote, setSoapNote] = useState({
    subjective: '',
    objectiveCategories: {
      balance: false,
      motorSkills: false,
      therapeuticActivities: false,
      transfers: false,
      classroomMobility: false
    },
    objectiveNotes: '',
    assessment: '',
    plan: ''
  });

  const patient = getPatientById(patientId);

  const getCurrentTimeDefaults = () => {
    const now = new Date();
    const endTime = now;
    const startTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes earlier

    const formatTimeForInput = (date) => {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    return {
      startTime: formatTimeForInput(startTime),
      endTime: formatTimeForInput(endTime)
    };
  };

  // Auto-populate time fields when entering the review step
  useEffect(() => {
    if (currentStep === 5) { // Review step
      const timeDefaults = getCurrentTimeDefaults();
      setSessionStartTime(timeDefaults.startTime);
      setSessionEndTime(timeDefaults.endTime);
    }
  }, [currentStep]);

  const steps = [
    { name: 'Calendar', icon: Calendar },
    { name: 'Subjective', icon: User },
    { name: 'Objective', icon: FileText },
    { name: 'Assessment', icon: Edit2 },
    { name: 'Plan', icon: Clock },
    { name: 'Review', icon: Check },
    { name: 'Complete', icon: Home }
  ];

  const objectiveOptions = [
    { key: 'balance', label: 'Balance & Coordination' },
    { key: 'motorSkills', label: 'Gross Motor Skills' },
    { key: 'therapeuticActivities', label: 'Therapeutic Activities' },
    { key: 'transfers', label: 'Transfers & Positioning' },
    { key: 'classroomMobility', label: 'Classroom Mobility' }
  ];

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getSessionDurationMinutes = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes ? endMinutes - startMinutes : 0;
  };

  const formatDuration = (minutes) => {
    if (minutes <= 0) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) {
      return `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    } else if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  };

  const sectionHasContent = (index) => {
    switch (index) {
      case 0: // Calendar
        return patient !== null;
      case 1: // Subjective
        return soapNote.subjective.trim().length > 0;
      case 2: // Objective
        return (
          Object.values(soapNote.objectiveCategories).some(Boolean) &&
          soapNote.objectiveNotes.trim().length > 0
        );
      case 3: // Assessment
        return soapNote.assessment.trim().length > 0;
      case 4: // Plan
        return soapNote.plan.trim().length > 0;
      case 5: // Review
        return (
          sectionHasContent(1) &&
          sectionHasContent(2) &&
          sectionHasContent(3) &&
          sectionHasContent(4)
        );
      default:
        return false;
    }
  };

  const getIncompleteSections = () => {
    const incompleteSections = [];
    const soapSections = [
      { index: 1, name: 'Subjective' },
      { index: 2, name: 'Objective' },
      { index: 3, name: 'Assessment' },
      { index: 4, name: 'Plan' }
    ];

    soapSections.forEach(section => {
      if (!sectionHasContent(section.index)) {
        incompleteSections.push(section.name);
      }
    });

    return incompleteSections;
  };

  const handleObjectiveCategoryToggle = (key) => {
    setSoapNote(prev => ({
      ...prev,
      objectiveCategories: {
        ...prev.objectiveCategories,
        [key]: !prev.objectiveCategories[key]
      }
    }));
  };

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 1) {
      // On subjective step, navigate back based on referrer
      if (referrer === 'home') {
        navigate('/');
      } else {
        navigate(`/patients/${patientId}`);
      }
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveAndReturn = async () => {
    try {
      await addSession({
        patientId,
        sessionDate: selectedDate.toISOString(),
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        subjective: soapNote.subjective,
        objectiveCategories: soapNote.objectiveCategories,
        objectiveNotes: soapNote.objectiveNotes,
        assessment: soapNote.assessment,
        plan: soapNote.plan,
        therExMinutes,
        therActMinutes
      });

      // Show success toast (will implement later)
      console.log('Session saved successfully');

      // Redirect to patient detail page
      navigate(`/patients/${patientId}`);
    } catch (error) {
      console.error('Failed to save session:', error);
      // Error handling will be implemented later
    }
  };

  const handleValidatedSave = () => {
    const incompleteSections = getIncompleteSections();

    if (incompleteSections.length > 0) {
      const message = `Cannot save. Missing required sections: ${incompleteSections.join(', ')}`;
      addToast(message, 'warning');
      return;
    }

    // All sections are complete, proceed to next step
    handleNextStep();
  };

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const hasContent = sectionHasContent(index);

          // Hide the Calendar step from breadcrumbs; start at Subjective
          if (index === 0) return null;

  return (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => index !== 6 && setCurrentStep(index)}
                  disabled={index === 6}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg scale-110'
                      : hasContent
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                  } ${index === 6 ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <Icon size={24} />
                </button>
                <span className={`mt-2 text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-all ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                  style={{ width: '100%', maxWidth: '60px' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCalendarStep = () => (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Select Patient & Session</h2>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-700">Session Date</h3>
          <div className="flex items-center gap-2">
            <Calendar className="text-blue-600" size={24} />
            <span className="text-lg font-medium text-gray-700">{formatDate(selectedDate)}</span>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Session Date</label>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Patient</h3>
        {patient ? (
          <div className="p-6 rounded-lg border-2 border-blue-600 bg-blue-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-lg font-bold text-gray-800">{patient.firstName} {patient.lastName}</h4>
                <p className="text-sm text-gray-600 mt-1">Age: {Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000))} years</p>
                <p className="text-sm text-gray-600">Diagnosis: {patient.diagnosis}</p>
                <p className="text-xs text-gray-500 mt-2">Last session: {patient.lastSessionDate ? new Date(patient.lastSessionDate).toLocaleDateString() : 'No sessions yet'}</p>
              </div>
              <Check className="text-blue-600" size={28} />
            </div>
          </div>
        ) : (
          <p>Patient not found</p>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleNextStep}
          disabled={!patient}
          className={`px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-2 transition-all ${
            patient
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Start Session
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );

  const renderSubjectiveStep = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Subjective</h2>
      <p className="text-gray-600 mb-6">Document the child's reported symptoms, feelings, and caregiver observations</p>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4 pb-4 border-b">
          <h3 className="text-lg font-semibold text-gray-700">Patient: {patient?.firstName} {patient?.lastName}</h3>
          <p className="text-sm text-gray-600">{patient?.diagnosis}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subjective Notes
          </label>
          <textarea
            value={soapNote.subjective}
            onChange={(e) => setSoapNote({...soapNote, subjective: e.target.value})}
            placeholder="Example: Child reports feeling tired today. Parent notes that child has been more active at home this week. Child expressed excitement about playing on the swings..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
          />
          <p className="text-xs text-gray-500 mt-2">
            Include: child's complaints, parent observations, child's mood, functional concerns
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={handlePrevStep}
          className="px-6 py-3 rounded-lg font-semibold text-blue-600 border-2 border-blue-600 hover:bg-blue-50 flex items-center gap-2"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <button
          onClick={handleNextStep}
          className="px-8 py-3 rounded-lg font-semibold flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          Continue
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderObjectiveStep = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Objective</h2>
      <p className="text-gray-600 mb-6">Select categories and document measurable observations from the session</p>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-6 pb-4 border-b">
          <h3 className="text-lg font-semibold text-gray-700">Patient: {patient?.firstName} {patient?.lastName}</h3>
        </div>

        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-700 mb-3">Objective Categories</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {objectiveOptions.map(option => (
              <button
                key={option.key}
                onClick={() => handleObjectiveCategoryToggle(option.key)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  soapNote.objectiveCategories[option.key]
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{option.label}</span>
                  {soapNote.objectiveCategories[option.key] && (
                    <Check className="text-blue-600" size={20} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Objective Observations
          </label>
          <textarea
            value={soapNote.objectiveNotes}
            onChange={(e) => setSoapNote({...soapNote, objectiveNotes: e.target.value})}
            placeholder="Example: Child demonstrated improved standing balance, maintaining position for 45 seconds (up from 30 seconds last session). Gait pattern shows decreased toe-walking. Successfully transferred from wheelchair to mat with minimal assistance..."
            className="w-full h-48 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
          />
          <p className="text-xs text-gray-500 mt-2">
            Include: measurable observations, test results, physical findings, activities performed
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={handlePrevStep}
          className="px-6 py-3 rounded-lg font-semibold text-blue-600 border-2 border-blue-600 hover:bg-blue-50 flex items-center gap-2"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <button
          onClick={handleNextStep}
          className="px-8 py-3 rounded-lg font-semibold flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          Continue
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderAssessmentStep = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Assessment</h2>
      <p className="text-gray-600 mb-6">Analyze the child's performance and progress toward goals</p>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4 pb-4 border-b">
          <h3 className="text-lg font-semibold text-gray-700">Patient: {patient?.firstName} {patient?.lastName}</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clinical Assessment
          </label>
          <textarea
            value={soapNote.assessment}
            onChange={(e) => setSoapNote({...soapNote, assessment: e.target.value})}
            placeholder="Example: Child demonstrates continued progress in balance and coordination skills. Shows 50% improvement in standing balance duration over past 3 sessions. Gait pattern improvements indicate positive response to therapeutic interventions. Child remains motivated and engaged in activities..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
          />
          <p className="text-xs text-gray-500 mt-2">
            Include: professional interpretation, progress toward goals, changes from previous sessions, clinical judgment
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={handlePrevStep}
          className="px-6 py-3 rounded-lg font-semibold text-blue-600 border-2 border-blue-600 hover:bg-blue-50 flex items-center gap-2"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <button
          onClick={handleNextStep}
          className="px-8 py-3 rounded-lg font-semibold flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          Continue
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderPlanStep = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Plan</h2>
      <p className="text-gray-600 mb-6">Document treatment plan and next steps</p>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4 pb-4 border-b">
          <h3 className="text-lg font-semibold text-gray-700">Patient: {patient?.firstName} {patient?.lastName}</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Treatment Plan
          </label>
          <textarea
            value={soapNote.plan}
            onChange={(e) => setSoapNote({...soapNote, plan: e.target.value})}
            placeholder="Example: Continue current treatment protocol with increased emphasis on dynamic balance activities. Next session will focus on: 1) Standing balance on unstable surfaces, 2) Tandem walking exercises, 3) Ball activities for coordination. Schedule follow-up in 1 week. Recommend parent practice balance activities at home for 10 minutes daily..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
          />
          <p className="text-xs text-gray-500 mt-2">
            Include: treatment modifications, next session goals, home exercise program, follow-up schedule
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={handlePrevStep}
          className="px-6 py-3 rounded-lg font-semibold text-blue-600 border-2 border-blue-600 hover:bg-blue-50 flex items-center gap-2"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <button
          onClick={handleNextStep}
          className="px-8 py-3 rounded-lg font-semibold flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          Continue
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Review Note</h2>
      <p className="text-gray-600 mb-6">Review and confirm your documentation before saving</p>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-6 pb-4 border-b-2">
          <h3 className="text-2xl font-bold text-gray-800">{patient?.firstName} {patient?.lastName}</h3>
          <p className="text-sm text-gray-600 mt-1">{patient?.diagnosis} • Age {patient ? Math.floor((new Date() - new Date(patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : 0} years</p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Session:</strong> {formatDate(selectedDate)} • {formatTime(sessionStartTime)} - {formatTime(sessionEndTime)}
              {getSessionDurationMinutes(sessionStartTime, sessionEndTime) > 0 && (
                <span className="ml-2 text-blue-600">({formatDuration(getSessionDurationMinutes(sessionStartTime, sessionEndTime))})</span>
              )}
            </p>
            <div className="flex gap-4">
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Time</label>
                  <input
                    type="time"
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">TherEx</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={therExMinutes}
                    onChange={(e) => setTherExMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                  />
                  <span className="text-sm text-gray-600">minutes</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">TherAct</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={therActMinutes}
                    onChange={(e) => setTherActMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                  />
                  <span className="text-sm text-gray-600">minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border-l-4 border-purple-600 pl-4">
            <h4 className="text-lg font-bold text-purple-600 mb-2">SUBJECTIVE</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{soapNote.subjective.trim() || 'N/A'}</p>
          </div>

          <div className="border-l-4 border-blue-600 pl-4">
            <h4 className="text-lg font-bold text-blue-600 mb-2">OBJECTIVE</h4>
            <div className="mb-3">
              <p className="text-sm font-semibold text-gray-600 mb-2">Categories Assessed:</p>
              <div className="flex flex-wrap gap-2">
                {objectiveOptions
                  .filter(opt => soapNote.objectiveCategories[opt.key])
                  .map(opt => (
                    <span key={opt.key} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {opt.label}
                    </span>
                  ))}
              </div>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{soapNote.objectiveNotes.trim() || 'N/A'}</p>
          </div>

          <div className="border-l-4 border-orange-600 pl-4">
            <h4 className="text-lg font-bold text-orange-600 mb-2">ASSESSMENT</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{soapNote.assessment.trim() || 'N/A'}</p>
          </div>

          <div className="border-l-4 border-green-600 pl-4">
            <h4 className="text-lg font-bold text-green-600 mb-2">PLAN</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{soapNote.plan.trim() || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={handlePrevStep}
          className="px-6 py-3 rounded-lg font-semibold text-blue-600 border-2 border-blue-600 hover:bg-blue-50 flex items-center gap-2"
        >
          <ChevronLeft size={20} />
          Back to Edit
        </button>
        <button
          onClick={handleValidatedSave}
          className="px-8 py-3 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
        >
          <Save size={20} />
          Save & Continue
        </button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="max-w-3xl mx-auto text-center">
      <div className="bg-white rounded-lg shadow-md p-12">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="text-green-600" size={48} />
        </div>

        <h2 className="text-3xl font-bold text-gray-800 mb-4">Session Documented Successfully!</h2>
        <p className="text-lg text-gray-600 mb-8">
          Note for {patient?.firstName} {patient?.lastName} has been saved to the patient record.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Session Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="text-sm text-gray-600">Patient</p>
              <p className="font-semibold text-gray-800">{patient?.firstName} {patient?.lastName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date & Time</p>
              <p className="font-semibold text-gray-800">{formatDate(selectedDate)} • {formatTime(sessionStartTime)} - {formatTime(sessionEndTime)}</p>
              {getSessionDurationMinutes(sessionStartTime, sessionEndTime) > 0 && (
                <p className="text-sm text-blue-600 mt-1">{formatDuration(getSessionDurationMinutes(sessionStartTime, sessionEndTime))}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Categories</p>
              <p className="font-semibold text-gray-800">
                {Object.values(soapNote.objectiveCategories).filter(Boolean).length} assessed
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Documentation</p>
              <p className="font-semibold text-gray-800">Complete</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveAndReturn}
          className="px-10 py-4 rounded-lg font-semibold text-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg flex items-center gap-3 mx-auto"
        >
          <Home size={24} />
          Return to Patient
        </button>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderCalendarStep();
      case 1:
        return renderSubjectiveStep();
      case 2:
        return renderObjectiveStep();
      case 3:
        return renderAssessmentStep();
      case 4:
        return renderPlanStep();
      case 5:
        return renderReviewStep();
      case 6:
        return renderCompleteStep();
      default:
        return renderCalendarStep();
    }
  };

  if (!patient) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Patient Not Found</h2>
        <p className="text-gray-600">The patient you're trying to create a session for could not be found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {currentStep > 0 && currentStep < 6 && renderStepIndicator()}

        <main>
          {renderCurrentStep()}
        </main>
      </div>
    </div>
  );
};

export default SessionWizard;
