'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Dna, BrainCircuit, BarChart2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingPageProps {
  onLogin: () => void;
}

const FEATURES = [
  {
    Icon: Dna,
    title: 'Multi-omics Integration',
    desc: 'Unify genomics, transcriptomics, proteomics, and metabolomics in a single environment. MoIRA normalizes, aligns, and integrates across data modalities for cohesive analysis.',
  },
  {
    Icon: BrainCircuit,
    title: 'AI-Driven Discovery',
    desc: 'Machine learning models trained on biological datasets surface insights invisible to conventional single-layer analysis. From pathway enrichment to biomarker identification.',
  },
  {
    Icon: BarChart2,
    title: 'Precision Analytics',
    desc: 'Statistical rigor meets biological context. Every result is interpretable, reproducible, and traceable to its source data — accelerating peer review and replication.',
  },
  {
    Icon: Layers,
    title: 'Scalable Pipelines',
    desc: 'From single-cell experiments to large cohort studies, MoIRA\'s cloud infrastructure scales with your research ambitions without configuration overhead.',
  },
];

const OMICS = ['Genomics', 'Transcriptomics', 'Proteomics', 'Metabolomics', 'Epigenomics', 'Lipidomics'];

const STATS = [
  { number: '6',     label: 'Integrated omics layers' },
  { number: '10K+',  label: 'Biological pathways mapped' },
  { number: 'AI',    label: 'Driven insights engine' },
];

export default function LandingPage({ onLogin }: LandingPageProps) {
  const featuresRef = useRef<HTMLElement>(null);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-root">

      {/* ── Fixed Nav ─────────────────────────────────────────────── */}
      <nav className="nav-landing">
        <div className="nav-logo">M O I R A</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button className="nav-link" onClick={scrollToFeatures}>Capabilities</button>
          <Link href="/pricing" className="nav-link">Pricing</Link>
          <Button variant="ghost" onClick={onLogin} style={{ marginLeft: '0.5rem' }}>
            Sign In <span style={{ letterSpacing: 0 }}>→</span>
          </Button>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────── */}
      <div className="landing-hero-section">
        <div className="grid-bg" />
        <div className="orbit-outer" />
        <div className="orbit-inner" />

        <main className="landing-hero">
          <div className="overline-label anim-fade-up d-100" style={{ marginBottom: '2rem' }}>
            <span className="accent-line" />
            Multi-omics Informatics Research Assistant
          </div>

          <h1 className="display-headline anim-fade-up d-200" style={{ marginBottom: '2.5rem' }}>
            Decode the<br />
            Language of<br />
            <span className="italic-word">Life.</span>
          </h1>

          <p className="hero-description anim-fade-up d-400">
            MoIRA is an AI-powered platform for integrated multi-omics data analysis.
            Unify your genomic, transcriptomic, proteomic, and metabolomic data to
            uncover biological insights invisible to single-layer analysis.
          </p>

          <div className="hero-cta anim-fade-up d-500">
            <Button variant="default" onClick={onLogin}>
              Begin Analysis
              <span style={{ letterSpacing: 0 }}>→</span>
            </Button>
            <Button variant="ghost" onClick={scrollToFeatures}>
              Learn More
            </Button>
          </div>
        </main>
      </div>

      {/* ── Disciplines Strip ─────────────────────────────────────── */}
      <div className="landing-disciplines anim-fade-in d-600">
        <span className="disciplines-label">Disciplines</span>
        <span className="disciplines-sep" />
        {OMICS.map(o => (
          <span key={o} className="discipline-tag">{o}</span>
        ))}
      </div>

      {/* ── Features Section ──────────────────────────────────────── */}
      <section className="features-section" ref={featuresRef}>
        <div className="features-header">
          <div className="overline-label" style={{ marginBottom: '1.25rem' }}>
            <span className="accent-line" />
            Capabilities
          </div>
          <h2 className="page-title">
            Precision tools for<br />
            <span style={{
              fontStyle: 'italic',
              color: 'rgba(10, 22, 40, 0.38)',
              fontFamily: 'var(--font-display), Georgia, serif'
            }}>
              every layer of biology.
            </span>
          </h2>
        </div>

        <div className="features-grid">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="feature-card">
              <div className="feature-icon-wrap">
                <Icon size={19} strokeWidth={1.5} />
              </div>
              <div className="feature-title">{title}</div>
              <p className="feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── About Section ─────────────────────────────────────────── */}
      <section className="about-section">
        <div>
          <div className="overline-label" style={{ marginBottom: '1.25rem' }}>
            <span className="accent-line" />
            About Multi-omics
          </div>
          <h2 className="page-title" style={{ marginBottom: '2rem' }}>
            Biology is<br />
            <span style={{
              fontStyle: 'italic',
              color: 'rgba(10, 22, 40, 0.38)',
              fontFamily: 'var(--font-display), Georgia, serif'
            }}>
              multi-dimensional.
            </span>
          </h2>

          <p className="about-body-text">
            Multi-omics research integrates data across multiple biological &ldquo;omes&rdquo; —
            from the genome to the metabolome — to reveal the complex molecular networks
            that underlie life, health, and disease.
          </p>

          <blockquote className="about-quote">
            &ldquo;Traditional single-omics studies offer only a partial view. True biological
            understanding emerges when these layers are analyzed together.&rdquo;
          </blockquote>

          <p className="about-body-text">
            MoIRA brings artificial intelligence to this challenge. By learning simultaneously
            from genomic, transcriptomic, proteomic, and metabolomic data, MoIRA uncovers
            patterns and biomarkers that no single-layer analysis could detect — accelerating
            discovery from bench research to clinical translation.
          </p>
        </div>

        <div className="about-side">
          {STATS.map(({ number, label }) => (
            <div key={label} className="about-stat-card">
              <div className="about-stat-number">{number}</div>
              <div className="about-stat-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ───────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="cta-overline">
          <span className="cta-accent-line" />
          Get Started
        </div>
        <h2 className="cta-title">
          Ready to decode<br />
          <em>your data?</em>
        </h2>
        <p className="cta-subtitle">
          MoIRA is the precision platform for multi-omics research teams.
          Start integrating your biological datasets today.
        </p>
        <button className="cta-btn" onClick={onLogin}>
          <span>Begin Analysis</span>
          <span className="btn-arrow">→</span>
        </button>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <span className="footer-meta">© 2025 MoIRA — Multi-omics Informatics Research Assistant</span>
        <div className="dot-cluster">
          <div className="dot" style={{ background: '#2560E0' }} />
          <div className="dot" style={{ background: 'rgba(37, 96, 224, 0.2)' }} />
          <div className="dot" style={{ background: 'rgba(37, 96, 224, 0.2)' }} />
        </div>
      </footer>

    </div>
  );
}
