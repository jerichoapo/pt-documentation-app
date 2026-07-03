import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload, User, ChevronRight, HardDrive, Trash2 } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';
import { useToastContext } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { getAppMeta, setAppMeta, daysSince } from '../utils/appMeta';
import { formatShortDate } from '../utils/sessionFormatting';

const activeCounts = (data) => ({
  patients: data.patients.filter(p => !p.deleted_at).length,
  sessions: data.sessions.filter(s => !s.deleted_at).length,
  schools: data.schools.filter(s => !s.deleted_at).length
});

const SettingsPage = () => {
  const { patients, sessions, schools, exportData, importData } = usePatientData();
  const { addToast } = useToastContext();
  const confirm = useConfirm();
  const fileInputRef = useRef(null);
  const [lastBackupAt, setLastBackupAt] = useState(getAppMeta().lastBackupAt || null);
  const [isImporting, setIsImporting] = useState(false);

  const current = activeCounts({ patients, sessions, schools: schools || [] });

  const handleDownloadBackup = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pt-app-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const now = new Date().toISOString();
    setAppMeta({ lastBackupAt: now });
    setLastBackupAt(now);
    addToast('Backup downloaded', 'success');
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later
    e.target.value = '';
    if (!file) return;

    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      addToast('That file is not a valid PT App backup.', 'error');
      return;
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.patients) || !Array.isArray(parsed.sessions)) {
      addToast('That file is not a valid PT App backup.', 'error');
      return;
    }

    const incoming = activeCounts({
      patients: parsed.patients,
      sessions: parsed.sessions,
      schools: Array.isArray(parsed.schools) ? parsed.schools : []
    });

    const confirmed = await confirm({
      title: 'Replace all data with this backup?',
      message:
        `This replaces everything currently in the app.\n\n` +
        `Current: ${current.patients} patients, ${current.sessions} notes, ${current.schools} schools\n` +
        `Backup: ${incoming.patients} patients, ${incoming.sessions} notes, ${incoming.schools} schools`,
      confirmLabel: 'Replace Data',
      danger: true
    });
    if (!confirmed) return;

    setIsImporting(true);
    try {
      await importData(parsed);
    } catch (error) {
      // Toast shown by the context
    } finally {
      setIsImporting(false);
    }
  };

  const backupAge = daysSince(lastBackupAt);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft size={20} />
          Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-800 mb-6">Settings</h1>

      {/* Data section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="text-gray-500" size={20} />
          <h2 className="text-xl font-semibold text-gray-800">Your Data</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          All data is stored on this device only. Download a backup regularly so a lost or
          cleared browser doesn't take your notes with it.
        </p>

        <div className="text-sm text-gray-700 mb-4">
          <span className="font-medium">In this app:</span>{' '}
          {current.patients} patient{current.patients !== 1 ? 's' : ''}, {current.sessions} session
          note{current.sessions !== 1 ? 's' : ''}, {current.schools} school{current.schools !== 1 ? 's' : ''}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <Download size={18} />
            Download Backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={18} />
            {isImporting ? 'Importing...' : 'Import Backup'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        <p className="text-sm text-gray-500 mt-3">
          {lastBackupAt
            ? `Last backup: ${formatShortDate(lastBackupAt)}${backupAge !== null ? ` (${backupAge === 0 ? 'today' : `${backupAge} day${backupAge !== 1 ? 's' : ''} ago`})` : ''}`
            : 'Last backup: never'}
        </p>
      </div>

      {/* Profile link */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <Link
          to="/settings/profile"
          className="flex items-center justify-between p-6 hover:bg-gray-50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <User className="text-gray-500" size={20} />
            <div>
              <div className="font-semibold text-gray-800">Provider Profile</div>
              <div className="text-sm text-gray-600">Name, credentials, and license shown on exported notes</div>
            </div>
          </div>
          <ChevronRight className="text-gray-400" size={20} />
        </Link>
      </div>

      {/* Recently Deleted link */}
      <div className="bg-white rounded-lg shadow-md">
        <Link
          to="/recently-deleted"
          className="flex items-center justify-between p-6 hover:bg-gray-50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="text-gray-500" size={20} />
            <div>
              <div className="font-semibold text-gray-800">Recently Deleted</div>
              <div className="text-sm text-gray-600">Restore or permanently remove items deleted in the last 30 days</div>
            </div>
          </div>
          <ChevronRight className="text-gray-400" size={20} />
        </Link>
      </div>
    </div>
  );
};

export default SettingsPage;
