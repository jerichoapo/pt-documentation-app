import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginPage from '../screens/LoginPage';

// Every route sits behind the login. A signed-out visitor only ever sees
// /login; a signed-in one never does.
const AuthGate = ({ children }) => {
  const { user, isLoading, isOffline, retry } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading…</p>
      </div>
    );
  }

  // The sign-in is still stored but needs the network to renew
  if (!user && isOffline) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
          <h1 className="text-xl font-bold text-gray-800 mb-3">You're offline</h1>
          <p className="text-sm text-gray-700 mb-6">
            You're still signed in. Connect to the internet and the app opens on its own, or tap
            Try again.
          </p>
          <button
            onClick={retry}
            className="w-full min-h-[44px] px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AuthGate;
