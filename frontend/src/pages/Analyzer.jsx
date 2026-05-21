import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { apiCall } from '../api';
import { formatBytes } from '../utils';
import { Search, Upload, Terminal, AlertCircle, FileText, X } from 'lucide-react';
import './Analyser.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024; 

export default function Analyzer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [configName, setConfigName] = useState('');
  const [configText, setConfigText] = useState('');
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleFile = (e) => {
    if (!user) return setError('Please login to upload files. You can still paste text below.');
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      return setError(`File is too large (${formatBytes(file.size)}). Maximum allowed is 10MB.`);
    }

    setFilename(file.name);
    if (!configName) setConfigName(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (ev) => {
      setConfigText(ev.target.result);
      setError('');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!user) return setError('Please login to upload files. You can still paste text below.');
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return setError(`File is too large (${formatBytes(file.size)}). Maximum allowed is 10MB.`);
      }

      setFilename(file.name);
      if (!configName) setConfigName(file.name.replace(/\.[^.]+$/, ''));
      const reader = new FileReader();
      reader.onload = (ev) => {
        setConfigText(ev.target.result);
        setError('');
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!configText.trim()) return setError('Please provide a configuration to analyze');
    
    if (new Blob([configText]).size > MAX_FILE_SIZE) {
      return setError('The configuration text is too large. Maximum allowed is 10MB.');
    }

    setError('');
    setLoading(true);
    
    try {
      if (user) {
        const res = await apiCall('/analysis/submit', {
          method: 'POST',
          body: JSON.stringify({ configName: configName || 'Unnamed Config', configContent: configText }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Submission failed');
        navigate(`/results/${data.analysisId}`);
      } else {
        const res = await apiCall('/analysis/guest', {
          method: 'POST',
          body: JSON.stringify({ configContent: configText }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Analysis failed');
        navigate(`/results/guest`, { state: { analysis: { ...data, configName: configName || 'Guest Analysis' } } });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Analyze your network.</h1>
        <p className="page-subtitle">Drop your configuration file below or paste it manually. Our engine will handle the rest.</p>
      </div>

      <form className="analyzer-form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}

        <div className="form-group">
          <label>Configuration Name</label>
          <input className="form-input" type="text" placeholder="e.g. router-config-01" value={configName}
            onChange={(e) => setConfigName(e.target.value)} />
        </div>

        <div
          className={`drop-zone ${configText ? 'has-content' : ''} ${!user ? 'disabled' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => {
            if (!user) {
              setError('Please login to upload files. You can still paste text below.');
            } else if (!configText) {
              fileRef.current.click();
            }
          }}
          style={!user ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
        >
          {configText ? (
            <div className="drop-filled">
              <div className="drop-file-info">
                <FileText size={20} style={{ color: 'var(--accent)' }} />
                <span>{filename || 'Pasted content'}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setConfigText(''); setFilename(''); }}>
                  <X size={14} /> Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="drop-placeholder">
              <div className="drop-icon"><Upload size={40} /></div>
              <p>
                {user 
                  ? <>Drag and drop your <strong>.txt</strong> or <strong>.cfg</strong> file here</>
                  : <>Log in to upload your files, or just paste your config below.</>}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {user ? 'or click to browse' : ''}
              </p>
            </div>
          )}
          {user && <input ref={fileRef} type="file" accept=".txt,.cfg,.conf,.log" style={{ display: 'none' }} onChange={handleFile} />}
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Terminal size={14} /> Or paste configuration text</label>
          <textarea className="form-textarea" style={{ minHeight: 180 }} placeholder="interface FastEthernet0/0&#10; ip address 192.168.1.1 255.255.255.0..."
            value={configText} onChange={(e) => setConfigText(e.target.value)} />
        </div>

        <div className="analyzer-actions">
          {user && <button type="button" className="btn btn-secondary" onClick={() => { setConfigText(''); setConfigName(''); setFilename(''); }}>Reset</button>}
          {user === null && <button type="button" className="btn btn-secondary" onClick={() => navigate('/login')}>Login for more features</button>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !configText.trim()}>
            {loading ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Processing...</> : <><Search size={18} /> Run AI Analysis</>}
          </button>
        </div>
      </form>
    </div>
  );
}
