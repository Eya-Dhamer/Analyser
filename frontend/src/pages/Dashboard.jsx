import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { apiCall } from '../api';
import { timeAgo } from '../utils';
import { 
  Plus, Search, Filter, FileText, CheckCircle, 
  AlertCircle, XCircle, Trash2, ExternalLink, Activity
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchAnalyses = async () => {
    setLoading(true);
    try {
      const query = `?search=${search}&status=${statusFilter === 'all' ? '' : statusFilter}`;
      const res = await apiCall(`/analysis${query}`);
      const data = await res.json();
      setAnalyses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, [search, statusFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this analysis?')) return;
    await apiCall(`/analysis/${id}`, { method: 'DELETE' });
    setAnalyses((prev) => prev.filter((a) => a._id !== id));
  };

  const stats = {
    total: analyses.length,
    completed: analyses.filter((a) => a.status === 'completed').length,
    failed: analyses.filter((a) => a.status === 'failed').length,
    errors: analyses.reduce((s, a) => s + (a.errors?.length || 0), 0),
  };

  return (
    <div className="page">
      <div className="page-header dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">Personal config analysis history & highlights</p>
        </div>
        <Link to="/analyze" className="btn btn-primary btn-lg">
          <Plus size={20} /> New Analysis
        </Link>
      </div>

      <div className="stat-grid" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: 'var(--accent)' }}><Activity size={20} /></div>
          <div className="stat-label">Analyses</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#22c55e' }}><CheckCircle size={20} /></div>
          <div className="stat-label">Completed</div>
          <div className="stat-value">{stats.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#ef4444' }}><AlertCircle size={20} /></div>
          <div className="stat-label">Findings</div>
          <div className="stat-value">{stats.errors}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: '#f97316' }}><XCircle size={20} /></div>
          <div className="stat-label">Failed</div>
          <div className="stat-value">{stats.failed}</div>
        </div>
      </div>

      <div className="filter-bar card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            className="form-input" style={{ paddingLeft: 40, width: '100%' }} placeholder="Search your history..."
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select className="role-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="analyzing">Analyzing</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading && analyses.length === 0 ? (
          <div className="loading-center"><span className="spinner" /></div>
        ) : analyses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FileText size={48} /></div>
            <h3>Nothing found.</h3>
            <p>Try adjusting your search or start a new scan.</p>
            <Link to="/analyze" className="btn btn-primary" style={{ marginTop: 16 }}>Start Analysis</Link>
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
                        {a.configName}
                      </div>
                    </td>
                    <td><span className={`badge badge-${a.status === 'completed' ? 'success' : a.status === 'failed' ? 'failed' : 'pending'}`}>{a.status}</span></td>
                    <td style={{ fontSize: 13 }}>
                       {a.errors?.length || 0} Error{a.errors?.length !== 1 ? 's' : ''}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{timeAgo(a.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        {a.status === 'completed' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/results/${a._id}`)}>
                            <ExternalLink size={12} /> View
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a._id)}>
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