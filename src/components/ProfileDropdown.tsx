'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from './ThemeProvider';
import type { Theme } from './ThemeProvider';

const SunIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MonitorIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const MoonIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const THEME_OPTIONS: { value: Theme; Icon: () => React.ReactElement; label: string }[] = [
  { value: 'light',  Icon: SunIcon,     label: 'Light' },
  { value: 'system', Icon: MonitorIcon, label: 'Auto'  },
  { value: 'dark',   Icon: MoonIcon,    label: 'Dark'  },
];

export function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const initial = email ? email[0].toUpperCase() : '·';

  return (
    <div className="profile-dropdown-wrap" ref={ref}>
      <button
        className="profile-avatar-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Profile menu"
      >
        {initial}
      </button>

      {open && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-email">{email}</div>

          <div className="profile-dropdown-divider" />

          <div className="profile-dropdown-section">
            <span className="profile-dropdown-label">Theme</span>
            <div className="profile-theme-toggle">
              {THEME_OPTIONS.map(({ value, Icon, label }) => (
                <button
                  key={value}
                  className={`profile-theme-btn${theme === value ? ' active' : ''}`}
                  onClick={() => setTheme(value)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="profile-dropdown-divider" />

          <button
            className="profile-dropdown-item"
            onClick={() => { setOpen(false); router.push('/dashboard/settings'); }}
          >
            Settings
          </button>
          <button
            className="profile-dropdown-item profile-dropdown-item--danger"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
