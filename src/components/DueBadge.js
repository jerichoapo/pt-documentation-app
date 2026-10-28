import React from 'react';
import { isPatientDueThisWeek, visitsThisWeek } from '../utils/sessionFormatting';

// Amber "Due · 1 of 2" badge for a patient seen fewer times this week than
// their visit frequency. The count is visible text because a tooltip never
// shows on a phone.
const DueBadge = ({ patient, sessions, now = new Date() }) => {
  if (!isPatientDueThisWeek(patient, sessions, now)) return null;
  const seen = visitsThisWeek(patient, sessions, now);
  const target = patient.visitFrequency.timesPerWeek;
  return (
    <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold whitespace-nowrap">
      <span aria-hidden="true">Due · {seen} of {target}</span>
      <span className="sr-only">Due: {seen} of {target} visits this week</span>
    </span>
  );
};

export default DueBadge;
