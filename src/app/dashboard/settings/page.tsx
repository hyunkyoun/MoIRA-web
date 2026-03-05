'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pwError, setPwError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    setPwError('');
    setPwStatus('loading');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwError(error.message);
      setPwStatus('error');
    } else {
      setPwStatus('success');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="settings-root">
      <nav className="nav-dashboard">
        <div className="nav-left">
          <div className="nav-logo">M o I R A</div>
          <div className="nav-divider" />
          <span className="nav-breadcrumb">Settings</span>
        </div>
        <button className="nav-link" onClick={() => router.back()}>← Back</button>
      </nav>

      <div className="settings-content">
        <h1 className="settings-title">Account Settings</h1>

        {/* Email */}
        <div className="settings-section">
          <div className="settings-field-label">Email Address</div>
          <div className="settings-field-value">{email || '—'}</div>
        </div>

        <div className="settings-divider" />

        {/* Change Password */}
        <div className="settings-section">
          <div className="settings-field-label">Change Password</div>
          <div className="settings-field-desc">
            Must be at least 8 characters.
          </div>
          <form className="settings-pw-form" onSubmit={handlePasswordChange}>
            <input
              className="settings-input"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <input
              className="settings-input"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            {pwError && <div className="settings-error">{pwError}</div>}
            {pwStatus === 'success' && (
              <div className="settings-success">Password updated successfully.</div>
            )}
            <button
              className="settings-btn"
              type="submit"
              disabled={pwStatus === 'loading'}
            >
              {pwStatus === 'loading' ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
