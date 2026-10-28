import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginPage from '../screens/LoginPage';

// Every route sits behind the login. A signed-out visitor only ever sees
// /login; a signed-in one never does.
const AuthGate = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading…</p>
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
