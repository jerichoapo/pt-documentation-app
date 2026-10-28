import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload, User, ChevronRight, HardDrive, Trash2, LogOut, CircleUser, Sheet } from 'lucide-react';
import { usePatientData } from '../context/PatientDataContext';
import { useToastContext } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useProfile } from '../context/ProfileContext';
import { unsavedWorkWarning, describeLastSynced } from '../data/syncLogic';
import { getAppMeta, setAppMeta, daysSince } from '../utils/appMeta';
import { formatShortDate } from '../utils/sessionFormatting';
import { buildNotesCsv, csvFileName } from '../utils/notesCsv';
import { downloadTextFile, todayStamp } from '../utils/download';
import BackLink from '../components/BackLink';

const activeCounts = (data) => ({
  patients: data.patients.filter(p => !p.deleted_at).length,
  sessions: data.sessions.filter(s => !s.deleted_at).length,
  schools: data.schools.filter(s => !s.deleted_at).length
});

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const countsLine = (c) => `${plural(c.patients, 'patient')}, ${plural(c.sessions, 'note')}, ${plural(c.schools, 'school')}`;

const SettingsPage = () => {
  const { patients, sessions, schools, exportData, importData } = usePatientData();
  const { addToast } = useToastContext();
  const confirm = useConfirm();
  const { user, signOut } = useAuth();
  const { status: syncStatus, lastSyncedAt } = useSync();
  const { profile, updateProfile } = useProfile();
  const fileInputRef = useRef(null);
  const [lastBackupAt, setLastBackupAt] = useState(getAppMeta().lastBackupAt || null);
  const [isImporting, setIsImporting] = useState(false);

  const current = activeCounts({ patients, sessions, schools: schools || [] });

  // The data plus the provider profile, so a restore brings back the signature
  const handleDownloadBackup = () => {
    const backup = { ...JSON.parse(exportData()), profile };
    downloadTextFile(`pt-app-backup-${todayStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');

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

    const hasProfile = Boolean(parsed.profile) && typeof parsed.profile === 'object';
    const confirmed = await confirm({
      title: 'Replace all data with this backup?',
      message:
        `This replaces everything currently in the app${hasProfile ? ', including your provider profile' : ''}.\n\n` +
        `Current: ${countsLine(current)}\n` +
        `Backup: ${countsLine(incoming)}`,
      confirmLabel: 'Replace Data',
      danger: true
    });
    if (!confirmed) return;

    setIsImporting(true);
    try {
      await importData(parsed);
      if (hasProfile) await updateProfile(parsed.profile);
    } catch (error) {
      // Toast shown by the context
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCsv = () => {
    // The full data, so a patient whose school was deleted still shows its name
    const full = JSON.parse(exportData());
    downloadTextFile(csvFileName(), buildNotesCsv(full), 'text/csv;charset=utf-8');
    addToast('Notes exported', 'success');
  };

  const handleSignOut = async () => {
    const warning = unsavedWorkWarning();
    if (warning) {
      const confirmed = await confirm({
        title: 'Sign out with unsaved changes?',
        message: warning,
        confirmLabel: 'Sign out anyway',
        danger: true
      });
      if (!confirmed) return;
    }
    const { error } = await signOut();
    if (error) {
      addToast("Couldn't sign out. Check your connection and try again.", 'error');
    }
  };

  const backupAge = daysSince(lastBackupAt);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <BackLink to="/" label="Home" />
      </div>

      <h1 className="text-3xl font-bold text-gray-800 mb-6">Settings</h1>

      {/* Account */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <CircleUser className="text-gray-500" size={20} />
          <h2 className="text-xl font-semibold text-gray-800">Account</h2>
        </div>
        <p className="text-sm text-gray-600 break-words">Signed in as {user?.email}</p>
        <p className={`text-sm mb-4 ${syncStatus === 'failed' ? 'text-red-700' : 'text-gray-600'}`}>
          {syncStatus === 'failed'
            ? 'Changes not saved to the cloud. Check your connection.'
            : syncStatus === 'pending'
              ? 'Saving…'
              : describeLastSynced(lastSyncedAt)}
        </p>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 min-h-[44px] bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>

      {/* Data section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="text-gray-500" size={20} />
          <h2 className="text-xl font-semibold text-gray-800">Your Data</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Your data is saved to the cloud and shared with your other devices. This device keeps a
          copy so the app opens quickly. A backup file is still worth keeping before big changes.
        </p>

        <div className="text-sm text-gray-700 mb-4">
          <span className="font-medium">In this app:</span>{' '}
          {current.patients} patient{current.patients !== 1 ? 's' : ''}, {current.sessions} session
          note{current.sessions !== 1 ? 's' : ''}, {current.schools} school{current.schools !== 1 ? 's' : ''}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 min-h-[44px] bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <Download size={18} />
            Download Backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 min-h-[44px] bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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

        <div className="border-t border-gray-200 mt-4 pt-4">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 min-h-[44px] bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 font-medium"
          >
            <Sheet size={18} />
            Export all notes (CSV)
          </button>
          <p className="text-sm text-gray-500 mt-2">One row per note. Opens in Google Sheets.</p>
        </div>
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
