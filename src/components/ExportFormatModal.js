import React, { useState } from 'react';
import { Download, FileText, File } from 'lucide-react';

const ExportFormatModal = ({ isOpen, onClose, onExport, isExporting, title }) => {
  const [selectedFormat, setSelectedFormat] = useState('pdf');

  const handleExport = async () => {
    await onExport(selectedFormat);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>

          <div className="space-y-3 mb-6">
            <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={selectedFormat === 'pdf'}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div className="flex items-center space-x-3">
                <FileText className="text-red-500" size={24} />
                <div>
                  <div className="font-medium text-gray-800">PDF Document</div>
                  <div className="text-sm text-gray-600">Best for printing and sharing</div>
                </div>
              </div>
            </label>

            <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="docx"
                checked={selectedFormat === 'docx'}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div className="flex items-center space-x-3">
                <File className="text-blue-500" size={24} />
                <div>
                  <div className="font-medium text-gray-800">Word Document</div>
                  <div className="text-sm text-gray-600">Editable format for further customization</div>
                </div>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              {isExporting ? 'Generating...' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportFormatModal;
