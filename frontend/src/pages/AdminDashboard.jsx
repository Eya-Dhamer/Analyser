import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App.jsx';
import { apiCall } from '../api';
import { timeAgo } from '../utils';
import { 
  LayoutDashboard, Users, FileSearch,
  Search, Filter, Plus, Trash2, History,
  TrendingUp, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import './AdminDashboard.css';


function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) return setError('All fields are required');
    setLoading(true);
    try {
      const res = await apiCall('/admin/users', { method: 'POST', body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      onCreated(data);
      onClose();
    } catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Account</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><Trash2 size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}
          <div className="form-group"><label>Full Name</label><input className="form-input" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group"><label>Email Address</label><input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="form-group"><label>Password</label><input className="form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="form-group"><label>Role</label><select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="user">User</option><option value="admin">Admin</option></select></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : '+ Create Account'}</button></div>
        </form>
      </div>
    </div>
  );
}


export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const [showCreateUser, setShowCreateUser] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const uQuery = `?search=${search}&role=${roleFilter === 'all' ? '' : roleFilter}`;
      const aQuery = `?search=${search}&status=${statusFilter === 'all' ? '' : statusFilter}`;
      
      const [sRes, uRes, aRes] = await Promise.all([
        apiCall('/admin/stats'),
        apiCall(`/admin/users${uQuery}`),
        apiCall(`/admin/analyses${aQuery}`),
      ]);

      const [s, u, a] = await Promise.all([
        sRes.json(), uRes.json(), aRes.json()
      ]);

      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
      setAnalyses(Array.isArray(a) ? a : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, statusFilter, roleFilter]);

  const severityChartData = useMemo(() => {
    if (!stats?.severityStats) return [];
    return [
      { name: 'Critical', value: stats.severityStats.critical, color: '#ef4444' },
      { name: 'High', value: stats.severityStats.high, color: '#f97316' },
      { name: 'Medium', value: stats.severityStats.medium, color: '#eab308' },
      { name: 'Low', value: stats.severityStats.low, color: '#22c55e' },
    ].filter(d => d.value > 0);
  }, [stats]);

  const trendData = useMemo(() => {
    if (!stats?.analysesByDay) return [];
    return stats.analysesByDay.map(d => ({
      date: d._id.slice(5),
      count: d.count
    }));
  }, [stats]);

  if (loading && !stats) return <div className="loading-center"><span className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Enterprise platform management & orchestration</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setShowCreateUser(true)}><Plus size={16} /> New User</button>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}><LayoutDashboard size={16} /> Overview</button>
        <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}><Users size={16} /> Users</button>
        <button className={`tab-btn ${tab === 'analyses' ? 'active' : ''}`} onClick={() => setTab('analyses')}><FileSearch size={16} /> Analyses</button>
      </div>

      <div style={{ marginTop: 24 }}>
        {tab === 'overview' && stats && (
          <>
            <div className="stat-grid" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent)' }}><Users size={20} /></div>
                <div className="stat-label">Total Users</div>
                <div className="stat-value">{stats.totalUsers}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}><FileSearch size={20} /></div>
                <div className="stat-label">Total Analyses</div>
                <div className="stat-value">{stats.totalAnalyses}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}><AlertCircle size={20} /></div>
                <div className="stat-label">Detection Rate</div>
                <div className="stat-value">{stats.errorDetectionRate}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#f97316' }}><TrendingUp size={20} /></div>
                <div className="stat-label">Active Rules</div>
                <div className="stat-value">{stats.activeRules}</div>
              </div>
            </div>

            <div className="admin-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
              <div className="card" style={{ minHeight: 400 }}>
                <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={18} /> Analysis Trends</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        itemStyle={{ color: 'var(--accent)' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" style={{ minHeight: 400 }}>
                <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle size={18} /> Severity Split</h3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={severityChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {severityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {(tab === 'users' || tab === 'analyses') && (
          <div className="filter-bar card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="search-wrap" style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" className="form-input" style={{ paddingLeft: 40, width: '100%' }} 
                placeholder={tab === 'users' ? "Search users by name or email..." : "Search by configuration name..."}
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {tab === 'users' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Filter size={16} style={{ color: 'var(--text-muted)' }} />
                <select className="role-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>
            )}
            {tab === 'analyses' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Filter size={16} style={{ color: 'var(--text-muted)' }} />
                <select className="role-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="analyzing">Analyzing</option>
                </select>
              </div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>User</th><th>Role</th><th>Analyses</th><th>Last Login</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td><div style={{ fontWeight: 600 }}>{u.name}</div><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{u.email}</div></td>
                      <td><select className="role-select" value={u.role} onChange={(e) => apiCall(`/admin/users/${u._id}/role`, { method: 'PATCH', body: JSON.stringify({ role: e.target.value }) }).then(fetchData)}><option value="user">User</option><option value="admin">Admin</option></select></td>
                      <td>{u.analysisCount}</td>
                      <td>{u.lastLogin ? timeAgo(u.lastLogin) : 'Never'}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => apiCall(`/admin/users/${u._id}`, { method: 'DELETE' }).then(fetchData)}><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'analyses' && (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>Config ID</th><th>User</th><th>Status</th><th>Findings</th><th>Date</th></tr></thead>
                <tbody>
                  {analyses.map((a) => (
                    <tr key={a._id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.configName}</td>
                      <td style={{ fontSize: 11 }}>{a.userId?.name}<br/><span style={{ color: 'var(--text-muted)' }}>{a.userId?.email}</span></td>
                      <td><span className={`badge badge-${a.status === 'completed' ? 'success' : a.status === 'failed' ? 'failed' : 'pending'}`}>{a.status}</span></td>
                      <td style={{ fontSize: 11 }}>{a.errors?.length || 0} Err / {a.vulnerabilities?.length || 0} Vuln</td>
                      <td>{timeAgo(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {showCreateUser && <CreateUserModal onClose={() => setShowCreateUser(false)} onCreated={fetchData} />}
    </div>
  );
}