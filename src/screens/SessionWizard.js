import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Calendar, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Check, Edit2, Save, User, Clock, FileText, Home, History } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';
import { useToastContext } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useEditingHold } from '../context/SyncContext';
import { parseAppDate, toDateInputValue, formatMediumDate, formatAge, formatTime, getSessionDurationMinutes, formatDuration } from '../utils/sessionFormatting';
import { defaultSessionTimes, defaultMinutes, splitMinutes } from '../utils/sessionDefaults';

const DRAFT_KEY = 'ptAppSessionDraft';

const readDraft = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch (error) {
    return null;
  }
};

const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    // best-effort
  }
};

const soapHasContent = (soapNote) =>
  Boolean(
    soapNote.subjective.trim() ||
    soapNote.objectiveNotes.trim() ||
    soapNote.assessment.trim() ||
    soapNote.plan.trim() ||
    Object.values(soapNote.objectiveCategories).some(Boolean)
  );

const SessionWizard = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getPatientById, getSessionById, getSessionsForPatient, addSession } = usePatientData();
  const { addToast } = useToastContext();
  const confirm = useConfirm();
  // Hold changes from the other device until this screen closes
  useEditingHold(true);

  // Extract referrer, pre-selected date, and copy-forward source from query parameters
  const searchParams = new URLSearchParams(location.search);
  const referrer = searchParams.get('referrer') || 'profile';
  const dateParam = searchParams.get('date');
  const copyFromId = searchParams.get('copyFrom');

  // Step 0 (the old patient-and-date screen) is gone: Home and the patient
  // page already pick both. The index stays so saved drafts keep their steps.
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => {
    if (dateParam) {
      const parsed = parseAppDate(dateParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [sessionStartTime, setSessionStartTime] = useState('14:00');
  const [sessionEndTime, setSessionEndTime] = useState('15:30');
  const [isSaving, setIsSaving] = useState(false);
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

  // Most recent note, used for the "last session" peek on each SOAP step
  const lastSession = getSessionsForPatient(patientId)[0] || null;
  const [peekOpen, setPeekOpen] = useState(false);
  useEffect(() => {
    setPeekOpen(false);
  }, [currentStep]);

  // ---- Draft autosave ----
  // Offer to resume an unsaved draft for this patient; autosave only begins
  // after that decision so the prompt's draft can't be overwritten.
  const draftPromptShown = useRef(false);
  const draftResumed = useRef(false);
  const draftHasPlaceholderTimes = useRef(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (draftPromptShown.current) return;
    draftPromptShown.current = true;

    const draft = readDraft();
    if (!draft || draft.patientId !== patientId || !draft.state) {
      setDraftReady(true);
      return;
    }

    (async () => {
      const savedAt = new Date(draft.savedAt);
      const when = isNaN(savedAt.getTime())
        ? 'earlier'
        : `${savedAt.toLocaleDateString()} at ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

      const resume = await confirm({
        title: 'Resume unsaved note?',
        message: `You have an unsaved note for this patient from ${when}. Resume where you left off?`,
        confirmLabel: 'Resume',
        cancelLabel: 'Discard'
      });

      if (resume) {
        draftResumed.current = true;
        try {
          const s = draft.state;
          if (s.soapNote && s.soapNote.objectiveCategories) setSoapNote(s.soapNote);
          if (s.selectedDate) {
            const restored = parseAppDate(s.selectedDate);
            if (!isNaN(restored.getTime())) setSelectedDate(restored);
          }
          // Drafts from the old wizard carry `timesInitialized: false` until
          // Review: their times and minutes are placeholders, so the defaults
          // effect fills them instead
          if (s.timesInitialized === false) {
            draftHasPlaceholderTimes.current = true;
          } else {
            if (s.sessionStartTime) setSessionStartTime(s.sessionStartTime);
            if (s.sessionEndTime) setSessionEndTime(s.sessionEndTime);
            if (typeof s.therExMinutes === 'number') setTherExMinutes(s.therExMinutes);
            if (typeof s.therActMinutes === 'number') setTherActMinutes(s.therActMinutes);
          }
          if (typeof s.currentStep === 'number' && s.currentStep >= 1 && s.currentStep <= 5) {
            setCurrentStep(s.currentStep);
          }
        } catch (error) {
          console.error('Failed to restore draft:', error);
        }
      } else {
        clearDraft();
      }
      setDraftReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftReady || currentStep >= 6) return;

    const timer = setTimeout(() => {
      try {
        if (soapHasContent(soapNote)) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({
            patientId,
            savedAt: new Date().toISOString(),
            state: {
              currentStep,
              selectedDate: toDateInputValue(selectedDate),
              sessionStartTime,
              sessionEndTime,
              therExMinutes,
              therActMinutes,
              soapNote
            }
          }));
        } else {
          // Nothing worth keeping - drop our own draft so an emptied note
          // doesn't resurrect later
          const existing = readDraft();
          if (existing && existing.patientId === patientId) {
            clearDraft();
          }
        }
      } catch (error) {
        // Draft persistence is best-effort; never interrupt documentation
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [draftReady, soapNote, selectedDate, sessionStartTime, sessionEndTime, therExMinutes, therActMinutes, currentStep, patientId]);

  // ---- Copy-forward ----
  // Prefill from the session named by ?copyFrom, once the draft decision is
  // settled. A resumed draft outranks the prefill; discarding it applies the
  // prefill. The date is not copied; times and minutes come from the
  // defaults effect below.
  const copyFromSource = copyFromId ? getSessionById(copyFromId) : null;
  const copyHandled = useRef(false);

  useEffect(() => {
    if (!draftReady || copyHandled.current) return;
    if (!copyFromId || draftResumed.current) {
      copyHandled.current = true;
      return;
    }
    if (!copyFromSource) return; // wait for data to load; bad ids just never apply
    if (copyFromSource.patientId !== patientId) {
      copyHandled.current = true;
      return;
    }

    copyHandled.current = true;
    setSoapNote(prev => {
      if (soapHasContent(prev)) return prev; // never clobber typed content
      return {
        subjective: copyFromSource.subjective || '',
        objectiveCategories: {
          balance: false,
          motorSkills: false,
          therapeuticActivities: false,
          transfers: false,
          classroomMobility: false,
          ...(copyFromSource.objectiveCategories || {})
        },
        objectiveNotes: copyFromSource.objectiveNotes || '',
        assessment: copyFromSource.assessment || '',
        plan: copyFromSource.plan || ''
      };
    });
    addToast(`Prefilled from the ${formatMediumDate(copyFromSource.sessionDate)} session - update what changed before saving`, 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, copyFromSource, copyFromId, patientId]);

  // ---- Session time and minute defaults ----
  // Notes are often written hours after the session, so the clock is the last
  // resort: times come from the copy-forward source, else the last session;
  // minutes from the same sources, else the session length split evenly. Runs
  // once the draft decision is settled and the patient's data has loaded. A
  // resumed draft keeps its own values.
  const defaultsApplied = useRef(false);
  // 'split' minutes keep following the session times until she edits them
  const minutesSource = useRef('manual');

  useEffect(() => {
    if (!draftReady || !patient || defaultsApplied.current) return;
    defaultsApplied.current = true;
    if (draftResumed.current && !draftHasPlaceholderTimes.current) return;

    const copyFrom = copyFromSource && copyFromSource.patientId === patientId ? copyFromSource : null;
    const times = defaultSessionTimes({ copyFrom, lastSession });
    const minutes = defaultMinutes({ copyFrom, lastSession, ...times });
    setSessionStartTime(times.startTime);
    setSessionEndTime(times.endTime);
    setTherExMinutes(minutes.therExMinutes);
    setTherActMinutes(minutes.therActMinutes);
    minutesSource.current = minutes.source;
  }, [draftReady, patient, copyFromSource, lastSession, patientId]);

  useEffect(() => {
    if (minutesSource.current !== 'split') return;
    const split = splitMinutes(sessionStartTime, sessionEndTime);
    setTherExMinutes(split.therExMinutes);
    setTherActMinutes(split.therActMinutes);
  }, [sessionStartTime, sessionEndTime]);

  const handleMinutesChange = (setter) => (e) => {
    minutesSource.current = 'manual';
    setter(Math.max(0, parseInt(e.target.value) || 0));
  };

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

  const handleReturnToPatient = () => {
    navigate(`/patients/${patientId}`);
  };

  const handleValidatedSave = async () => {
    const incompleteSections = getIncompleteSections();

    if (incompleteSections.length > 0) {
      const message = `Cannot save. Missing required sections: ${incompleteSections.join(', ')}`;
      addToast(message, 'warning');
      return;
    }

    if (isSaving) return;

    // TherEx/TherAct minutes are what the exported note bills; zero is
    // almost always a missed field
    if (therExMinutes + therActMinutes === 0) {
      const saveAnyway = await confirm({
        title: 'No treatment minutes',
        message: 'TherEx and TherAct are both 0. The exported note will show no billable minutes. Save anyway?',
        confirmLabel: 'Save anyway'
      });
      if (!saveAnyway) return;
    }

    setIsSaving(true);
    try {
      // Save the session BEFORE showing the completion screen
      await addSession({
        patientId,
        sessionDate: toDateInputValue(selectedDate),
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

      clearDraft();
      handleNextStep();
    } catch (error) {
      console.error('Failed to save session:', error);
      // Stay on the review step; the context already shows an error toast
    } finally {
      setIsSaving(false);
    }
  };

  // Read-only reference strip showing the same section from the most recent
  // note, so progress can be written against last session without leaving
  // the wizard
  const renderLastSessionPeek = (section) => {
    if (!lastSession) return null;

    const sectionContent = {
      subjective: lastSession.subjective,
      objective: lastSession.objectiveNotes,
      assessment: lastSession.assessment,
      plan: lastSession.plan
    }[section];

    const activeCategories = section === 'objective'
      ? objectiveOptions.filter(opt => lastSession.objectiveCategories?.[opt.key])
      : [];

    return (
      <div className="mb-4 border border-gray-200 rounded-lg bg-gray-50">
        <button
          type="button"
          onClick={() => setPeekOpen(!peekOpen)}
          className="w-full min-h-[44px] flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
        >
          <span className="flex items-center gap-2">
            <History size={16} />
            Last session — {formatMediumDate(lastSession.sessionDate)}
          </span>
          {peekOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {peekOpen && (
          <div className="px-4 pb-3 text-sm text-gray-700">
            {activeCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {activeCategories.map(opt => (
                  <span
                    key={opt.key}
                    className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                  >
                    {opt.label}
                  </span>
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap">{sectionContent || 'Nothing recorded for this section.'}</p>
          </div>
        )}
      </div>
    );
  };

  // Steps 1-5 only (Subjective through Review); the old start screen and the
  // Complete screen are not steps she can jump to
  const indicatorSteps = [1, 2, 3, 4, 5];

  const renderStepIndicator = () => (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {indicatorSteps.map((index) => {
          const step = steps[index];
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const hasContent = sectionHasContent(index);

          return (
            <div key={index} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => setCurrentStep(index)}
                  aria-label={step.name}
                  aria-current={isActive ? 'step' : undefined}
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg'
                      : hasContent
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                  }`}
                >
                  <Icon size={20} />
                </button>
                <span className={`hidden sm:block mt-2 text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                  {step.name}
                </span>
              </div>
              {index < 5 && (
                <div
                  className={`h-1 flex-1 mx-1 sm:mx-2 transition-all ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="sm:hidden text-sm text-gray-600 text-center mt-3">
        Step {currentStep} of 5: {steps[currentStep].name}
      </p>
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

        {/* Session time up front, while the session is fresh */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="subjective-start" className="block text-sm text-gray-600 mb-1">Session start</label>
            <input
              id="subjective-start"
              type="time"
              value={sessionStartTime}
              onChange={(e) => setSessionStartTime(e.target.value)}
              className="min-h-[44px] px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="subjective-end" className="block text-sm text-gray-600 mb-1">Session end</label>
            <input
              id="subjective-end"
              type="time"
              value={sessionEndTime}
              onChange={(e) => setSessionEndTime(e.target.value)}
              className="min-h-[44px] px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {getSessionDurationMinutes(sessionStartTime, sessionEndTime) > 0 && (
            <p className="min-h-[44px] flex items-center text-sm text-gray-600">
              {getSessionDurationMinutes(sessionStartTime, sessionEndTime)} min
            </p>
          )}
        </div>

        {renderLastSessionPeek('subjective')}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subjective Notes
          </label>
          <textarea
            value={soapNote.subjective}
            onChange={(e) => { const value = e.target.value; setSoapNote(prev => ({ ...prev, subjective: value })); }}
            placeholder="Example: Child reports feeling tired today. Parent notes that child has been more active at home this week. Child expressed excitement about playing on the swings..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
          />
          <p className="text-sm text-gray-500 mt-2">
            Include: child's complaints, parent observations, child's mood, functional concerns
          </p>
        </div>
      </div>

      <div className="flex justify-between gap-3 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 bg-gray-100 py-3">
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

        {renderLastSessionPeek('objective')}

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
            onChange={(e) => { const value = e.target.value; setSoapNote(prev => ({ ...prev, objectiveNotes: value })); }}
            placeholder="Example: Child demonstrated improved standing balance, maintaining position for 45 seconds (up from 30 seconds last session). Gait pattern shows decreased toe-walking. Successfully transferred from wheelchair to mat with minimal assistance..."
            className="w-full h-48 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
          />
          <p className="text-sm text-gray-500 mt-2">
            Include: measurable observations, test results, physical findings, activities performed
          </p>
        </div>
      </div>

      <div className="flex justify-between gap-3 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 bg-gray-100 py-3">
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

        {renderLastSessionPeek('assessment')}

        {(patient?.goals || []).filter(g => g.status === 'active').length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-1">
              Active goals
            </p>
            <ol className="text-sm text-blue-900 list-decimal list-inside space-y-0.5">
              {patient.goals
                .filter(g => g.status === 'active')
                .map(g => (
                  <li key={g.id}>{g.text}</li>
                ))}
            </ol>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clinical Assessment
          </label>
          <textarea
            value={soapNote.assessment}
            onChange={(e) => { const value = e.target.value; setSoapNote(prev => ({ ...prev, assessment: value })); }}
            placeholder="Example: Child demonstrates continued progress in balance and coordination skills. Shows 50% improvement in standing balance duration over past 3 sessions. Gait pattern improvements indicate positive response to therapeutic interventions. Child remains motivated and engaged in activities..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
          />
          <p className="text-sm text-gray-500 mt-2">
            Include: professional interpretation, progress toward goals, changes from previous sessions, clinical judgment
          </p>
        </div>
      </div>

      <div className="flex justify-between gap-3 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 bg-gray-100 py-3">
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

        {renderLastSessionPeek('plan')}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Treatment Plan
          </label>
          <textarea
            value={soapNote.plan}
            onChange={(e) => { const value = e.target.value; setSoapNote(prev => ({ ...prev, plan: value })); }}
            placeholder="Example: Continue current treatment protocol with increased emphasis on dynamic balance activities. Next session will focus on: 1) Standing balance on unstable surfaces, 2) Tandem walking exercises, 3) Ball activities for coordination. Schedule follow-up in 1 week. Recommend parent practice balance activities at home for 10 minutes daily..."
            className="w-full h-64 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none text-base"
          />
          <p className="text-sm text-gray-500 mt-2">
            Include: treatment modifications, next session goals, home exercise program, follow-up schedule
          </p>
        </div>
      </div>

      <div className="flex justify-between gap-3 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 bg-gray-100 py-3">
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
          <p className="text-sm text-gray-600 mt-1">{patient?.diagnosis} • Age {formatAge(patient?.dob)}</p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Session:</strong> {formatMediumDate(selectedDate)} • {formatTime(sessionStartTime)} - {formatTime(sessionEndTime)}
              {getSessionDurationMinutes(sessionStartTime, sessionEndTime) > 0 && (
                <span className="ml-2 text-blue-600">({formatDuration(getSessionDurationMinutes(sessionStartTime, sessionEndTime))})</span>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="review-date" className="block text-sm text-gray-600 mb-1">Date</label>
                <input
                  id="review-date"
                  type="date"
                  value={toDateInputValue(selectedDate)}
                  onChange={(e) => { if (e.target.value) setSelectedDate(parseAppDate(e.target.value)); }}
                  className="w-full min-h-[44px] px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="review-start" className="block text-sm text-gray-600 mb-1">Start Time</label>
                <input
                  id="review-start"
                  type="time"
                  value={sessionStartTime}
                  onChange={(e) => setSessionStartTime(e.target.value)}
                  className="w-full min-h-[44px] px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="review-end" className="block text-sm text-gray-600 mb-1">End Time</label>
                <input
                  id="review-end"
                  type="time"
                  value={sessionEndTime}
                  onChange={(e) => setSessionEndTime(e.target.value)}
                  className="w-full min-h-[44px] px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div>
                <label htmlFor="review-therex" className="block text-sm text-gray-600 mb-1">TherEx (min)</label>
                <input
                  id="review-therex"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={therExMinutes}
                  onChange={handleMinutesChange(setTherExMinutes)}
                  className="w-full min-h-[44px] px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="review-theract" className="block text-sm text-gray-600 mb-1">TherAct (min)</label>
                <input
                  id="review-theract"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={therActMinutes}
                  onChange={handleMinutesChange(setTherActMinutes)}
                  className="w-full min-h-[44px] px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {(() => {
              const duration = getSessionDurationMinutes(sessionStartTime, sessionEndTime);
              const combined = therExMinutes + therActMinutes;
              if (duration > 0 && combined > duration) {
                return (
                  <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    Combined minutes ({combined}) exceed the session length ({duration}). Double-check the times or minutes — you can still save.
                  </div>
                );
              }
              return null;
            })()}
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

      <div className="flex justify-between gap-3 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-0 bg-gray-100 py-3">
        <button
          onClick={handlePrevStep}
          className="px-6 py-3 rounded-lg font-semibold text-blue-600 border-2 border-blue-600 hover:bg-blue-50 flex items-center gap-2"
        >
          <ChevronLeft size={20} />
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Back to Edit</span>
        </button>
        <button
          onClick={handleValidatedSave}
          disabled={isSaving}
          className="px-8 py-3 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={20} />
          {isSaving ? 'Saving...' : 'Save & Continue'}
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
              <p className="font-semibold text-gray-800">{formatMediumDate(selectedDate)} • {formatTime(sessionStartTime)} - {formatTime(sessionEndTime)}</p>
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
          onClick={handleReturnToPatient}
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
        return renderSubjectiveStep();
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
    <div className="bg-gray-100 sm:py-4">
      <div className="max-w-6xl mx-auto">
        {currentStep < 6 && renderStepIndicator()}

        <main>
          {renderCurrentStep()}
        </main>
      </div>
    </div>
  );
};

export default SessionWizard;
