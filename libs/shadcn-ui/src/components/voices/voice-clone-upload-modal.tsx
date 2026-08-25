"use client";

import React, { useState, useRef, useCallback } from 'react';

interface VoiceCloneUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloneType: 'instant' | 'high-fidelity' | null;
  onSuccess?: () => void;
  onUpload?: (formData: FormData) => Promise<void>;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const LANGUAGES = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'it', label: '🇮🇹 Italian' },
  { code: 'pt', label: '🇵🇹 Portuguese' },
  { code: 'ar', label: '🇸🇦 Arabic' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'ko', label: '🇰🇷 Korean' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'ru', label: '🇷🇺 Russian' },
  { code: 'tr', label: '🇹🇷 Turkish' },
  { code: 'nl', label: '🇳🇱 Dutch' },
  { code: 'pl', label: '🇵🇱 Polish' },
  { code: 'sv', label: '🇸🇪 Swedish' },
  { code: 'da', label: '🇩🇰 Danish' },
  { code: 'fi', label: '🇫🇮 Finnish' },
  { code: 'no', label: '🇳🇴 Norwegian' },
  { code: 'el', label: '🇬🇷 Greek' },
  { code: 'he', label: '🇮🇱 Hebrew' },
  { code: 'ms', label: '🇲🇾 Malay' },
  { code: 'sw', label: '🇰🇪 Swahili' },
];

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
          <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 6 }}>{hint}</span>
        </div>
        <span style={{
          background: '#f3f4f6',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 13,
          fontWeight: 700,
          color: '#111827',
          minWidth: 40,
          textAlign: 'center',
        }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--primary, #16a34a)', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export const VoiceCloneUploadModal: React.FC<VoiceCloneUploadModalProps> = ({
  isOpen,
  onClose,
  cloneType,
  onSuccess,
  onUpload
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('en');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState('');

  // Chatterbox-specific settings
  const [exaggeration, setExaggeration] = useState(0.5);
  const [cfgWeight, setCfgWeight] = useState(0.5);
  const [temperature, setTemperature] = useState(0.8);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const primary = 'var(--primary, #16a34a)';

  const resetForm = () => {
    setName('');
    setDescription('');
    setLanguage('en');
    setFile(null);
    setStatus('idle');
    setError(null);
    setProgressStep('');
    setExaggeration(0.5);
    setCfgWeight(0.5);
    setTemperature(0.8);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('audio/')) {
      setFile(dropped);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !file) {
      setError('Please provide a voice name and upload an audio sample.');
      return;
    }

    setError(null);
    setStatus('uploading');
    setProgressStep('Uploading audio sample…');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      formData.append('description', description);
      formData.append('language', language);
      formData.append('type', cloneType || 'instant');
      formData.append('exaggeration', exaggeration.toString());
      formData.append('cfg_weight', cfgWeight.toString());
      formData.append('temperature', temperature.toString());

      setProgressStep('Registering voice with Chatterbox…');
      setStatus('processing');

      if (onUpload) {
        await onUpload(formData);
      }

      setProgressStep('Voice ready!');
      setStatus('done');

      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload');
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  // ---- STATUS SCREENS ----
  if (status === 'uploading' || status === 'processing') {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '48px 40px',
          maxWidth: 420, width: '90%', textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
        }}>
          {/* Spinner */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              border: `4px solid #e5e7eb`,
              borderTop: `4px solid ${primary}`,
              animation: 'spin 1s linear infinite',
            }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#111827' }}>
            {status === 'uploading' ? 'Uploading Voice' : 'Processing Voice'}
          </h3>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>{progressStep}</p>

          {/* Progress steps */}
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'uploading', label: 'Upload audio sample', done: true },
              { key: 'processing', label: 'Register with Chatterbox', done: status === 'processing' },
              { key: 'done', label: 'Voice ready to use', done: false },
            ].map(step => (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: step.done ? primary : '#e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {step.done && <svg width="12" height="12" fill="white" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
                </div>
                <span style={{ fontSize: 14, color: step.done ? '#111827' : '#9ca3af', fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '48px 40px',
          maxWidth: 420, width: '90%', textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
          animation: 'fadeIn 0.3s ease',
        }}>
          <style>{`@keyframes fadeIn { from { opacity:0; transform: scale(0.95); } to { opacity:1; transform: scale(1); } }`}</style>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `${primary}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#111827' }}>Voice Created! 🎉</h3>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 6 }}>
            <strong style={{ color: '#111827' }}>{name}</strong> has been added to your voice library.
          </p>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Your voice is now ready to use in your agents.</p>
        </div>
      </div>
    );
  }

  // ---- MAIN FORM ----
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20,
        maxWidth: 560, width: '100%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px 28px 20px', borderBottom: '1px solid #f3f4f6',
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#111827' }}>
              {cloneType === 'high-fidelity' ? '🎙️ High-Fidelity Clone' : '⚡ Instant Voice Clone'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              {cloneType === 'instant'
                ? 'Upload 30+ seconds of clear audio for fast cloning'
                : 'Upload 5–10 min of clean audio for the highest quality'}
            </p>
          </div>
          <button onClick={handleClose} style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: '#f9fafb', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Error */}
          {(error || status === 'error') && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <span style={{ color: '#b91c1c', fontSize: 13 }}>{error}</span>
            </div>
          )}

          {/* Voice Name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Voice Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Safaricom Customer Support"
              style={{
                width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
                padding: '10px 14px', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = primary}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Description + Language row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Description <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Short description…"
                style={{
                  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
                  padding: '10px 14px', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Language
              </label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                style={{
                  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
                  padding: '10px 14px', fontSize: 14, outline: 'none',
                  background: '#fff', boxSizing: 'border-box', cursor: 'pointer',
                }}
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Audio drop zone */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Audio Sample <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? primary : file ? primary : '#d1d5db'}`,
                borderRadius: 12, padding: '24px 20px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                background: isDragging ? `${primary}08` : file ? `${primary}05` : '#fafafa',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.flac,.m4a,.ogg,audio/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {file ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: `${primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round">
                      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{file.name}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{formatBytes(file.size)} · Click to change</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
                    <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
                  </svg>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>Drop your audio file here</span>
                    <span style={{ color: '#6b7280', fontSize: 14 }}> or click to browse</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>MP3, WAV, FLAC, M4A, OGG · max 10MB</span>
                </div>
              )}
            </div>
          </div>

          {/* Voice Settings */}
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93l-1.41 1.41M1.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M1.93 4.93l1.41 1.41M20 12h2M2 12h2M12 20v2M12 2v2" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>Voice Settings</span>
            </div>

            <SliderRow
              label="Exaggeration"
              hint="Emotion intensity"
              value={exaggeration}
              min={0.25}
              max={2.0}
              step={0.05}
              onChange={setExaggeration}
            />
            <SliderRow
              label="CFG Weight"
              hint="Pace control (lower = faster)"
              value={cfgWeight}
              min={0.0}
              max={1.0}
              step={0.05}
              onChange={setCfgWeight}
            />
            <SliderRow
              label="Temperature"
              hint="Randomness / variety"
              value={temperature}
              min={0.05}
              max={2.0}
              step={0.05}
              onChange={setTemperature}
            />

            <div style={{
              background: '#fff', borderRadius: 8, padding: '10px 12px',
              fontSize: 12, color: '#6b7280', lineHeight: 1.6,
              border: '1px solid #e5e7eb',
            }}>
              💡 <strong>Tips:</strong> Exaggeration 0.5 = neutral. CFG 0.5 = balanced pace.
              Temperature 0.8 = slight variation. Increase exaggeration for more emotional delivery.
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e5e7eb',
                background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !file}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: !name.trim() || !file ? '#d1d5db' : primary,
                color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: !name.trim() || !file ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              Clone Voice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
