// Small non-clinical app metadata (backup timestamps, etc.), kept separate
// from the patient data store.

const META_KEY = 'pt-app-meta';

export const getAppMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {};
  } catch (error) {
    return {};
  }
};

export const setAppMeta = (patch) => {
  const meta = { ...getAppMeta(), ...patch };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (error) {
    // Metadata is best-effort; never block the app on it
  }
  return meta;
};

export const daysSince = (isoTimestamp) => {
  if (!isoTimestamp) return null;
  const then = new Date(isoTimestamp).getTime();
  if (isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
};
