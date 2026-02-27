'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      // Email confirmation disabled — user is signed in immediately
      window.location.href = '/dashboard';
    } else {
      // Email confirmation required
      setConfirmed(true);
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <div className="auth-root">
        <div className="grid-bg" />
        <nav className="nav-landing">
          <Link href="/" className="nav-logo">M O I R A</Link>
        </nav>
        <div className="auth-center">
          <div className="auth-card">
            <div className="overline-label" style={{ marginBottom: '1.5rem' }}>
              <span className="accent-line" />
              Check Your Email
            </div>
            <h1 className="page-title" style={{ marginBottom: '1.25rem' }}>
              Almost<br />
              <span style={{
                fontStyle: 'italic',
                color: 'rgba(10, 22, 40, 0.38)',
                fontFamily: 'var(--font-display), Georgia, serif',
              }}>
                there.
              </span>
            </h1>
            <p className="auth-confirm-text">
              We sent a confirmation link to <strong>{email}</strong>.
              Click the link in the email to activate your account.
            </p>
            <Link href="/auth/signin" className="auth-switch-link" style={{ marginTop: '2rem', display: 'inline-block' }}>
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      <div className="grid-bg" />

      {/* Nav */}
      <nav className="nav-landing">
        <Link href="/" className="nav-logo">M O I R A</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="auth-nav-prompt">Have an account?</span>
          <Link href="/auth/signin" className="nav-link">Sign In</Link>
        </div>
      </nav>

      {/* Form */}
      <div className="auth-center">
        <div className="auth-card">
          <div className="overline-label" style={{ marginBottom: '1.5rem' }}>
            <span className="accent-line" />
            Create Account
          </div>

          <h1 className="page-title" style={{ marginBottom: '2.5rem' }}>
            Begin your<br />
            <span style={{
              fontStyle: 'italic',
              color: 'rgba(10, 22, 40, 0.38)',
              fontFamily: 'var(--font-display), Georgia, serif',
            }}>
              analysis.
            </span>
          </h1>

          <form onSubmit={handleSignUp} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
              />
              <span className="auth-field-hint">Minimum 6 characters</span>
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              <span>{loading ? 'Creating account...' : 'Create Account'}</span>
              {!loading && <span style={{ letterSpacing: 0 }}>→</span>}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link href="/auth/signin" className="auth-switch-link">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
