import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall } from '../api';
import axiosInstance from '../api';
import { timeAgo } from '../utils';
import { Search, Filter, FileText, Trash2, ExternalLink, Download } from 'lucide-react';
import './Dashboard.css';

const SEARCH_DEBOUNCE_MS = 400;

async function downloadAnalysisExport(id, format) {
  const res = await axiosInstance.get(`/analysis/${id}/export`, {
    params: { format },
    responseType: 'blob',
  });
  const cd = res.headers['content-disposition'];
  let filename = `analysis-${id}.${format}`;
  if (cd) {
    const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(cd);
    if (m) {
      filename = decodeURIComponent((m[1] || m[2] || '').trim());
    }
  }
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function Historique() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exportingId, setExportingId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchAnalyses = useCallback(async () => {
    setLoading(true);
    try {
      const q = `?search=${encodeURIComponent(debouncedSearch)}&status=${
        statusFilter === 'all' ? '' : statusFilter
      }`;
      const res = await apiCall(`/analysis${q}`);
      const data = await res.json();
      setAnalyses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this analysis?')) return;
    await apiCall(`/analysis/${id}`, { method: 'DELETE' });
    setAnalyses((prev) => prev.filter((a) => a._id !== id));
  };

  const handleExport = async (id, format) => {
    setExportingId(`${id}-${format}`);
    try {
      await downloadAnalysisExport(id, format);
    } catch (e) {
      console.error(e);
      let msg = e?.message || 'Download failed';
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          msg = parsed.error || msg;
        } catch {
          /* ignore */
        }
      } else if (e?.response?.data?.error) {
        msg = e.response.data.error;
      }
      window.alert(msg);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header dashboard-header">
        <div>
          <h1 className="page-title">Historique</h1>
          <p className="page-subtitle">Full history of your analyses — export reports as JSON or PDF</p>
        </div>
      </div>

      <div className="filter-bar card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            className="form-input"
            style={{ paddingLeft: 40, width: '100%' }}
            placeholder="Search your history..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className="role-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading && analyses.length === 0 ? (
          <div className="loading-center">
            <span className="spinner" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FileText size={48} />
            </div>
            <h3>Nothing found.</h3>
            <p>Try adjusting your search or start a new scan.</p>
            <Link to="/analyze" className="btn btn-primary" style={{ marginTop: 16 }}>
              Start Analysis
            </Link>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Configuration</th>
                  <th>Status</th>
                  <th>Findings</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((a) => (
                  <tr key={a._id}>
                    <td className="config-name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={14} style={{ color: 'var(--accent-light)' }} />
                        {a.configurationId?.name || 'Unnamed'}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          a.status === 'completed'
                            ? 'success'
                            : a.status === 'failed'
                              ? 'failed'
                              : 'pending'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {a.results?.errors?.length || 0} Error{a.results?.errors?.length !== 1 ? 's' : ''}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{timeAgo(a.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        {a.status === 'completed' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/results/${a._id}`)}
                          >
                            <ExternalLink size={12} /> View
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={exportingId === `${a._id}-json`}
                          title="Download full analysis as JSON"
                          onClick={() => handleExport(a._id, 'json')}
                        >
                          <Download size={12} /> JSON
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={exportingId === `${a._id}-pdf`}
                          title="Download report as PDF"
                          onClick={() => handleExport(a._id, 'pdf')}
                        >
                          <Download size={12} /> PDF
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(a._id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
