import React, { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';

const RestoreNoteDecisionModal = ({
  isOpen,
  onClose,
  onConfirm,
  patientName,
  additionalNotesCount
}) => {
  const [selectedOption, setSelectedOption] = useState('note-and-patient');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedOption);
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Restore this note?</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6">
            This note belongs to <span className="font-semibold">{patientName}</span>, who is currently deleted.
          </p>

          {/* Radio Options */}
          <div className="space-y-4">
            {/* Restore note only */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="restore-option"
                value="note-only"
                checked={selectedOption === 'note-only'}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-gray-900">Restore note only</div>
                <div className="text-sm text-gray-600">
                  The note will be restored but won't appear in the patient's profile until you restore the patient.
                </div>
              </div>
            </label>

            {/* Restore note and patient */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="restore-option"
                value="note-and-patient"
                checked={selectedOption === 'note-and-patient'}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-gray-900">Restore note and patient</div>
                <div className="text-sm text-gray-600">
                  Both the note and {patientName} will be restored.
                  {additionalNotesCount > 0 && (
                    <span className="block mt-1 text-blue-600">
                      {additionalNotesCount} additional note{additionalNotesCount !== 1 ? 's' : ''} will also be restored with the patient.
                    </span>
                  )}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <RotateCcw size={16} />
            Restore
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreNoteDecisionModal;
