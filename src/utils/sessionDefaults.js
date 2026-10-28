// Defaults for a new note's session times and treatment minutes. Notes are
// often written well after the session, so the clock is the last resort.
import { getSessionDurationMinutes } from './sessionFormatting';

const toHHMM = (date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const hasTimes = (session) => Boolean(session?.startTime && session?.endTime);

// The copy-forward source's times, else the patient's last session's, else
// the 30 minutes ending now
export const defaultSessionTimes = ({ copyFrom, lastSession, now = new Date() }) => {
  if (hasTimes(copyFrom)) return { startTime: copyFrom.startTime, endTime: copyFrom.endTime };
  if (hasTimes(lastSession)) return { startTime: lastSession.startTime, endTime: lastSession.endTime };
  return {
    startTime: toHHMM(new Date(now.getTime() - 30 * 60 * 1000)),
    endTime: toHHMM(now)
  };
};

// Session length split evenly between TherEx and TherAct; the odd minute
// goes to TherEx
export const splitMinutes = (startTime, endTime) => {
  const duration = getSessionDurationMinutes(startTime, endTime);
  if (duration <= 0) return { therExMinutes: 0, therActMinutes: 0 };
  return { therExMinutes: Math.ceil(duration / 2), therActMinutes: Math.floor(duration / 2) };
};

const hasMinutes = (session) =>
  Boolean(session) && (session.therExMinutes || 0) + (session.therActMinutes || 0) > 0;

// The copy-forward source's minutes, else the last session's, else the
// split. `source` tells the wizard whether the minutes should keep following
// the session times.
export const defaultMinutes = ({ copyFrom, lastSession, startTime, endTime }) => {
  if (hasMinutes(copyFrom)) {
    return { therExMinutes: copyFrom.therExMinutes || 0, therActMinutes: copyFrom.therActMinutes || 0, source: 'copy' };
  }
  if (hasMinutes(lastSession)) {
    return { therExMinutes: lastSession.therExMinutes || 0, therActMinutes: lastSession.therActMinutes || 0, source: 'last' };
  }
  return { ...splitMinutes(startTime, endTime), source: 'split' };
};
