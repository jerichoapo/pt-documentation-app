import React, { useState } from 'react';
import { Calendar, ChevronRight, ChevronLeft, Check, Edit2, Save, User, Clock, FileText, Home } from 'lucide-react';

const TherapistSOAPNotes = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedChild, setSelectedChild] = useState(null);
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

  // Sample patient data
  const [patients] = useState([
    { id: 1, name: 'Emma Johnson', age: 7, lastSession: '2025-11-08', diagnosis: 'Cerebral Palsy' },
    { id: 2, name: 'Liam Martinez', age: 5, lastSession: '2025-11-10', diagnosis: 'Developmental Delay' },
    { id: 3, name: 'Sophia Chen', age: 8, lastSession: '2025-11-09', diagnosis: 'Spina Bifida' },
    { id: 4, name: 'Noah Patel', age: 6, lastSession: '2025-11-11', diagnosis: 'Down Syndrome' },
    { id: 5, name: 'Olivia Brown', age: 9, lastSession: '2025-11-07', diagnosis: 'Muscular Dystrophy' }
  ]);

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
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveAndReturn = () => {
    // Reset for next patient
    setSelectedChild(null);
    setSoapNote({
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
    setCurrentStep(0);
  };

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

  return (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg scale-110'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  <Icon size={24} />
                </div>
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
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Today's Patients</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patients.map(patient => (
            <div
              key={patient.id}
              onClick={() => setSelectedChild(patient)}
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                selectedChild?.id === patient.id
                  ? 'border-blue-600 bg-blue-50 shadow-lg'
                  : 'border-gray-200 hover:border-blue-400 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-800">{patient.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">Age: {patient.age} years</p>
                  <p className="text-sm text-gray-600">Diagnosis: {patient.diagnosis}</p>
                  <p className="text-xs text-gray-500 mt-2">Last session: {patient.lastSession}</p>
                </div>
                {selectedChild?.id === patient.id && (
                  <Check className="text-blue-600" size={28} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleNextStep}
          disabled={!selectedChild}
          className={`px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-2 transition-all ${
            selectedChild
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
          <h3 className="text-lg font-semibold text-gray-700">Patient: {selectedChild?.name}</h3>
          <p className="text-sm text-gray-600">{selectedChild?.diagnosis}</p>
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
          disabled={!soapNote.subjective.trim()}
          className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 ${
            soapNote.subjective.trim()
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
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
          <h3 className="text-lg font-semibold text-gray-700">Patient: {selectedChild?.name}</h3>
        </div>

        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-700 mb-3">Assessment Categories</h4>
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
          disabled={!soapNote.objectiveNotes.trim()}
          className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 ${
            soapNote.objectiveNotes.trim()
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
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
          <h3 className="text-lg font-semibold text-gray-700">Patient: {selectedChild?.name}</h3>
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
          disabled={!soapNote.assessment.trim()}
          className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 ${
            soapNote.assessment.trim()
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
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
          <h3 className="text-lg font-semibold text-gray-700">Patient: {selectedChild?.name}</h3>
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
          disabled={!soapNote.plan.trim()}
          className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 ${
            soapNote.plan.trim()
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Review SOAP Note</h2>
      <p className="text-gray-600 mb-6">Review and confirm your documentation before saving</p>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-6 pb-4 border-b-2">
          <h3 className="text-2xl font-bold text-gray-800">{selectedChild?.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{selectedChild?.diagnosis} • Age {selectedChild?.age}</p>
          <p className="text-sm text-gray-600">Session Date: {formatDate(selectedDate)}</p>
        </div>

        <div className="space-y-6">
          <div className="border-l-4 border-purple-600 pl-4">
            <h4 className="text-lg font-bold text-purple-600 mb-2">SUBJECTIVE</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{soapNote.subjective}</p>
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
            <p className="text-gray-700 whitespace-pre-wrap">{soapNote.objectiveNotes}</p>
          </div>

          <div className="border-l-4 border-orange-600 pl-4">
            <h4 className="text-lg font-bold text-orange-600 mb-2">ASSESSMENT</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{soapNote.assessment}</p>
          </div>

          <div className="border-l-4 border-green-600 pl-4">
            <h4 className="text-lg font-bold text-green-600 mb-2">PLAN</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{soapNote.plan}</p>
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
          onClick={handleNextStep}
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
          SOAP note for {selectedChild?.name} has been saved to the patient record.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Session Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="text-sm text-gray-600">Patient</p>
              <p className="font-semibold text-gray-800">{selectedChild?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-semibold text-gray-800">{formatDate(selectedDate)}</p>
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
          Return to Calendar
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

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Pediatric Therapy SOAP Notes</h1>
          <p className="text-gray-600">Structured session documentation system</p>
        </header>

        {currentStep < 6 && renderStepIndicator()}

        <main>
          {renderCurrentStep()}
        </main>
      </div>
    </div>
  );
};

export default TherapistSOAPNotes;
