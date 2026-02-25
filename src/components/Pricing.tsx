'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ── Data ───────────────────────────────────────────────────── */

const PLANS = [
  {
    label: 'Starter',
    name: 'Starter',
    desc: 'For independent researchers and graduate students exploring multi-omics analysis.',
    monthly: 0,
    annual: 0,
    annualNote: '',
    cta: 'Get Started Free',
    featured: false,
    features: [
      { text: '1 researcher seat',             active: true  },
      { text: '3 active projects',              active: true  },
      { text: 'Genomics & transcriptomics',     active: true  },
      { text: '5 GB data storage',              active: true  },
      { text: 'Community support',              active: true  },
      { text: 'Proteomics & metabolomics',      active: false },
      { text: 'AI-driven discovery',            active: false },
      { text: 'API access',                     active: false },
      { text: 'Custom workflows',               active: false },
    ],
  },
  {
    label: 'Research Lab',
    name: 'Research Lab',
    desc: 'For research groups and labs running full multi-omics studies with AI-powered insight.',
    monthly: 89,
    annual: 71,
    annualNote: 'Billed annually — save $216/yr',
    cta: 'Start 14-Day Free Trial',
    featured: true,
    features: [
      { text: 'Up to 10 researcher seats',      active: true },
      { text: 'Unlimited projects',             active: true },
      { text: 'Full 6-layer multi-omics',       active: true },
      { text: '100 GB data storage',            active: true },
      { text: 'AI-driven biomarker discovery',  active: true },
      { text: 'Priority support (48 hr)',       active: true },
      { text: 'API access',                     active: true },
      { text: 'Custom analysis workflows',      active: true },
      { text: 'Enterprise SSO',                 active: false },
    ],
  },
  {
    label: 'Institution',
    name: 'Institution',
    desc: 'For universities, hospitals, and CROs requiring enterprise-grade infrastructure and compliance.',
    monthly: 499,
    annual: 399,
    annualNote: 'Billed annually — save $1,200/yr',
    cta: 'Contact Sales',
    featured: false,
    features: [
      { text: 'Unlimited researcher seats',     active: true },
      { text: 'Unlimited projects',             active: true },
      { text: 'Full 6-layer multi-omics',       active: true },
      { text: '1 TB data storage',              active: true },
      { text: 'AI-driven biomarker discovery',  active: true },
      { text: 'Dedicated support team & SLA',   active: true },
      { text: 'API access + custom integrations', active: true },
      { text: 'Enterprise SSO (SAML 2.0)',      active: true },
      { text: 'On-premise deployment option',   active: true },
    ],
  },
];

const FAQS = [
  {
    q: 'Is there a free trial?',
    a: 'Yes. All paid plans include a 14-day free trial with no credit card required. You can explore the full feature set before committing.',
  },
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes. You can upgrade or downgrade your plan at any time from your account settings. Changes take effect immediately and billing is prorated to the day.',
  },
  {
    q: 'Do you offer academic discounts?',
    a: 'Yes. Verified academic institutions receive 40% off all paid plans. Contact our team with your institutional email address to verify and apply the discount.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your data is retained for 90 days after cancellation, giving you ample time to export everything. After 90 days, all data is permanently and securely deleted.',
  },
];

/* ── Component ──────────────────────────────────────────────── */

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="pricing-root">

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="nav-landing">
        <Link href="/" className="nav-logo">M O I R A</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/pricing" className="nav-link" style={{ color: '#2560E0' }}>Pricing</Link>
        </div>
      </nav>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="pricing-header-section">
        <div className="grid-bg" />

        <div className="overline-label anim-fade-up d-100"
          style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <span className="accent-line" />
          Plans &amp; Pricing
          <span className="accent-line" />
        </div>

        <h1 className="display-headline anim-fade-up d-200"
          style={{ fontSize: 'clamp(52px, 6vw, 88px)', marginBottom: '1.25rem' }}>
          Simple,<br />
          <span className="italic-word">transparent</span><br />
          pricing.
        </h1>

        <p className="page-subtitle anim-fade-up d-300"
          style={{ margin: '0 auto', textAlign: 'center', maxWidth: '480px' }}>
          Choose the plan that fits your research scale. No hidden fees,
          no data lock-in. Upgrade or cancel any time.
        </p>

        {/* Billing toggle */}
        <div className="pricing-toggle-row anim-fade-up d-400">
          <span className={`toggle-label${!annual ? ' active' : ''}`}>Monthly</span>
          <button
            className={`toggle-pill${annual ? ' annual' : ''}`}
            onClick={() => setAnnual(a => !a)}
            aria-label="Toggle billing period"
          />
          <span className={`toggle-label${annual ? ' active' : ''}`}>Annual</span>
          <span className="toggle-discount">Save 20%</span>
        </div>
      </div>

      {/* ── Cards ─────────────────────────────────────────────── */}
      <div className="pricing-cards-section">
        <div className="pricing-grid">
          {PLANS.map(plan => {
            const price = annual ? plan.annual : plan.monthly;
            const isFree = price === 0;

            return (
              <div
                key={plan.name}
                className={`pricing-card${plan.featured ? ' featured' : ''}`}
              >
                {plan.featured && (
                  <span className="pricing-badge">Most Popular</span>
                )}

                <div className={`pricing-plan-label${plan.featured ? ' featured' : ''}`}>
                  {plan.label}
                </div>

                <div className="pricing-plan-name">{plan.name}</div>
                <p className="pricing-plan-desc">{plan.desc}</p>

                {/* Price */}
                <div className="pricing-price-row">
                  {!isFree && (
                    <span className="pricing-currency">$</span>
                  )}
                  <span className={`pricing-price${plan.featured ? ' featured' : ''}`}>
                    {isFree ? 'Free' : price}
                  </span>
                  {!isFree && (
                    <span className="pricing-period">/mo</span>
                  )}
                </div>
                <p className="pricing-annual-note">
                  {annual && plan.annualNote ? plan.annualNote : isFree ? 'No credit card required' : 'Billed monthly'}
                </p>

                <div className="pricing-rule" />

                {/* Features */}
                <ul className="pricing-features">
                  {plan.features.map(f => (
                    <li key={f.text} className={`pricing-feature-item${f.active ? '' : ' inactive'}`}>
                      {f.active
                        ? <Check size={14} strokeWidth={2} className="feature-check-icon" style={{ flexShrink: 0, marginTop: 1 }} />
                        : <X     size={14} strokeWidth={1.5} className="feature-check-icon" style={{ flexShrink: 0, marginTop: 1 }} />
                      }
                      {f.text}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {plan.featured ? (
                  <Button variant="default" style={{ width: '100%', justifyContent: 'center' }}>
                    {plan.cta}
                  </Button>
                ) : (
                  <Button variant="outline" style={{ width: '100%', justifyContent: 'center' }}>
                    {plan.cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="faq-section">
        <div className="faq-inner">
          <div className="faq-header">
            <div className="overline-label" style={{ marginBottom: '1.25rem' }}>
              <span className="accent-line" />
              FAQ
            </div>
            <h2 className="page-title">
              Common<br />
              <span style={{
                fontStyle: 'italic',
                color: 'rgba(10, 22, 40, 0.38)',
                fontFamily: 'var(--font-display), Georgia, serif'
              }}>
                questions.
              </span>
            </h2>
          </div>

          <div className="faq-list">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="faq-item">
                <div className="faq-question">{q}</div>
                <p className="faq-answer">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────── */}
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
          Start with the free Starter plan — no credit card, no commitment.
          Scale up when your research demands it.
        </p>
        <Link href="/" className="cta-btn">
          <span>Begin for Free</span>
          <span className="btn-arrow">→</span>
        </Link>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
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
