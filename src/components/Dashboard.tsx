'use client';

import { useState, useRef, useCallback } from 'react';

interface DashboardProps {
  onLogout: () => void;
}

interface UploadState {
  file: File | null;
  isDragging: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ color: 'rgba(240, 230, 208, 0.55)' }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ConfigIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ color: 'rgba(240, 230, 208, 0.55)' }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export default function Dashboard({ onLogout }: DashboardProps) {
  const [trainingData, setTrainingData] = useState<UploadState>({ file: null, isDragging: false });
  const [modelConfig, setModelConfig] = useState<UploadState>({ file: null, isDragging: false });

  const trainingRef = useRef<HTMLInputElement>(null);
  const configRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent, setter: React.Dispatch<React.SetStateAction<UploadState>>) => {
      e.preventDefault();
      e.stopPropagation();
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
      e.preventDefault();
      e.stopPropagation();
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

  const bothReady = trainingData.file !== null && modelConfig.file !== null;

  const cardClass = (state: UploadState) => {
    let cls = 'upload-card';
    if (state.isDragging) cls += ' is-dragging';
    else if (state.file) cls += ' has-file';
    return cls;
  };

  return (
    <div className="dashboard-root">
      {/* Navigation */}
      <nav className="nav-dashboard">
        <div className="nav-left">
          <div className="nav-logo">M O I R A</div>
          <div className="nav-divider" />
          <span className="nav-breadcrumb">Dashboard</span>
        </div>
        <button className="btn-ghost" onClick={onLogout}>
          Sign Out
        </button>
      </nav>

      {/* Content */}
      <div className="dashboard-content">
        {/* Header */}
        <div className="anim-fade-up d-0" style={{ marginBottom: '2.75rem' }}>
          <div className="overline-label" style={{ marginBottom: '0.875rem' }}>
            <span className="accent-line" />
            New Project
          </div>
          <h1 className="page-title" style={{ marginBottom: '1rem' }}>
            Upload Your<br />
            <span style={{
              fontStyle: 'italic',
              color: 'rgba(240, 230, 208, 0.45)',
              fontFamily: 'var(--font-display), Georgia, serif'
            }}>
              Model Assets
            </span>
          </h1>
          <p className="page-subtitle">
            Provide your training dataset and model configuration
            to begin designing your language intelligence system.
          </p>
        </div>

        {/* Divider */}
        <div className="section-rule anim-fade-in d-200" style={{ marginBottom: '2.75rem' }} />

        {/* Upload Cards */}
        <div className="upload-zone anim-fade-up d-300" style={{ marginBottom: '2.75rem' }}>

          {/* Card 1 — Training Data */}
          <div
            className={cardClass(trainingData)}
            onDragOver={e => handleDragOver(e, setTrainingData)}
            onDragLeave={() => handleDragLeave(setTrainingData)}
            onDrop={e => handleDrop(e, setTrainingData)}
            onClick={() => trainingRef.current?.click()}
          >
            <input
              ref={trainingRef}
              type="file"
              accept=".jsonl,.csv,.txt,.json"
              style={{ display: 'none' }}
              onChange={e => handleChange(e, setTrainingData)}
            />

            <span className="step-badge">Step 01</span>

            <div className="upload-icon-box">
              <UploadIcon />
            </div>

            <div>
              <div className="card-title">Training Data</div>
              <div className="card-type">Dataset Upload</div>
            </div>

            <p className="card-description">
              Upload your fine-tuning dataset. Supports instruction-following
              pairs, raw corpora, and conversation threads.
            </p>

            <div className="file-tags">
              {['.jsonl', '.csv', '.txt', '.json'].map(ext => (
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
                <div
                  className="file-remove"
                  onClick={e => clearFile(e, setTrainingData, trainingRef)}
                >×</div>
              </div>
            ) : (
              <span className="drop-hint">Click or drag to upload</span>
            )}
          </div>

          {/* Card 2 — Model Config */}
          <div
            className={cardClass(modelConfig)}
            onDragOver={e => handleDragOver(e, setModelConfig)}
            onDragLeave={() => handleDragLeave(setModelConfig)}
            onDrop={e => handleDrop(e, setModelConfig)}
            onClick={() => configRef.current?.click()}
          >
            <input
              ref={configRef}
              type="file"
              accept=".json,.yaml,.yml,.toml"
              style={{ display: 'none' }}
              onChange={e => handleChange(e, setModelConfig)}
            />

            <span className="step-badge">Step 02</span>

            <div className="upload-icon-box">
              <ConfigIcon />
            </div>

            <div>
              <div className="card-title">Model Config</div>
              <div className="card-type">Architecture Definition</div>
            </div>

            <p className="card-description">
              Define your model architecture, layer structure,
              hyperparameters, and training configuration.
            </p>

            <div className="file-tags">
              {['.json', '.yaml', '.yml', '.toml'].map(ext => (
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
                <div
                  className="file-remove"
                  onClick={e => clearFile(e, setModelConfig, configRef)}
                >×</div>
              </div>
            ) : (
              <span className="drop-hint">Click or drag to upload</span>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="anim-fade-up d-500">
          <button
            className={bothReady ? 'btn-primary' : `btn-outline btn-disabled`}
          >
            <span>Continue to Design</span>
            <span className="btn-arrow">→</span>
          </button>
          {!bothReady && (
            <p className="action-hint">Upload both files to continue</p>
          )}
        </div>
      </div>
    </div>
  );
}
