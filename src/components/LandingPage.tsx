'use client';

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="landing-root">
      {/* Subtle grid background */}
      <div className="grid-bg" />

      {/* Decorative orbit rings */}
      <div className="orbit-outer" />
      <div className="orbit-inner" />

      {/* Navigation */}
      <nav className="nav-landing">
        <div className="nav-logo">M O I R A</div>
        <button className="btn-ghost" onClick={onLogin}>
          Sign In
          <span style={{ fontSize: '0.9em', letterSpacing: 0 }}>→</span>
        </button>
      </nav>

      {/* Hero */}
      <main className="landing-hero">
        {/* Overline */}
        <div className="overline-label anim-fade-up d-100" style={{ marginBottom: '2rem' }}>
          <span className="accent-line" />
          Language Model Design Studio
        </div>

        {/* Main headline */}
        <h1 className="display-headline anim-fade-up d-200" style={{ marginBottom: '2.5rem' }}>
          Architect<br />
          Tomorrow&apos;s<br />
          <span className="italic-word">Intelligence.</span>
        </h1>

        {/* Description */}
        <p className="hero-description anim-fade-up d-400">
          MoIRA is a precision design platform for language intelligence.
          Build, configure, and deploy your models with unprecedented clarity.
        </p>

        {/* CTA */}
        <div className="anim-fade-up d-500">
          <button className="btn-outline" onClick={onLogin}>
            <span>Begin</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="landing-footer anim-fade-in d-800">
        <span className="footer-meta">© 2025 MoIRA — All rights reserved</span>
        <div className="dot-cluster">
          <div className="dot" style={{ background: '#F59800' }} />
          <div className="dot" style={{ background: 'rgba(240, 230, 208, 0.12)' }} />
          <div className="dot" style={{ background: 'rgba(240, 230, 208, 0.12)' }} />
        </div>
      </footer>
    </div>
  );
}
