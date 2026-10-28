import React from 'react';
import { useSync } from '../context/SyncContext';

// Stays up until a push succeeds, so she knows the other device is behind.
const SyncBanner = () => {
  const { status, retryPush } = useSync();
  if (status !== 'failed') return null;

  return (
    <div role="status" className="sticky top-14 z-30 bg-red-50 border-b border-red-200">
      <div className="max-w-6xl mx-auto px-4 py-1 flex items-center justify-between gap-3">
        <p className="text-sm text-red-800">Changes not saved to the cloud. Check your connection.</p>
        <button
          onClick={retryPush}
          className="shrink-0 min-h-[44px] px-4 rounded-lg bg-white border border-red-300 text-sm font-medium text-red-800 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    </div>
  );
};

export default SyncBanner;
