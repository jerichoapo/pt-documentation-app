// Shared formatting utilities for sessions

// Parse app date values in LOCAL time. Plain 'YYYY-MM-DD' strings must not go
// through `new Date(string)`, which treats them as UTC midnight and shifts the
// displayed day in negative-offset timezones.
export const parseAppDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  return new Date(value);
};

// Format a Date as YYYY-MM-DD using local time (for <input type="date">)
export const toDateInputValue = (date) => {
  const d = parseAppDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDate = (date) => {
  const d = parseAppDate(date);
  if (isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

export const formatShortDate = (date) => {
  const d = parseAppDate(date);
  if (isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString();
};

// "Tue, Oct 27, 2026": fits a phone line where formatDate's long form wraps
export const formatMediumDate = (date) => {
  const d = parseAppDate(date);
  if (isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

// Whole years and months from a 'YYYY-MM-DD' birth date, in local time
export const calculateAge = (dob, now = new Date()) => {
  if (!dob) return null;
  const birth = parseAppDate(dob);
  if (isNaN(birth.getTime())) return null;
  const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12
    + (now.getMonth() - birth.getMonth())
    - (now.getDate() < birth.getDate() ? 1 : 0);
  if (totalMonths < 0) return null;
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
};

// Under 6, months matter for tracking progress: "4 y 3 m". Older: "8 years".
export const formatAge = (dob, now = new Date()) => {
  const age = calculateAge(dob, now);
  if (!age) return 'Unknown';
  return age.years < 6 ? `${age.years} y ${age.months} m` : `${age.years} years`;
};

// Display a stored phone number as (XXX) XXX-XXXX when it has 10 digits
export const formatDisplayPhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

export const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const getSessionDurationMinutes = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return endMinutes > startMinutes ? endMinutes - startMinutes : 0;
};

export const formatDuration = (minutes) => {
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

export const formatTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return 'N/A';
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

// True when the patient has a visit frequency set and has fewer sessions this
// calendar week (Mon-Sun, local time) than that frequency calls for
export const isPatientDueThisWeek = (patient, sessions, now = new Date()) => {
  const timesPerWeek = patient?.visitFrequency?.timesPerWeek;
  if (!timesPerWeek) return false;

  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // back to Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const sessionsThisWeek = sessions.filter(s => {
    if (s.patientId !== patient.id || s.deleted_at) return false;
    const date = parseAppDate(s.sessionDate);
    return !isNaN(date.getTime()) && date >= weekStart && date < weekEnd;
  }).length;

  return sessionsThisWeek < timesPerWeek;
};
