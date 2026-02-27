'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

type ViewState = 'upload' | 'transitioning' | 'analysis';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}
type StepStatus = 'completed' | 'running' | 'pending';

interface UploadState {
  file: File | null;
  isDragging: boolean;
}

interface PipelineStepV {
  id: number;
  label: string;
  sub: string;
  status: StepStatus;
  icon: React.ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

/* ── Icons ─────────────────────────────────────────────────────────────── */

const UploadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const UploadIconLg = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ color: 'rgba(10, 22, 40, 0.5)' }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ConfigIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ConfigIconLg = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ color: 'rgba(10, 22, 40, 0.5)' }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconDatabase = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const IconShield = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconSliders = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const IconBarChart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

const IconNetwork = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const IconFileText = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const SendIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const PipelineIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="5" rx="1" />
    <rect x="9" y="9.5" width="6" height="5" rx="1" />
    <rect x="9" y="17" width="6" height="5" rx="1" />
    <line x1="12" y1="7" x2="12" y2="9.5" />
    <line x1="12" y1="14.5" x2="12" y2="17" />
  </svg>
);

/* ── Static Data ────────────────────────────────────────────────────────── */

const PIPELINE_STEPS_V: PipelineStepV[] = [
  { id: 1, label: 'Data Ingestion',        sub: 'Files loaded',          status: 'completed', icon: <IconDatabase /> },
  { id: 2, label: 'QC & Validation',       sub: 'Format checks',         status: 'running',   icon: <IconShield />   },
  { id: 3, label: 'Normalization',          sub: 'Batch correction',      status: 'pending',   icon: <IconSliders />  },
  { id: 4, label: 'Differential Analysis', sub: 'Statistical modeling',  status: 'pending',   icon: <IconBarChart /> },
  { id: 5, label: 'Pathway Enrichment',    sub: 'Gene set analysis',     status: 'pending',   icon: <IconNetwork />  },
  { id: 6, label: 'Report Generation',     sub: 'Figures + summary',     status: 'pending',   icon: <IconFileText /> },
];

const AI_THOUGHTS = [
  'Parsing dataset structure and file headers…',
  'Detected matrix format: genes × samples (12,847 × 24)',
  'Reading samplesheet — identified 3 experimental conditions',
  'Condition mapping: Control (n=8), Treatment_A (n=8), Treatment_B (n=8)',
  'Checking for batch effects across conditions…',
  'Running preliminary QC metrics on raw count data',
  'Filtering low-count genes using CPM > 1 threshold',
  'Retained 9,241 genes after filtering (72% of input)',
  'Beginning QC validation pipeline…',
];

/* ── Component ──────────────────────────────────────────────────────────── */

export default function Dashboard({ userId }: { userId: string }) {
  const [trainingData, setTrainingData] = useState<UploadState>({ file: null, isDragging: false });
  const [modelConfig, setModelConfig]   = useState<UploadState>({ file: null, isDragging: false });
  const [aiPrompt, setAiPrompt]         = useState('');
  const [projectName, setProjectName]   = useState('New Project');
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [viewState, setViewState]           = useState<ViewState>('upload');
  const [chatInput, setChatInput]           = useState('');
  const [pipelineCollapsed, setPipelineCollapsed] = useState(false);
  const [aiThoughts, setAiThoughts]         = useState<string[]>([]);
  const [analyzeStatus, setAnalyzeStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [pipelineSteps, setPipelineSteps]   = useState<PipelineStepV[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [messages, setMessages]             = useState<ChatMessage[]>([]);

  const router         = useRouter();
  const trainingRef    = useRef<HTMLInputElement>(null);
  const configRef      = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Upload handlers ── */

  const handleDragOver = useCallback(
    (e: React.DragEvent, setter: React.Dispatch<React.SetStateAction<UploadState>>) => {
      e.preventDefault(); e.stopPropagation();
      setter(s => ({ ...s, isDragging: true }));
    }, []
  );

  const handleDragLeave = useCallback(
    (setter: React.Dispatch<React.SetStateAction<UploadState>>) => {
      setter(s => ({ ...s, isDragging: false }));
    }, []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, setter: React.Dispatch<React.SetStateAction<UploadState>>) => {
      e.preventDefault(); e.stopPropagation();
      const file = e.dataTransfer.files[0] ?? null;
      setter({ file, isDragging: false });
    }, []
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<UploadState>>) => {
      const file = e.target.files?.[0] ?? null;
      setter(s => ({ ...s, file }));
    }, []
  );

  const clearFile = (
    e: React.MouseEvent,
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    ref: React.RefObject<HTMLInputElement | null>
  ) => {
    e.stopPropagation();
    setter({ file: null, isDragging: false });
    if (ref.current) ref.current.value = '';
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  /* ── Step name → display metadata ── */

  const buildPipelineSteps = (workflowSteps: string[]): PipelineStepV[] => {
    const iconFor = (name: string): React.ReactNode => {
      const map: Record<string, React.ReactNode> = {
        read_idat_files:       <IconDatabase />,
        quality_control:       <IconShield />,
        combat_normalization:  <IconSliders />,
        basic_statistics:      <IconBarChart />,
        perform_pca:           <IconNetwork />,
        create_heatmap:        <IconBarChart />,
        differential_analysis: <IconSliders />,
        create_volcano_plot:   <IconFileText />,
      };
      return map[name] ?? <IconFileText />;
    };

    const labelFor = (name: string): { label: string; sub: string } => {
      const map: Record<string, { label: string; sub: string }> = {
        read_idat_files:       { label: 'Data Ingestion',        sub: 'Load IDAT files'            },
        quality_control:       { label: 'QC & Validation',       sub: 'Filter probes / samples'    },
        combat_normalization:  { label: 'Normalization',          sub: 'ComBat batch correction'    },
        basic_statistics:      { label: 'Basic Statistics',       sub: 'Summary metrics'            },
        perform_pca:           { label: 'PCA Analysis',           sub: 'Dimensionality reduction'   },
        create_heatmap:        { label: 'Heatmap',                sub: 'Correlation matrix'         },
        differential_analysis: { label: 'Differential Analysis', sub: 'Welch t-test + BH FDR'      },
        create_volcano_plot:   { label: 'Volcano Plot',           sub: 'Significance visualization' },
      };
      return map[name] ?? { label: name.replace(/_/g, ' '), sub: 'Custom step' };
    };

    // Always ensure Data Ingestion is the first step
    const steps = workflowSteps.includes('read_idat_files')
      ? workflowSteps
      : ['read_idat_files', ...workflowSteps];

    return steps.map((name, i) => ({
      id: i + 1,
      ...labelFor(name),
      icon: iconFor(name),
      status: 'pending' as StepStatus,
    }));
  };

  /* ── Continue to Analysis ── */

  const handleContinueToAnalysis = () => {
    if (!bothReady || uploading) return;

    // Reset analysis state for fresh run
    setAnalyzeStatus('loading');
    setAiThoughts([]);
    setPipelineSteps([]);
    setColumnMappings({});
    setUploadError(null);

    (async () => {
      setUploading(true);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        // 1. Upload files
        const form = new FormData();
        form.append('dataset', trainingData.file!);
        form.append('samplesheet', modelConfig.file!);
        form.append('project_title', projectName);
        form.append('analysis_prompt', aiPrompt);

        const uploadRes = await fetch(`${BACKEND_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: form,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.detail ?? `Upload failed (${uploadRes.status})`);
        }

        // 2. AI samplesheet analysis
        const analyzeRes = await fetch(`${BACKEND_URL}/analyze`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            analysis_prompt: aiPrompt.trim() || 'Run a comprehensive methylation analysis.',
          }),
        });
        if (!analyzeRes.ok) {
          const err = await analyzeRes.json().catch(() => ({}));
          throw new Error(err.detail ?? `AI analysis failed (${analyzeRes.status})`);
        }

        const { column_mappings, workflow_steps } = await analyzeRes.json() as {
          column_mappings: Record<string, string>;
          workflow_steps: string[];
        };

        // Store results
        setColumnMappings(column_mappings);
        setPipelineSteps(buildPipelineSteps(workflow_steps));

        // Minimal thought log — details are shown in the center panel
        setAiThoughts([
          'Samplesheet parsed and uploaded.',
          `Detected ${Object.keys(column_mappings).length} column mapping${Object.keys(column_mappings).length !== 1 ? 's' : ''}.`,
          `Suggested ${workflow_steps.length}-step workflow.`,
          'Pipeline configured. Ready to run.',
        ]);
        setAnalyzeStatus('done');

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setAiThoughts([`Error: ${msg}`]);
        setAnalyzeStatus('error');
        setUploadError(msg);
      } finally {
        setUploading(false);
      }
    })();

    // Start UI transition immediately (parallel to upload+analyze)
    setViewState('transitioning');
    setTimeout(() => setViewState('analysis'), 460);
  };

  /* ── Chat handler ── */

  const handleChatSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
  };

  /* ── Helpers ── */

  const bothReady = trainingData.file !== null && modelConfig.file !== null;

  const cardClass = (state: UploadState) => {
    let cls = 'upload-card';
    if (state.isDragging) cls += ' is-dragging';
    else if (state.file) cls += ' has-file';
    return cls;
  };

  /* ── Shared nav markup ── */

  const navJSX = (
    <nav className="nav-dashboard">
      <div className="nav-left">
        <div className="nav-logo">M o I R A</div>
        <div className="nav-divider" />
        <div className="nav-project-wrap">
          <input
            className="nav-project-input"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="Untitled Project"
            maxLength={30}
            spellCheck={false}
          />
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
      </div>
      <Button variant="ghost" onClick={handleSignOut}>Sign Out</Button>
    </nav>
  );

  /* ════════════════════════════════════════════════════════════════════════
     ANALYSIS WORKSPACE VIEW
  ════════════════════════════════════════════════════════════════════════ */

  if (viewState === 'analysis') {
    return (
      <div className="dashboard-root">
        {navJSX}

        <div className="analysis-workspace">

          {/* ── Top: minimized file cards + prompt ── */}
          <div className="analysis-topbar">

            <div className="analysis-mini-cards">
              {/* Dataset mini card */}
              <div className="analysis-mini-card">
                <div className="analysis-mini-card-icon">
                  <UploadIcon />
                </div>
                <div className="analysis-mini-card-info">
                  <span className="analysis-mini-card-label">Dataset</span>
                  <span className="analysis-mini-card-name">
                    {trainingData.file?.name ?? '—'}
                  </span>
                </div>
              </div>

              {/* Samplesheet mini card */}
              <div className="analysis-mini-card">
                <div className="analysis-mini-card-icon">
                  <ConfigIcon />
                </div>
                <div className="analysis-mini-card-info">
                  <span className="analysis-mini-card-label">Samplesheet</span>
                  <span className="analysis-mini-card-name">
                    {modelConfig.file?.name ?? '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="analysis-topbar-divider" />

            {/* Prompt display */}
            <div className="analysis-prompt-strip">
              <span className="analysis-prompt-label">Analysis Prompt</span>
              <span className={`analysis-prompt-text${!aiPrompt.trim() ? ' analysis-prompt-text--empty' : ''}`}>
                {aiPrompt.trim() || 'No prompt provided — running general analysis'}
              </span>
            </div>

          </div>

          {/* ── Main body: pipeline (left) · workspace (center) · AI thoughts (right) ── */}
          <div className="analysis-main">

            {/* Floating expand FAB — appears top-left when pipeline is hidden */}
            {pipelineCollapsed && (
              <button
                className="pipeline-expand-fab"
                onClick={() => setPipelineCollapsed(false)}
                title="Expand pipeline"
              >
                <PipelineIcon />
              </button>
            )}

            {/* Left: vertical pipeline */}
            <div className={`pipeline-panel-v${pipelineCollapsed ? ' pipeline-panel-v--collapsed' : ''}`}>

              {/* Fixed header: title + collapse arrow (stays at top, not scrollable) */}
              <div className="pipeline-panel-v-header">
                <div className="pipeline-panel-v-title">Pipeline</div>
                <button
                  className="pipeline-collapse-btn"
                  onClick={() => setPipelineCollapsed(true)}
                  title="Collapse pipeline"
                >
                  <ArrowLeftIcon />
                </button>
              </div>

              {/* Scrollable steps — fixed width so overflow:hidden clips it cleanly */}
              <div className="pipeline-panel-v-inner">
                {analyzeStatus === 'loading' && pipelineSteps.length === 0 && (
                  <div className="pipeline-step-v">
                    <div className="pipeline-step-v-body">
                      <div className="pipeline-step-v-sub" style={{ paddingTop: '0.5rem' }}>
                        <span className="ai-thought-cursor" style={{ marginRight: '0.4rem' }} />
                        Waiting for AI…
                      </div>
                    </div>
                  </div>
                )}
                {(pipelineSteps.length > 0 ? pipelineSteps : analyzeStatus === 'idle' ? PIPELINE_STEPS_V : []).map((step, i) => {
                  const list = pipelineSteps.length > 0 ? pipelineSteps : PIPELINE_STEPS_V;
                  return (
                    <div key={step.id} className="pipeline-step-v">
                      {/* Icon + connector column */}
                      <div className="pipeline-step-v-track">
                        <div className={`pipeline-step-v-icon pipeline-step-v-icon--${step.status}`}>
                          {step.icon}
                        </div>
                        {i < list.length - 1 && (
                          <div className={`pipeline-step-v-connector${step.status === 'completed' ? ' pipeline-step-v-connector--done' : ''}`} />
                        )}
                      </div>

                      {/* Label + status */}
                      <div className="pipeline-step-v-body">
                        <div className={`pipeline-step-v-label pipeline-step-v-label--${step.status}`}>
                          {step.label}
                        </div>
                        <div className="pipeline-step-v-sub">{step.sub}</div>
                        <div className={`pipeline-step-v-status pipeline-step-v-status--${step.status}`}>
                          {step.status === 'completed' ? 'Done'
                            : step.status === 'running'   ? 'Running…'
                            : 'Queued'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Center: main workspace */}
            <div className="analysis-center-panel">

              {/* Scrollable results area */}
              <div className="center-content-area">

                {analyzeStatus === 'loading' && (
                  <div className="center-loading-hint">
                    <span className="ai-thought-cursor" />
                    Analyzing samplesheet…
                  </div>
                )}

                {analyzeStatus === 'done' && (
                  <div className="ai-result-card">

                    {/* Card header — matches workspace panel header pattern */}
                    <div className="ai-result-card-header">
                      <span className="ai-result-card-title">Analysis Result</span>
                      <span className="ai-resolved-badge">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="5" />
                        </svg>
                        AI
                      </span>
                    </div>

                    <div className="ai-result-card-body">

                      {/* Column Mappings */}
                      {Object.keys(columnMappings).length > 0 && (
                        <>
                          <div className="ai-result-section-label">
                            Column Mappings — {Object.keys(columnMappings).length} detected
                          </div>
                          {Object.entries(columnMappings).map(([concept, col]) => (
                            <div key={concept} className="mapping-row">
                              <span className="mapping-concept">{concept}</span>
                              <span className="mapping-arrow">→</span>
                              <span className="mapping-column">{col}</span>
                            </div>
                          ))}
                        </>
                      )}

                    </div>
                  </div>
                )}

                {analyzeStatus === 'error' && (
                  <div className="center-loading-hint" style={{ color: 'rgba(220,50,50,0.7)' }}>
                    Analysis failed — see error in the status panel →
                  </div>
                )}

                {/* Chat messages — rendered last so they appear below analysis cards */}
                {messages.map((msg, i) => (
                  <div key={i} className={`chat-message chat-message--${msg.role}`}>
                    {msg.text}
                  </div>
                ))}
                <div ref={messagesEndRef} />

              </div>

              {/* Chat bar pinned at bottom */}
              <div className="chat-bar" style={{ margin: '0 1.5rem' }}>
                <textarea
                  className="chat-textarea"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask MoIRA about your analysis…"
                  rows={1}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                />
                <button
                  className="chat-send-btn"
                  onClick={handleChatSend}
                  disabled={!chatInput.trim()}
                >
                  <SendIcon />
                  <span>Send</span>
                </button>
              </div>
            </div>

            {/* Right: AI thought process */}
            <div className="ai-thoughts-panel">
              <div className="ai-thoughts-header">
                <div className={`ai-thoughts-pulse${analyzeStatus === 'loading' ? ' ai-thoughts-pulse--active' : ''}`} />
                <span className="ai-thoughts-title">
                  {analyzeStatus === 'loading' ? 'Analyzing…'
                    : analyzeStatus === 'error'   ? 'Analysis Error'
                    : analyzeStatus === 'done'    ? 'AI Analysis'
                    : 'AI Thought Process'}
                </span>
              </div>

              {/* Loading state */}
              {analyzeStatus === 'loading' && aiThoughts.length === 0 && (
                <div className="ai-thought-line" style={{ animationDelay: '0.1s' }}>
                  <span className="ai-thought-prefix">›</span>
                  <span>
                    Uploading files and connecting to AI
                    <span className="ai-thought-cursor" style={{ marginLeft: '0.25rem' }} />
                  </span>
                </div>
              )}

              {/* Real thoughts from AI */}
              {aiThoughts.map((thought, i) => (
                <div
                  key={i}
                  className="ai-thought-line"
                  style={{ animationDelay: `${0.05 + i * 0.07}s` }}
                >
                  {thought === '─' ? (
                    <span style={{ opacity: 0.18, userSelect: 'none', fontSize: '0.7rem', letterSpacing: '0.15em' }}>
                      ────────────────────
                    </span>
                  ) : (
                    <>
                      <span className="ai-thought-prefix">›</span>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{thought}</span>
                    </>
                  )}
                </div>
              ))}

              {/* Blinking cursor — shown while loading or after done */}
              {(analyzeStatus === 'loading' || analyzeStatus === 'done') && (
                <div
                  className="ai-thought-line"
                  style={{ animationDelay: `${0.05 + aiThoughts.length * 0.07}s` }}
                >
                  <span className="ai-thought-prefix">›</span>
                  <span><span className="ai-thought-cursor" /></span>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
     UPLOAD VIEW (default + transitioning)
  ════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="dashboard-root">
      {navJSX}

      <div className={`upload-section-wrap${viewState === 'transitioning' ? ' upload-section-wrap--exiting' : ''}`}>
        <div className="dashboard-content">

          {/* Header */}
          <div className="anim-fade-up d-0" style={{ marginBottom: '2.75rem' }}>
            <div className="overline-label" style={{ marginBottom: '0.875rem' }}>
              <span className="accent-line" />
              Upload Assets
            </div>
            <h1 className="page-title" style={{ marginBottom: '1rem' }}>
              Upload Your<br />
              <span style={{
                fontStyle: 'italic',
                color: 'rgba(10, 22, 40, 0.38)',
                fontFamily: 'var(--font-display), Georgia, serif'
              }}>
                Data
              </span>
            </h1>
            <p className="page-subtitle">
              Provide your dataset and samplesheet to begin your analysis.
            </p>
          </div>

          <div className="section-rule anim-fade-in d-200" style={{ marginBottom: '2.75rem' }} />

          {/* Upload Cards */}
          <div className="upload-zone anim-fade-up d-300" style={{ marginBottom: '2.75rem' }}>

            {/* Card 1 — Dataset */}
            <Card
              className={cardClass(trainingData)}
              onDragOver={e => handleDragOver(e, setTrainingData)}
              onDragLeave={() => handleDragLeave(setTrainingData)}
              onDrop={e => handleDrop(e, setTrainingData)}
              onClick={() => trainingRef.current?.click()}
            >
              <CardContent className="p-0 flex flex-col gap-4">
                <input
                  ref={trainingRef} type="file" accept=".jsonl,.csv,.txt,.json,.zip"
                  style={{ display: 'none' }} onChange={e => handleChange(e, setTrainingData)}
                />
                <span className="step-badge">Step 01</span>
                <div className="upload-icon-box"><UploadIconLg /></div>
                <div>
                  <div className="card-title">Your Data</div>
                  <div className="card-type">Dataset Upload</div>
                </div>
                <p className="card-description">
                  Upload your main experimental dataset. This file contains the
                  raw or processed measurements that will be analyzed.
                </p>
                <div className="file-tags">
                  {['.jsonl', '.csv', '.txt', '.json', '.zip'].map(ext => (
                    <span key={ext} className="file-tag">{ext}</span>
                  ))}
                </div>
                {trainingData.file ? (
                  <div className="file-indicator">
                    <div className="file-dot" />
                    <div style={{ minWidth: 0 }}>
                      <div className="file-name">{trainingData.file.name}</div>
                      <div className="file-bytes">{formatBytes(trainingData.file.size)}</div>
                    </div>
                    <div className="file-remove" onClick={e => clearFile(e, setTrainingData, trainingRef)}>×</div>
                  </div>
                ) : (
                  <span className="drop-hint">Click or drag to upload</span>
                )}
              </CardContent>
            </Card>

            {/* Card 2 — Samplesheet */}
            <Card
              className={cardClass(modelConfig)}
              onDragOver={e => handleDragOver(e, setModelConfig)}
              onDragLeave={() => handleDragLeave(setModelConfig)}
              onDrop={e => handleDrop(e, setModelConfig)}
              onClick={() => configRef.current?.click()}
            >
              <CardContent className="p-0 flex flex-col gap-4">
                <input
                  ref={configRef} type="file" accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }} onChange={e => handleChange(e, setModelConfig)}
                />
                <span className="step-badge">Step 02</span>
                <div className="upload-icon-box"><ConfigIconLg /></div>
                <div>
                  <div className="card-title">Samplesheet File</div>
                  <div className="card-type">Dataset Annotation File</div>
                </div>
                <p className="card-description">
                  Upload the sample sheet that describes your dataset. This file links sample IDs to
                  experimental conditions, groups, or other metadata required for analysis.
                </p>
                <div className="file-tags">
                  {['.csv', '.xlsx', '.xls'].map(ext => (
                    <span key={ext} className="file-tag">{ext}</span>
                  ))}
                </div>
                {modelConfig.file ? (
                  <div className="file-indicator">
                    <div className="file-dot" />
                    <div style={{ minWidth: 0 }}>
                      <div className="file-name">{modelConfig.file.name}</div>
                      <div className="file-bytes">{formatBytes(modelConfig.file.size)}</div>
                    </div>
                    <div className="file-remove" onClick={e => clearFile(e, setModelConfig, configRef)}>×</div>
                  </div>
                ) : (
                  <span className="drop-hint">Click or drag to upload</span>
                )}
              </CardContent>
            </Card>

          </div>

          <div className="section-rule anim-fade-in d-400" style={{ marginBottom: '2.75rem' }} />

          {/* AI Prompt */}
          <div className="anim-fade-up d-400" style={{ marginBottom: '2.75rem' }}>
            <div className="prompt-card">
              <span className="step-badge">Step 03</span>
              <div>
                <div className="card-title">Analysis Prompt</div>
                <div className="card-type">Natural Language Input</div>
              </div>
              <p className="card-description">
                Describe what you want MoIRA to analyze or discover in your data.
                The more specific your instructions, the more targeted the results.
              </p>
              <div className="prompt-input-wrap">
                <textarea
                  className="prompt-textarea"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="e.g. Identify differentially expressed genes between condition A and B, focusing on pathways related to immune response and inflammation…"
                  rows={5}
                />
                <div className="prompt-footer">
                  <span className="drop-hint">
                    {aiPrompt.length > 0 ? `${aiPrompt.length} chars` : 'Optional — describe your analysis goals'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="anim-fade-up d-500">
            <Button
              variant={bothReady ? 'default' : 'outline'}
              disabled={!bothReady || uploading}
              onClick={handleContinueToAnalysis}
            >
              <span>{uploading ? 'Uploading…' : 'Continue to Analysis Design'}</span>
              {!uploading && <span style={{ letterSpacing: 0 }}>→</span>}
            </Button>
            {!bothReady && !uploadError && (
              <p className="action-hint">Upload both files to continue</p>
            )}
            {uploadError && (
              <p className="action-hint" style={{ color: 'red' }}>{uploadError}</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
