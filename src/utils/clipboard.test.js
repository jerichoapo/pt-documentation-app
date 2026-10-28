import { copyText } from './clipboard';

afterEach(() => {
  delete navigator.clipboard;
  delete document.execCommand;
});

test('uses the Clipboard API when the browser allows it', async () => {
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  await expect(copyText('note')).resolves.toBe(true);
  expect(writeText).toHaveBeenCalledWith('note');
});

test('falls back to a hidden text box when the Clipboard API refuses', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
  document.execCommand = jest.fn(() => true);
  await expect(copyText('note')).resolves.toBe(true);
  expect(document.execCommand).toHaveBeenCalledWith('copy');
  expect(document.querySelector('textarea')).toBeNull();
});

test('reports failure when neither way works', async () => {
  document.execCommand = jest.fn(() => false);
  await expect(copyText('note')).resolves.toBe(false);
});
