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
