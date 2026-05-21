import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiCall } from '../api';
import SeverityBadge from '../components/SeverityBadge.jsx';
import { 
  Hexagon, Activity, AlertCircle, ShieldCheck, 
  Lightbulb, Calendar, Terminal, XCircle
} from 'lucide-react';
import './SharedResult.css';

export default function SharedResult() {
  const { token } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('errors');

  useEffect(() => {
    apiCall(`/analysis/shared/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setAnalysis(data);
      })
      .catch(() => setError('Failed to load shared analysis'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-app)' }}>
      <span className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  return (
    <div className="shared-page">
      <div className="shared-header">
        <div className="shared-logo">
          <Hexagon className="logo-icon" size={28} style={{ color: 'var(--accent)' }} />
          <span>NetAnalyzer — Secure Report Access</span>
        </div>
      </div>

      <div className="page">
        {error ? (
          <div className="card" style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ color: 'var(--critical)', marginBottom: 20 }}><XCircle size={64} /></div>
            <h2>Report Expired or Private</h2>
            <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>This analysis link is no longer active or hasn't been shared publicly.</p>
          </div>
        ) : analysis && (
          <>
            <div className="page-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 className="page-title" style={{ fontSize: '1.8rem' }}>{analysis.configName}</h1>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                    <span className="badge badge-success"><ShieldCheck size={12} /> Verified Result</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} /> {new Date(analysis.createdAt).toLocaleDateString()}
                    </span>
                    {analysis.analysisTime && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Activity size={14} /> {(analysis.analysisTime / 1000).toFixed(1)}s processing
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {analysis.summary && (
              <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--accent)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lightbulb size={18} /> Executive Summary</h3>
                <p style={{ marginTop: 12, color: 'var(--text-primary)', lineHeight: 1.8, fontSize: 15 }}>{analysis.summary}</p>
              </div>
            )}

            <div className="stat-grid" style={{ marginBottom: 32 }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--critical)' }}><AlertCircle size={20} /></div>
                <div className="stat-label">Security Errors</div>
                <div className="stat-value">{analysis.errors?.length || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--high)' }}><ShieldCheck size={20} /></div>
                <div className="stat-label">Vulnerabilities</div>
                <div className="stat-value">{analysis.vulnerabilities?.length || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ color: 'var(--accent)' }}><Lightbulb size={20} /></div>
                <div className="stat-label">Recommendations</div>
                <div className="stat-value">{analysis.recommendations?.length || 0}</div>
              </div>
            </div>

            <div className="results-tabs">
              {['errors', 'vulnerabilities', 'recommendations'].map((tab) => (
                <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span className="tab-count">{tab === 'recommendations' ? analysis.recommendations?.length : analysis[tab]?.length}</span>
                </button>
              ))}
            </div>

            <div className="tab-content" style={{ marginTop: 24 }}>
              {activeTab === 'errors' && (analysis.errors || []).length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No configuration errors detected.</div>
              )}
              {activeTab === 'errors' && (analysis.errors || []).map((err, i) => (
                <div key={i} className="finding-card card" style={{ marginBottom: 16 }}>
                  <div className="finding-header">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Terminal size={16} style={{ color: 'var(--text-muted)' }} /> {err.type}
                    </h4>
                    <SeverityBadge severity={err.severity} />
                  </div>
                  <p className="finding-desc">{err.description}</p>
                  {err.solution && (
                    <div className="finding-solution" style={{ background: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.15)' }}>
                      <strong>📝 Recommended Action:</strong> {err.solution}
                    </div>
                  )}
                </div>
              ))}

              {activeTab === 'vulnerabilities' && (analysis.vulnerabilities || []).map((v, i) => (
                <div key={i} className="finding-card card" style={{ marginBottom: 16 }}>
                  <div className="finding-header">
                    <h4>{v.type}</h4>
                    {v.cvss && <span className="cvss-badge">CVSS {v.cvss}</span>}
                  </div>
                  <p className="finding-desc">{v.description}</p>
                  {v.recommendation && (
                    <div className="finding-solution" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.15)' }}>
                      <strong>🛡️ Security Fix:</strong> {v.recommendation}
                    </div>
                  )}
                </div>
              ))}

              {activeTab === 'recommendations' && (analysis.recommendations || []).map((rec, i) => (
                <div key={i} className="finding-card card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ background: 'var(--accent)', color: 'white', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0, fontSize: 13 }}>{i + 1}</div>
                    <p style={{ color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.6, paddingTop: 3 }}>{rec}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}