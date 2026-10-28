import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Settings } from 'lucide-react';

// Top bar. On phones it is only the app name (navigation lives in the bottom
// tab bar); from the sm breakpoint up it also carries the nav links.
const navClass = ({ isActive }) =>
  `flex items-center gap-2 min-h-[44px] px-3 rounded-lg font-medium hover:bg-gray-50 ${
    isActive ? 'text-blue-600' : 'text-gray-600'
  }`;

const AppHeader = () => (
  <header className="sticky top-0 z-40 bg-white shadow-sm border-b">
    <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
      <Link to="/" className="flex items-center min-h-[44px] text-lg sm:text-xl font-bold text-gray-800">
        <span className="sm:hidden">PT Notes</span>
        <span className="hidden sm:inline">Pediatric Therapy Notes</span>
      </Link>
      <nav className="hidden sm:flex items-center gap-1">
        <NavLink to="/" end className={navClass}>Home</NavLink>
        <NavLink to="/patients" className={navClass}>Patients</NavLink>
        <NavLink to="/schools" className={navClass}>Schools</NavLink>
        <NavLink to="/settings" className={navClass}>
          <Settings size={20} aria-hidden="true" />
          Settings
        </NavLink>
        <Link
          to="/patients/new"
          className="ml-2 flex items-center min-h-[44px] bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 font-medium"
        >
          + Add Patient
        </Link>
      </nav>
    </div>
  </header>
);

export default AppHeader;
