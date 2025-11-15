import React from 'react';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';

const ErrorModal = ({ error, onClearData, onExportData, onDismiss }) => {
  if (!error) return null;

  const handleExport = () => {
    const dataStr = JSON.stringify(error.corruptData || {}, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pt-app-corrupt-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-red-600" size={24} />
          <h2 className="text-xl font-bold text-gray-800">Storage Error</h2>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">{error.message}</p>

          {error.type === 'CORRUPTION' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Your data appears to be corrupted. You can try to export the raw data for recovery,
                or start fresh (this will delete all existing data).
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Download size={16} />
                  Export Data
                </button>
                <button
                  onClick={onClearData}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
                >
                  <RotateCcw size={16} />
                  Start Fresh
                </button>
              </div>
            </div>
          )}

          {error.type === 'QUOTA_EXCEEDED' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Consider exporting and archiving old session data to free up space.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onExportData}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Download size={16} />
                  Export All Data
                </button>
                <button
                  onClick={onDismiss}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {error.type !== 'CORRUPTION' && error.type !== 'QUOTA_EXCEEDED' && (
            <button
              onClick={onDismiss}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
