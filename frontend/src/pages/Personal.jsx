import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { apiCall } from '../api';
import { Plus, Activity, CheckCircle, AlertCircle, XCircle, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import './Dashboard.css';

const STATUS_COLORS = {
  completed: '#22c55e',
  failed: '#ef4444',
  analyzing: '#f59e0b',
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(12, 16, 36, 0.95)',
  border: '1px solid rgba(124, 58, 237, 0.35)',
  borderRadius: '10px',
  color: '#e5e7eb',
};

function AnimatedValue({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const start = performance.now();
    const from = display;
    const delta = target - from;

    let frameId;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + delta * eased));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  return display;
}

export default function Personal() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    const fetchAnalyses = async () => {
      setLoading((prev) => (analyses.length === 0 ? true : prev));
      try {
        const res = await apiCall('/analysis');
        const data = await res.json();
        setAnalyses(Array.isArray(data) ? data : []);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
    const intervalId = window.setInterval(fetchAnalyses, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const filteredAnalyses = useMemo(() => {
    if (range === 'all') return analyses;

    const now = Date.now();
    const days = range === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    return analyses.filter((a) => {
      const timestamp = new Date(a.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
  }, [analyses, range]);

  const stats = useMemo(
    () => ({
      total: filteredAnalyses.length,
      completed: filteredAnalyses.filter((a) => a.status === 'completed').length,
      failed: filteredAnalyses.filter((a) => a.status === 'failed').length,
      errors: filteredAnalyses.reduce((sum, a) => sum + (a.errors?.length || 0), 0),
    }),
    [filteredAnalyses]
  );

  const statusChartData = useMemo(
    () => [
      { name: 'Completed', value: stats.completed, key: 'completed' },
      { name: 'Failed', value: stats.failed, key: 'failed' },
      {
        name: 'Analyzing',
        value: filteredAnalyses.filter((a) => a.status === 'analyzing').length,
        key: 'analyzing',
      },
    ].filter((item) => item.value > 0),
    [filteredAnalyses, stats.completed, stats.failed]
  );
  const hasStatusData = statusChartData.length > 0;

  const weeklyTrendData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map = new Map(days.map((d) => [d, { day: d, analyses: 0, findings: 0 }]));

    filteredAnalyses.forEach((analysis) => {
      const date = new Date(analysis.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const dayLabel = days[date.getDay()];
      const current = map.get(dayLabel);
      current.analyses += 1;
      current.findings += analysis.errors?.length || 0;
    });

    return days.map((d) => map.get(d));
  }, [filteredAnalyses]);

  const topConfigsData = useMemo(() => {
    const counts = new Map();
    filteredAnalyses.forEach((a) => {
      const key = a.configName || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name: name.length > 20 ? `${name.slice(0, 20)}...` : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredAnalyses]);

  return (
    <div className="page">
      <div className="page-header dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">Your personal analytics and live insights</p>
          <small className="personal-last-updated">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading latest data...'}
          </small>
          <div className="personal-range-toggle">
            <button
              type="button"
              className={`personal-range-btn ${range === '7d' ? 'active' : ''}`}
              onClick={() => setRange('7d')}
            >
              7d
            </button>
            <button
              type="button"
              className={`personal-range-btn ${range === '30d' ? 'active' : ''}`}
              onClick={() => setRange('30d')}
            >
              30d
            </button>
            <button
              type="button"
              className={`personal-range-btn ${range === 'all' ? 'active' : ''}`}
              onClick={() => setRange('all')}
            >
              All
            </button>
          </div>
        </div>
        <Link to="/analyze" className="btn btn-primary btn-lg">
          <Plus size={20} /> New Analysis
        </Link>
      </div>

      <div className="stat-grid" style={{ marginBottom: 32 }}>
        <div className="stat-card personal-animate-in">
          <div className="stat-icon" style={{ color: 'var(--accent)' }}><Activity size={20} /></div>
          <div className="stat-label">Analyses</div>
          <div className="stat-value"><AnimatedValue value={stats.total} /></div>
        </div>
        <div className="stat-card personal-animate-in personal-delay-1">
          <div className="stat-icon" style={{ color: '#22c55e' }}><CheckCircle size={20} /></div>
          <div className="stat-label">Completed</div>
          <div className="stat-value"><AnimatedValue value={stats.completed} /></div>
        </div>
        <div className="stat-card personal-animate-in personal-delay-2">
          <div className="stat-icon" style={{ color: '#ef4444' }}><AlertCircle size={20} /></div>
          <div className="stat-label">Findings</div>
          <div className="stat-value"><AnimatedValue value={stats.errors} /></div>
        </div>
        <div className="stat-card personal-animate-in personal-delay-3">
          <div className="stat-icon" style={{ color: '#f97316' }}><XCircle size={20} /></div>
          <div className="stat-label">Failed</div>
          <div className="stat-value"><AnimatedValue value={stats.failed} /></div>
        </div>
      </div>

      {loading ? (
        <div className="card loading-center"><span className="spinner" /></div>
      ) : (
        <div className="personal-charts-grid">
          <div className="card personal-chart-card personal-animate-in">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} /> Status Distribution</h3>
            {hasStatusData ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <defs>
                    <linearGradient id="statusCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                    <linearGradient id="statusFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fb7185" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                    <linearGradient id="statusAnalyzing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={84}
                    label
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {statusChartData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={
                          entry.key === 'completed'
                            ? 'url(#statusCompleted)'
                            : entry.key === 'failed'
                            ? 'url(#statusFailed)'
                            : entry.key === 'analyzing'
                            ? 'url(#statusAnalyzing)'
                            : STATUS_COLORS[entry.key] || '#7c3aed'
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ color: '#c4b5fd' }}
                    itemStyle={{ color: '#e5e7eb' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="personal-empty-chart">No status data yet. Run analyses to populate this chart.</div>
            )}
          </div>

          <div className="card personal-chart-card personal-animate-in personal-delay-1">
            <h3 style={{ marginBottom: 16 }}>Weekly Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weeklyTrendData}>
                <defs>
                  <linearGradient id="lineAnalyses" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                  <linearGradient id="lineFindings" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: '#c4b5fd' }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="analyses"
                  stroke="url(#lineAnalyses)"
                  strokeWidth={3}
                  dot={{ r: 2 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive
                  animationDuration={1100}
                />
                <Line
                  type="monotone"
                  dataKey="findings"
                  stroke="url(#lineFindings)"
                  strokeWidth={3}
                  dot={{ r: 2 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive
                  animationDuration={1300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card personal-chart-card personal-chart-card-wide personal-animate-in personal-delay-2">
            <h3 style={{ marginBottom: 16 }}>Most Analyzed Configurations</h3>
            {topConfigsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topConfigsData}>
                  <defs>
                    <linearGradient id="barConfigs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ color: '#c4b5fd' }}
                    itemStyle={{ color: '#e5e7eb' }}
                  />
                  <Bar dataKey="count" fill="url(#barConfigs)" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={950} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="personal-empty-chart">No configuration data yet. Your top configs will appear here.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
