import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, Building2, Settings } from 'lucide-react';

// Phone-only tab bar. Hidden from the sm breakpoint up, where AppHeader
// carries the same links.
const tabs = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/patients', label: 'Patients', Icon: Users },
  { to: '/schools', label: 'Schools', Icon: Building2 },
  { to: '/settings', label: 'Settings', Icon: Settings }
];

const BottomNav = () => (
  <nav
    className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t pb-[env(safe-area-inset-bottom)]"
    aria-label="Main"
  >
    <div className="h-16 grid grid-cols-4">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`
          }
        >
          <Icon size={22} aria-hidden="true" />
          <span className="text-[11px] font-medium">{label}</span>
        </NavLink>
      ))}
    </div>
  </nav>
);

export default BottomNav;
