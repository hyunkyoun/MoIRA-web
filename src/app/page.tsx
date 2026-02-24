'use client';

import { useState } from 'react';
import LandingPage from '@/components/LandingPage';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <div key={isLoggedIn ? 'dashboard' : 'landing'} className="page-transition">
      {isLoggedIn ? (
        <Dashboard onLogout={() => setIsLoggedIn(false)} />
      ) : (
        <LandingPage onLogin={() => setIsLoggedIn(true)} />
      )}
    </div>
  );
}
