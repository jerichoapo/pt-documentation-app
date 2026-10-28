import React from 'react';

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const Card = ({ title, children }) => (
  <div className="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center px-4 py-12">
    <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
      {title && <h1 className="text-xl font-bold text-gray-800 mb-3">{title}</h1>}
      {children}
    </div>
  </div>
);

const primary = 'w-full min-h-[44px] px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';
const secondary = 'w-full min-h-[44px] px-4 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed';
const danger = 'w-full min-h-[44px] px-4 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed';

// The screens shown instead of the app while the cloud copy and this
// device's copy are being reconciled.
const SyncScreens = ({ gate, isWorking, onRetry, onSignOut, onUpload, onKeepCloud, onReplaceCloud, onDownloadDevice, onContinueWithCloud, onDownloadUnreadable, onContinuePastUnreadable }) => {
  if (gate.kind === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading your caseload…</p>
      </div>
    );
  }

  if (gate.kind === 'error') {
    return (
      <Card title="Can't reach your data">
        <p className="text-sm text-gray-700 mb-3">
          Check your internet connection and try again.
        </p>
        <p className="text-sm text-gray-600 mb-6">
          If you're online and this keeps happening, the database may be paused. It can be
          restored from the Supabase dashboard.
        </p>
        <div className="space-y-3">
          <button onClick={onRetry} className={primary}>Try again</button>
          <button onClick={onSignOut} className={secondary}>Sign out</button>
        </div>
      </Card>
    );
  }

  if (gate.kind === 'migrate') {
    const { patients, sessions, schools } = gate.counts;
    return (
      <Card title="Move this device's data to the cloud">
        <p className="text-base font-medium text-gray-800 mb-3">
          {`${plural(patients, 'patient')}, ${plural(sessions, 'note')}, ${plural(schools, 'school')} on this device`}
        </p>
        <p className="text-sm text-gray-600 mb-6">
          Upload it once so your phone and laptop share the same caseload. Nothing on this
          device is deleted.
        </p>
        <button onClick={onUpload} disabled={isWorking} className={primary}>
          {isWorking ? 'Uploading…' : 'Upload to the cloud'}
        </button>
      </Card>
    );
  }

  if (gate.kind === 'first-device') {
    const { local, cloud } = gate;
    return (
      <Card title="This device has its own data">
        <p className="text-base font-medium text-gray-800 mb-3">
          {`This device: ${plural(local.patients, 'patient')}, ${plural(local.sessions, 'note')}. Cloud: ${plural(cloud.patients, 'patient')}, ${plural(cloud.sessions, 'note')}.`}
        </p>
        <p className="text-sm text-gray-600 mb-6">
          Choose which to keep. Nothing changes until you choose. Keeping the cloud data
          downloads a backup of this device's data first.
        </p>
        <div className="space-y-3">
          <button onClick={onKeepCloud} disabled={isWorking} className={primary}>Keep the cloud data</button>
          <button onClick={onReplaceCloud} disabled={isWorking} className={danger}>
            Replace the cloud data with this device's
          </button>
        </div>
      </Card>
    );
  }

  if (gate.kind === 'unreadable') {
    return (
      <Card title="This device's saved data can't be read">
        <p className="text-sm text-gray-700 mb-3">
          The copy of your data on this device is damaged, so the app will use the cloud data
          instead.
        </p>
        <p className="text-sm text-gray-600 mb-6">
          To keep the damaged copy for recovery, download it first.
        </p>
        <div className="space-y-3">
          <button onClick={onDownloadUnreadable} className={secondary}>Download it</button>
          <button onClick={onContinuePastUnreadable} className={primary}>Continue with the cloud data</button>
        </div>
      </Card>
    );
  }

  if (gate.kind === 'conflict') {
    return (
      <Card title="Some changes didn't reach the cloud">
        <p className="text-sm text-gray-700 mb-3">
          This device has changes that never reached the cloud, and your other device has saved
          newer changes since. The app will use the cloud data.
        </p>
        <p className="text-sm text-gray-600 mb-6">
          To keep a copy of this device's data, download it first. You can restore it later
          from Settings.
        </p>
        <div className="space-y-3">
          <button onClick={onDownloadDevice} className={secondary}>Download this device's data</button>
          <button onClick={onContinueWithCloud} className={primary}>Continue with the cloud data</button>
        </div>
      </Card>
    );
  }

  return null;
};

export default SyncScreens;
