import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// "Back to <label>" on wider screens, "Back" on phones so it never wraps
const BackLink = ({ to, label }) => (
  <Link
    to={to}
    className="inline-flex items-center gap-2 min-h-[44px] text-blue-600 hover:text-blue-800 font-medium"
  >
    <ArrowLeft size={20} aria-hidden="true" />
    <span className="hidden sm:inline">Back to {label}</span>
    <span className="sm:hidden">Back</span>
  </Link>
);

export default BackLink;
