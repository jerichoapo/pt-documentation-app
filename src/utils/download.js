import { toDateInputValue } from './sessionFormatting';

// Today's local date as YYYY-MM-DD, for file names.
export const todayStamp = (now = new Date()) => toDateInputValue(now);

// Hands the browser a text file to save.
export const downloadTextFile = (filename, text, mimeType) => {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
