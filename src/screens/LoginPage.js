import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const messageFor = (error) => {
  if (error?.status === 400 || /invalid login credentials/i.test(error?.message || '')) {
    return 'Email or password is incorrect.';
  }
  return "Can't reach the server. Check your connection and try again.";
};

const LoginPage = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    // On success the auth state change swaps this screen for the app
    if (signInError) {
      setError(messageFor(signInError));
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full min-h-[44px] px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-gray-100 flex items-start sm:items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800">PT Notes</h1>
        <p className="text-sm text-gray-600 mt-1 mb-6">Sign in to see your caseload.</p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`${inputClass} mb-4`}
          />

          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
          />

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="w-full mt-6 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
