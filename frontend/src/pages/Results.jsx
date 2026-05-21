import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { apiCall } from '../api';
import SeverityBadge from '../components/SeverityBadge.jsx';
import './Result.css';

async function generatePDF(analysis) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 20;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 37, pageWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(241, 245, 249);
  doc.text('NetAnalyzer', margin, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Network Configuration Analysis Report', margin, 23);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin, 29);

  y = 48;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(analysis.configName || 'Unnamed Configuration', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const infoLine = [
    `Status: ${analysis.status || 'completed'}`,
    analysis.analysisTime ? `Analysis Time: ${(analysis.analysisTime / 1000).toFixed(1)}s` : null,
    analysis.createdAt ? `Date: ${new Date(analysis.createdAt).toLocaleDateString()}` : null,
  ].filter(Boolean).join('   |   ');
  doc.text(infoLine, margin, y);
  y += 10;

  const boxWidth = (pageWidth - margin * 2 - 12) / 3;
  const stats = [
    { label: 'Errors', count: analysis.errors?.length || 0, color: [239, 68, 68] },
    { label: 'Vulnerabilities', count: analysis.vulnerabilities?.length || 0, color: [249, 115, 22] },
    { label: 'Recommendations', count: analysis.recommendations?.length || 0, color: [99, 102, 241] },
  ];
  stats.forEach((s, i) => {
    const x = margin + i * (boxWidth + 6);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, boxWidth, 18, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, boxWidth, 18, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...s.color);
    doc.text(String(s.count), x + boxWidth / 2, y + 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, x + boxWidth / 2, y + 15, { align: 'center' });
  });
  y += 26;

  if (analysis.summary) {
    doc.setFillColor(248, 250, 252);
    const summaryLines = doc.splitTextToSize(analysis.summary, pageWidth - margin * 2 - 8);
    const boxH = summaryLines.length * 4.5 + 14;
    doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Summary', margin + 5, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(summaryLines, margin + 5, y + 14);
    y += boxH + 8;
  }

  if (analysis.errors?.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(239, 68, 68);
    doc.text(`Errors Found (${analysis.errors.length})`, margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Type', 'Severity', 'Description', 'Solution']],
      body: analysis.errors.map((e, i) => [
        i + 1,
        e.type || '—',
        (e.severity || 'medium').toUpperCase(),
        e.description || '—',
        e.solution || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.3 },
      headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 28 },
        2: { cellWidth: 18 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 'auto' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (analysis.vulnerabilities?.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(249, 115, 22);
    doc.text(`Vulnerabilities (${analysis.vulnerabilities.length})`, margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Type', 'CVSS', 'Description', 'Recommendation']],
      body: analysis.vulnerabilities.map((v, i) => [
        i + 1,
        v.type || '—',
        v.cvss ? String(v.cvss) : '—',
        v.description || '—',
        v.recommendation || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.3 },
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 28 },
        2: { cellWidth: 14 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 'auto' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  if (analysis.recommendations?.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(99, 102, 241);
    doc.text(`Recommendations (${analysis.recommendations.length})`, margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Recommendation']],
      body: analysis.recommendations.map((r, i) => [i + 1, r]),
      styles: { fontSize: 8, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.3 },
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [238, 242, 255] },
      columnStyles: { 0: { cellWidth: 8 } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageH - 12, pageWidth, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, pageH - 12, pageWidth, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('NetAnalyzer — Automated Network Configuration Analysis', margin, pageH - 5);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageH - 5, { align: 'right' });
  }

  doc.save(`${(analysis.configName || 'analysis').replace(/[^a-zA-Z0-9-_]/g, '_')}_report.pdf`);
}

export default function Results() {
  const { id } = useParams();
  const location = useLocation();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('errors');

  const fetchAnalysis = useCallback(async () => {
    if (id === 'guest') {
      return location.state?.analysis || null;
    }
    const res = await apiCall(`/analysis/${id}`);
    const data = await res.json();
    setAnalysis(data);
    return data;
  }, [id, location.state]);

  useEffect(() => {
    if (id === 'guest' && location.state?.analysis) {
      setAnalysis(location.state.analysis);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAnalysis().then((data) => {
      setLoading(false);
      if (data?.status === 'pending') {
        setPolling(true);
      }
    });
  }, [fetchAnalysis, id, location.state]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const data = await fetchAnalysis();
      if (data.status !== 'pending') setPolling(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, fetchAnalysis]);

  const handleShare = async () => {
    const res = await apiCall(`/analysis/${id}/share`, { method: 'POST' });
    const data = await res.json();
    setShareUrl(`${window.location.origin}/shared/${data.shareToken}`);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${analysis.configName || 'analysis'}.json`; a.click();
  };

  const handleDownloadPDF = () => {
    generatePDF(analysis);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><span className="spinner" style={{ width: 40, height: 40 }} /></div>;
  if (!analysis) return <div className="page"><div className="alert alert-error">Analysis not found</div></div>;

  const isAnalyzing = analysis.status === 'pending';

  return (
    <div className="page">
      <div className="results-header">
        <div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }} onClick={() => navigate('/analyze')}>← Back</button>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>{analysis.configName}</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
            <span className={`badge badge-${analysis.status === 'completed' ? 'success' : analysis.status === 'failed' ? 'failed' : 'pending'}`}>
              {isAnalyzing ? '⏳ Analyzing...' : analysis.status}
            </span>
            {analysis.analysisTime && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⚡ {(analysis.analysisTime / 1000).toFixed(1)}s</span>}
          </div>
        </div>

        {!isAnalyzing && analysis.status === 'completed' && (
          <div className="results-actions">
            {!user ? (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Login to save and export results</span>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={handleDownloadPDF}>📄 PDF</button>
                <button className="btn btn-secondary" onClick={handleDownloadJSON}>⬇ JSON</button>
                <button className="btn btn-secondary" onClick={() => handleCopy(JSON.stringify(analysis, null, 2))}>
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
                <button className="btn btn-secondary" onClick={handleShare}>🔗 Share</button>
              </>
            )}
          </div>
        )}
      </div>

      {shareUrl && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          Share link: <a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a>
          <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(shareUrl)}>Copy</button>
        </div>
      )}

      {isAnalyzing && (
        <div className="analyzing-card card">
          <div className="analyzing-animation"><span className="spinner" style={{ width: 48, height: 48 }} /></div>
          <h2>Running security diagnostics...</h2>
          <p>Our engine is examining your configuration. Hang tight, this usually takes just a few seconds.</p>
          <div className="analyzing-steps">
            {['Parsing configuration', 'Detecting errors', 'Scanning vulnerabilities', 'Checking compliance rules', 'Generating recommendations'].map((s, i) => (
              <div key={i} className="analyzing-step">
                <span className="step-dot" style={{ animationDelay: `${i * 0.5}s` }} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.status === 'completed' && (
        <>
          {analysis.summary && (
            <div className="card summary-card" style={{ marginBottom: 24 }}>
              <h3>📝 Summary</h3>
              <p style={{ marginTop: 10, color: 'var(--text-primary)', lineHeight: 1.8 }}>{analysis.summary}</p>
            </div>
          )}

          <div className="results-stats" style={{ marginBottom: 24 }}>
            <div className="stat-card"><div className="stat-icon"></div><div className="stat-label">Errors</div><div className="stat-value">{analysis.errors?.length || 0}</div></div>
            <div className="stat-card"><div className="stat-icon"></div><div className="stat-label">Vulnerabilities</div><div className="stat-value">{analysis.vulnerabilities?.length || 0}</div></div>
            <div className="stat-card"><div className="stat-icon"></div><div className="stat-label">Recommendations</div><div className="stat-value">{analysis.recommendations?.length || 0}</div></div>
          </div>

          <div className="results-tabs">
            {['errors', 'vulnerabilities', 'recommendations'].map((tab) => (
              <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="tab-count">{tab === 'recommendations' ? analysis.recommendations?.length : analysis[tab]?.length}</span>
              </button>
            ))}
          </div>

          <div className="tab-content" style={{ marginTop: 20 }}>
            {activeTab === 'errors' && (
              <div className="findings-list">
                {(analysis.errors || []).length === 0 ? (
                  <div className="empty-state"><div className="empty-icon"></div><h3>No errors found</h3></div>
                ) : (analysis.errors || []).map((err, i) => (
                  <div key={i} className="finding-card card">
                    <div className="finding-header">
                      <h4>{err.type}</h4>
                      <SeverityBadge severity={err.severity} />
                    </div>
                    <p className="finding-desc">{err.description}</p>
                    {err.solution && <div className="finding-solution"><strong>Solution:</strong> {err.solution}</div>}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'vulnerabilities' && (
              <div className="findings-list">
                {(analysis.vulnerabilities || []).length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">🛡</div><h3>No vulnerabilities found</h3></div>
                ) : (analysis.vulnerabilities || []).map((v, i) => (
                  <div key={i} className="finding-card card">
                    <div className="finding-header">
                      <h4>{v.type}</h4>
                      {v.cvss && <span className="cvss-badge">CVSS {v.cvss}</span>}
                    </div>
                    <p className="finding-desc">{v.description}</p>
                    {v.recommendation && <div className="finding-solution"><strong>Fix:</strong> {v.recommendation}</div>}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="findings-list">
                {(analysis.recommendations || []).length === 0 ? (
                  <div className="empty-state"><div className="empty-icon"></div><h3>No recommendations</h3></div>
                ) : (analysis.recommendations || []).map((rec, i) => (
                  <div key={i} className="finding-card card">
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                      <p style={{ color: 'var(--text-primary)' }}>{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {analysis.status === 'failed' && (
        <div className="card">
          <div className="alert alert-error">
            <strong>Analysis failed.</strong>{' '}
            {analysis.summary ||
              'The AI service may be temporarily unavailable. Please try again.'}
          </div>
          {(analysis.errors?.length > 0) && (
            <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              {(analysis.errors || []).map((err, i) => (
                <p key={i} style={{ margin: '8px 0' }}>
                  {err.description || err.type || JSON.stringify(err)}
                </p>
              ))}
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/analyze')}>New Analysis</button>
        </div>
      )}
    </div>
  );
}