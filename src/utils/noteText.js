import { buildNoteContent, getObjectiveCategoryLabels } from './noteContent';

// The whole note as plain text for the clipboard. Reads well pasted into an
// email or a single Google Sheets cell.
export const formatNoteAsText = (session, patient, provider) => {
  const content = buildNoteContent(session, patient, provider);
  const categories = getObjectiveCategoryLabels(content.objective.categories);

  const header = [
    content.patientName,
    `Date of service: ${content.sessionDate}`,
    ...(content.timeRange !== 'N/A' ? [`Time: ${content.timeRange}`] : []),
    `TherEx: ${content.therExMinutes} minutes`,
    `TherAct: ${content.therActMinutes} minutes`
  ];

  const goals = content.goals.length > 0
    ? [['Goals:', ...content.goals.map((g, i) => `${i + 1}. ${g.text}`)].join('\n')]
    : [];

  const objective = [
    ...(categories.length > 0 ? [`Objective categories: ${categories.join(', ')}`] : []),
    content.objective.notes
  ].join('\n');

  const footer = [
    `Provider: ${content.providerName}`,
    ...(content.licenseNumber ? [content.licenseNumber] : []),
    ...(content.amendmentNote ? [content.amendmentNote] : []),
    'Electronically signed'
  ];

  return [
    header.join('\n'),
    ...goals,
    `SUBJECTIVE\n${content.subjective}`,
    `OBJECTIVE\n${objective}`,
    `ASSESSMENT\n${content.assessment}`,
    `PLAN\n${content.plan}`,
    footer.join('\n')
  ].join('\n\n');
};
