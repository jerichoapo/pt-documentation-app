// Puts text on the clipboard. Tries the Clipboard API first, then a hidden
// text box for browsers that refuse it. Resolves true when the copy worked.
export const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Fall back below
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch (error) {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};
