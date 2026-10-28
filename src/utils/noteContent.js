// What every note export shows, computed once: the PDF, the Word file, the
// copied text, and the CSV all read from here.
import { parseAppDate } from './sessionFormatting';

export const CATEGORY_LABELS = {
  balance: 'Balance & Coordination',
  motorSkills: 'Gross Motor Skills',
  therapeuticActivities: 'Therapeutic Activities',
  transfers: 'Transfers & Positioning',
  classroomMobility: 'Classroom Mobility'
};

// '14:05' -> '2:05 PM'
export const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Checked categories as labels, known ones in a fixed order, then any others
export const getObjectiveCategoryLabels = (categories) => {
  if (!categories) return [];
  const known = Object.keys(CATEGORY_LABELS).filter((key) => categories[key]).map((key) => CATEGORY_LABELS[key]);
  const other = Object.keys(categories).filter((key) => categories[key] && !CATEGORY_LABELS[key]);
  return [...known, ...other];
};

const formatExportDate = (value) => parseAppDate(value).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

export const buildNoteContent = (session, patient, provider) => {
  const sessionDate = formatExportDate(session.sessionDate);

  const timeRange = session.startTime && session.endTime
    ? `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`
    : 'N/A';

  const providerName = provider ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim() : 'N/A';
  const credentials = provider?.credentials?.length ? `, ${provider.credentials.join(', ')}` : '';
  const licenseNumber = provider?.license ? `License Number: ${provider.license}` : '';
  const signatureName = providerName !== 'N/A' ? providerName : '';

  const goals = (patient.goals || []).filter(g => g.status === 'active');

  const amendmentNote = (session.amendments || []).length > 0
    ? `Amendment history: originally documented ${session.createdAt ? formatExportDate(session.createdAt) : 'earlier'}; amended ${session.amendments.map(a => formatExportDate(a.amendedAt)).join(', ')}.`
    : '';

  return {
    patientName: `${patient.firstName} ${patient.lastName}`,
    sessionDate,
    timeRange,
    therExMinutes: session.therExMinutes || 0,
    therActMinutes: session.therActMinutes || 0,
    subjective: session.subjective || 'N/A',
    objective: {
      categories: session.objectiveCategories || {},
      notes: session.objectiveNotes || 'N/A'
    },
    assessment: session.assessment || 'N/A',
    plan: session.plan || 'N/A',
    goals,
    amendmentNote,
    providerName: `${providerName}${credentials}`,
    signatureName,
    licenseNumber
  };
};
