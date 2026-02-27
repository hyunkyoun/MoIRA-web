'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

/* ── Pipeline Icons ─────────────────────────────────────────────────────── */

const IconDatabase = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconSliders = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const IconBarChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

const IconNetwork = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const IconFileText = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

/* ── Data ───────────────────────────────────────────────────────────────── */

type StepStatus = 'completed' | 'pending';
type Source = 'Dataset' | 'Samplesheet';
type Confidence = 'High' | 'Medium' | 'Low';

interface PipelineStep {
  id: number;
  label: string;
  sub: string;
  status: StepStatus;
  icon: React.ReactNode;
}

interface ColumnMapping {
  field: string;
  column: string;
  source: Source;
  confidence: Confidence;
  index: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 2, label: 'QC & Validation',      sub: 'Format checks, integrity', status: 'pending',   icon: <IconShield /> },
  { id: 3, label: 'Normalization',         sub: 'Batch correction, scaling', status: 'pending',  icon: <IconSliders /> },
  { id: 4, label: 'Differential Analysis', sub: 'Statistical modeling',     status: 'pending',   icon: <IconBarChart /> },
  { id: 5, label: 'Pathway Enrichment',    sub: 'Gene set analysis',        status: 'pending',   icon: <IconNetwork /> },
  { id: 6, label: 'Report Generation',     sub: 'Figures + summary',        status: 'pending',   icon: <IconFileText /> },
];

const COLUMN_MAPPINGS: ColumnMapping[] = [
  { field: 'Sample ID',  column: 'sample_name',     source: 'Samplesheet', confidence: 'High',   index: 'col_01' },
  { field: 'Condition',  column: 'group',            source: 'Samplesheet', confidence: 'High',   index: 'col_02' },
  { field: 'Batch',      column: 'batch_id',         source: 'Samplesheet', confidence: 'Medium', index: 'col_03' },
  { field: 'Gene ID',    column: 'gene_symbol',      source: 'Dataset',     confidence: 'High',   index: 'col_04' },
  { field: 'Expression', column: 'normalized_count', source: 'Dataset',     confidence: 'High',   index: 'col_05' },
  { field: 'Replicate',  column: 'rep_number',       source: 'Samplesheet', confidence: 'Medium', index: 'col_06' },
  { field: 'Time Point', column: 'timepoint',        source: 'Samplesheet', confidence: 'Low',    index: 'col_07' },
  { field: 'Cell Type',  column: 'cell_type',        source: 'Dataset',     confidence: 'High',   index: 'col_08' },
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

const PipelineConnector = ({ done }: { done: boolean }) => (
  <div className={`pipeline-connector${done ? ' pipeline-connector--done' : ''}`} aria-hidden="true" />
);

const PipelineNode = ({ step }: { step: PipelineStep }) => (
  <div className={`pipeline-node pipeline-node--${step.status}`}>
    <div className="pipeline-node-icon-wrap">
      <div className="pipeline-node-icon">
        {step.icon}
      </div>
      {step.status === 'completed' ? (
        <span className="pipeline-status-dot pipeline-status-dot--done" title="Completed">
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.25"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <span className="pipeline-status-dot pipeline-status-dot--pending" />
      )}
    </div>
    <div className="pipeline-node-body">
      <div className="pipeline-node-label">{step.label}</div>
      <div className="pipeline-node-sub">{step.sub}</div>
    </div>
  </div>
);

const ConfidenceDot = ({ level }: { level: Confidence }) => (
  <span className={`conf-dot conf-dot--${level.toLowerCase()}`} />
);

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function AnalysisDesign({ userId: _userId }: { userId: string }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const lowCount = COLUMN_MAPPINGS.filter(m => m.confidence === 'Low').length;
  const mediumCount = COLUMN_MAPPINGS.filter(m => m.confidence === 'Medium').length;

  return (
    <div className="dashboard-root">
      {/* ── Navigation ── */}
      <nav className="nav-dashboard">
        <div className="nav-left">
          <div className="nav-logo">M o I R A</div>
          <div className="nav-divider" />
          <div className="nav-breadcrumb">Analysis Design</div>
        </div>
        <Button variant="ghost" onClick={handleSignOut}>
          Sign Out
        </Button>
      </nav>

      {/* ── Content ── */}
      <div className="dashboard-content">

        {/* Page Header */}
        <div className="anim-fade-up d-0" style={{ marginBottom: '2.75rem' }}>
          <div className="overline-label" style={{ marginBottom: '0.875rem' }}>
            <span className="accent-line" />
            Analysis Pipeline
          </div>
          <h1 className="page-title" style={{ marginBottom: '1rem' }}>
            Your Analysis<br />
            <span style={{
              fontStyle: 'italic',
              color: 'rgba(10, 22, 40, 0.38)',
              fontFamily: 'var(--font-display), Georgia, serif',
            }}>
              Design
            </span>
          </h1>
          <p className="page-subtitle">
            Review the pipeline steps and confirm column mappings
            before running your analysis.
          </p>
        </div>

        {/* ── Section rule ── */}
        <div className="section-rule anim-fade-in d-200" style={{ marginBottom: '2.75rem' }} />

        {/* ════ Section 1: Pipeline Flowchart ════ */}
        <div className="anim-fade-up d-300" style={{ marginBottom: '2.75rem' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span className="step-badge">Step 01</span>
              <div style={{ marginTop: '0.5rem' }}>
                <div className="pipeline-section-title">Pipeline Overview</div>
                <div className="pipeline-section-sub">6 stages · 1 completed</div>
              </div>
            </div>
            <div className="pipeline-legend">
              <span className="pipeline-legend-item">
                <span className="pipeline-legend-dot pipeline-legend-dot--done" />
                Completed
              </span>
              <span className="pipeline-legend-item">
                <span className="pipeline-legend-dot pipeline-legend-dot--pending" />
                Queued
              </span>
            </div>
          </div>

          <div className="pipeline-flow-wrap">
            <div className="pipeline-flow">
              {PIPELINE_STEPS.map((step, i) => (
                <React.Fragment key={step.id}>
                  <PipelineNode step={step} />
                  {i < PIPELINE_STEPS.length - 1 && (
                    <PipelineConnector done={step.status === 'completed'} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section rule ── */}
        <div className="section-rule anim-fade-in d-400" style={{ marginBottom: '2.75rem' }} />

        {/* ════ Section 2: Column Mappings ════ */}
        <div className="anim-fade-up d-500" style={{ marginBottom: '2.75rem' }}>

          {/* Section header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.625rem', flexWrap: 'wrap' }}>
              <span className="step-badge">Step 02</span>
              <span className="ai-resolved-badge">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}>
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                AI-resolved
              </span>
            </div>
            <div className="overline-label" style={{ marginBottom: '0.625rem' }}>
              <span className="accent-line" />
              Column Mappings
            </div>
            <p className="pipeline-section-sub" style={{ marginBottom: '1.25rem' }}>
              MoIRA automatically matched your file columns to required analysis fields.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="mapping-summary-chip">
                {COLUMN_MAPPINGS.length} fields mapped
              </span>
              {mediumCount > 0 && (
                <span className="mapping-summary-chip mapping-summary-chip--warn">
                  <ConfidenceDot level="Medium" />
                  {mediumCount} medium confidence
                </span>
              )}
              {lowCount > 0 && (
                <span className="mapping-summary-chip mapping-summary-chip--alert">
                  <ConfidenceDot level="Low" />
                  {lowCount} low confidence
                </span>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="mapping-table-wrap">
            <div className="mapping-table">

              {/* Header */}
              <div className="mapping-row mapping-row--header">
                <div className="mapping-col mapping-col--field">Required Field</div>
                <div className="mapping-col mapping-col--detected">Detected Column</div>
                <div className="mapping-col mapping-col--source">Source</div>
                <div className="mapping-col mapping-col--conf">Confidence</div>
                <div className="mapping-col mapping-col--idx">Index</div>
              </div>

              {/* Rows */}
              {COLUMN_MAPPINGS.map((row) => (
                <div
                  key={row.field}
                  className={`mapping-row${row.confidence === 'Low' ? ' mapping-row--low' : ''}${row.confidence === 'Medium' ? ' mapping-row--medium' : ''}`}
                >
                  <div className="mapping-col mapping-col--field">
                    <span className="mapping-field-name">{row.field}</span>
                  </div>
                  <div className="mapping-col mapping-col--detected">
                    <span className="mapping-arrow">→</span>
                    <span className="mapping-col-name">{row.column}</span>
                  </div>
                  <div className="mapping-col mapping-col--source">
                    <span className={`source-badge source-badge--${row.source.toLowerCase()}`}>
                      {row.source}
                    </span>
                  </div>
                  <div className="mapping-col mapping-col--conf">
                    <ConfidenceDot level={row.confidence} />
                    <span className="conf-label">{row.confidence}</span>
                  </div>
                  <div className="mapping-col mapping-col--idx">
                    <span className="mapping-idx">{row.index}</span>
                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>

        {/* ── Section rule ── */}
        <div className="section-rule anim-fade-in d-600" style={{ marginBottom: '2.75rem' }} />

        {/* ── Action ── */}
        <div className="anim-fade-up d-600">
          <Button variant="outline" disabled>
            <span>Confirm &amp; Run Analysis</span>
            <span style={{ letterSpacing: 0 }}>→</span>
          </Button>
          <p className="action-hint">
            {lowCount > 0
              ? `${lowCount} low-confidence mapping${lowCount > 1 ? 's' : ''} — review before running`
              : 'Review column mappings before running'}
          </p>
        </div>

      </div>
    </div>
  );
}
