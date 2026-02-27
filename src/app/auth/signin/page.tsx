'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="auth-root">
      <div className="grid-bg" />

      {/* Nav */}
      <nav className="nav-landing">
        <Link href="/" className="nav-logo">M O I R A</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="auth-nav-prompt">No account?</span>
          <Link href="/auth/signup" className="nav-link">Sign Up</Link>
        </div>
      </nav>

      {/* Form */}
      <div className="auth-center">
        <div className="auth-card">
          <div className="overline-label" style={{ marginBottom: '1.5rem' }}>
            <span className="accent-line" />
            Sign In
          </div>

          <h1 className="page-title" style={{ marginBottom: '2.5rem' }}>
            Welcome<br />
            <span style={{
              fontStyle: 'italic',
              color: 'rgba(10, 22, 40, 0.38)',
              fontFamily: 'var(--font-display), Georgia, serif',
            }}>
              back.
            </span>
          </h1>

          <form onSubmit={handleSignIn} className="auth-form">
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
                autoComplete="current-password"
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              {!loading && <span style={{ letterSpacing: 0 }}>→</span>}
            </button>
          </form>

          <p className="auth-switch">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="auth-switch-link">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
