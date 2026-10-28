import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorModal from './ErrorModal';

test('damaged data offers Reload from the cloud first, and says Start Fresh empties the cloud', () => {
  const onReloadFromCloud = jest.fn();
  render(
    <ErrorModal
      error={{ type: 'CORRUPTION', message: 'Data corruption detected.', corruptData: null }}
      onClearData={() => {}}
      onExportData={() => {}}
      onDismiss={() => {}}
      onReloadFromCloud={onReloadFromCloud}
    />
  );
  const buttons = screen.getAllByRole('button').map((b) => b.textContent.trim());
  expect(buttons[0]).toBe('Reload from the cloud');
  expect(screen.getByText(/also empties the cloud/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reload from the cloud' }));
  expect(onReloadFromCloud).toHaveBeenCalled();
});
