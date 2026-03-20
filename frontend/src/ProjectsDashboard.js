import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Area, AreaChart, ScatterChart, Scatter, ZAxis,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  ArrowLeft, Search, Bell, Grid, FileText, Globe, Zap, Clock, Database, BarChart2, TrendingUp, Activity, HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const TAB2_API = 'http://localhost:8000/api/tab2';
const COLORS = ['#ff4d6d', '#00c864', '#f97316', '#3b82f6', '#a855f7', '#ec4899', '#2dd4bf', '#fbbf24'];

const fmt = (n) => n != null ? Number(n).toLocaleString() : '—';
const fmtK = (n) => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

const CustomScatterTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: '#0c0c0e', border: '1px solid #333', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
        <h4 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700 }}>{data.name}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
          <div style={{ color: '#00c864' }}>Active Users: {data.users}</div>
          <div style={{ color: '#ff4d6d' }}>Videos: {fmt(data.videos)}</div>
          <div style={{ color: '#f97316' }}>Productivity: {data.index}</div>
        </div>
      </div>
    );
  }
  return null;
};

const ProjectsDashboard = () => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [d, setD] = useState(null);

  useEffect(() => {
    fetch(`${TAB2_API}/all`)
      .then(r => r.json())
      .then(setD)
      .catch(() => {});
  }, []);

  const navItems = [
    { id: 'Overview', icon: <Grid size={18} />, label: 'Overview' },
    { id: 'Editorial Yield', icon: <FileText size={18} />, label: 'Editorial Yield' },
    { id: 'Publishing Ecosystem', icon: <Globe size={18} />, label: 'Publishing Ecosystem' },
    { id: 'Output Generation Rate', icon: <Zap size={18} />, label: 'Output Generation Rate' },
    { id: 'Monthly Productivity Index', icon: <Activity size={18} />, label: 'Monthly Productivity Index' },
    { id: 'Duration Footprint', icon: <Clock size={18} />, label: 'Duration Footprint' },
    { id: 'Metadata Health', icon: <Database size={18} />, label: 'Metadata Health' },
    { id: 'Platform Adoption Velocity', icon: <TrendingUp size={18} />, label: 'Platform Adoption Velocity' },
    { id: 'Usage Intensity Score', icon: <Activity size={18} />, label: 'Usage Intensity Score' },
    { id: 'Channel Productivity', icon: <BarChart2 size={18} />, label: 'Channel Productivity' },
    { id: 'Output Diversity', icon: <Globe size={18} />, label: 'Output Diversity' },
    { id: 'Content Impact', icon: <TrendingUp size={18} />, label: 'Content Impact' },
  ];

  if (!d) {
    return (
      <div className="projects-dashboard-layout">
        <aside className="projects-sidebar">
          <div className="projects-sidebar-header">
            <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
            <div className="sidebar-brand mini"><span style={{ fontSize: '14px', fontWeight: '800', color: '#ff4d6d' }}>FRAMMER AI</span></div>
          </div>
        </aside>
        <main className="projects-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading analytics…</main>
      </div>
    );
  }

  const ov = d.overview;
  const ey = d.editorial_yield;
  const eco = d.ecosystem;
  const gr = d.generation_rate;
  const pr = d.productivity;
  const dur = d.duration;
  const mh = d.metadata_health;
  const adp = d.adoption;
  const uis = d.usage_intensity;
  const cp = d.channel_productivity;
  const od = d.output_diversity;
  const ci = d.content_impact;

  const renderOverview = () => (
    <div className="projects-content">
      <svg style={{ height: 0, width: 0, position: 'absolute' }}>
        <defs>
          <linearGradient id="colorUploaded" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
          <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00c864" stopOpacity={0.3}/><stop offset="95%" stopColor="#00c864" stopOpacity={0}/></linearGradient>
          <linearGradient id="colorPublished" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.3}/><stop offset="95%" stopColor="#ff4d6d" stopOpacity={0}/></linearGradient>
        </defs>
      </svg>
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card"><div className="kpi-icon-box"><Database size={20} /></div><div><p className="kpi-label">UPLOADED</p><h2 className="kpi-value">{fmt(ov.total_uploaded)}</h2></div></div>
        <div className="projects-kpi-card"><div className="kpi-icon-box"><Activity size={20} /></div><div><p className="kpi-label">AI CREATED</p><h2 className="kpi-value">{fmt(ov.total_created)}</h2></div></div>
        <div className="projects-kpi-card"><div className="kpi-icon-box" style={{ color: '#00c864' }}><Globe size={20} /></div><div><p className="kpi-label">PUBLISHED</p><h2 className="kpi-value">{fmt(ov.total_published)}</h2></div></div>
        <div className="projects-kpi-card"><div className="kpi-icon-box" style={{ color: '#ff4d6d' }}><Zap size={20} /></div><div><p className="kpi-label">PUBLISH RATE</p><h2 className="kpi-value">{ov.publish_rate}%</h2></div></div>
      </div>

      <div className="projects-stats-grid">
        <div className="projects-stat-box"><p className="stat-label">Total Published</p><h3 className="stat-value">{fmt(ov.total_published)}</h3></div>
        <div className="projects-stat-box"><p className="stat-label">Active Users</p><h3 className="stat-value">{fmt(ov.active_users)}</h3></div>
        <div className="projects-stat-box"><p className="stat-label">Publish Rate</p><h3 className="stat-value">{ov.publish_rate}%</h3><p className="stat-status-ok">{ov.publish_rate >= 80 ? 'Above target (80%)' : 'Below target (80%)'}</p></div>
        <div className="projects-stat-box"><p className="stat-label">Avg CEF</p><h3 className="stat-value">{gr.avg_rate}×</h3><p className="kpi-sub">outputs per upload</p></div>
      </div>

      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Monthly Content Pipeline</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ov.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="uploaded" stackId="1" stroke="#a855f7" fill="url(#colorUploaded)" fillOpacity={1} name="Uploaded" />
                <Area type="monotone" dataKey="created" stackId="1" stroke="#00c864" fill="url(#colorCreated)" fillOpacity={1} name="Created" />
                <Area type="monotone" dataKey="published" stackId="1" stroke="#ff4d6d" fill="url(#colorPublished)" fillOpacity={1} name="Published" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Input Type Breakdown</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ov.input_types} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#444" fontSize={10} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend iconType="circle" />
                <Bar dataKey="uploaded" fill="#a855f7" name="Uploaded" stackId="a" />
                <Bar dataKey="created" fill="#00c864" name="Created" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="projects-table-section">
        <h4>Overall Summary Metrics</h4>
        <table className="projects-summary-table">
          <thead><tr><th>METRIC</th><th>UPLOADED</th><th>CREATED</th><th>PUBLISHED</th><th>PUBLISH RATE</th></tr></thead>
          <tbody>
            <tr>
              <td>Total Processing</td><td>{fmt(ov.total_uploaded)}</td><td>{fmt(ov.total_created)}</td><td>{fmt(ov.total_published)}</td>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ color: '#00c864', fontWeight: 700 }}>{ov.publish_rate}%</span><div className="progress-bg"><div className="progress-fill" style={{ width: `${ov.publish_rate}%`, backgroundColor: '#00c864' }}></div></div></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderEditorialYield = () => (
    <div className="projects-content">
      <div className="projects-chart-card large">
        <h4>Created vs Published &amp; Expansion Factor</h4>
        <p className="chart-subtitle">Output efficiency and creation multiplier</p>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ey}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
              <Legend />
              <Area type="monotone" dataKey="created" fill="#00c864" fillOpacity={0.05} stroke="none" />
              <Line type="monotone" dataKey="created" stroke="#00c864" strokeWidth={2} dot={{ r: 4 }} name="Created Volume" />
              <Line type="monotone" dataKey="published" stroke="#ff4d6d" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} name="Published Volume" />
              <Line yAxisId="right" type="stepAfter" dataKey="expansion" stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} name="Expansion Factor (x)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Monthly Publish Win Rate</h4>
          <p className="chart-subtitle">% of created content that got published</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ey}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Bar dataKey="publish_rate_pct" name="Publish Rate %" radius={[4, 4, 0, 0]}>
                  {ey.map((e, i) => <Cell key={i} fill={e.publish_rate_pct >= 5 ? '#00c864' : '#ff4d6d'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Monthly Drop-off (Wastage)</h4>
          <p className="chart-subtitle">Created minus Published</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ey}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Area type="monotone" dataKey="dropoff" stroke="#ff4d6d" fill="#ff4d6d" fillOpacity={0.15} name="Drop-off" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEcosystem = () => {
    const platData = eco.platform_dist.map((p, i) => ({ ...p, color: COLORS[i % COLORS.length] }));
    return (
      <div className="projects-content">
        <div className="projects-charts-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
          <div className="projects-chart-card">
            <h4>Publishing Ecosystem Map</h4>
            <p className="chart-subtitle">Platform distribution by published count</p>
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platData} dataKey="value" innerRadius={60} outerRadius={120} paddingAngle={2} stroke="none" label={({ name, pct }) => `${name} ${pct}%`}>
                    {platData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="ecosystem-stats-overlay">
              <div className="eco-platform-row">
                {platData.slice(0, 4).map((p, i) => (
                  <div key={i} className="eco-platform-card"><div className="dot" style={{ backgroundColor: p.color }}></div><span className="label">{p.name}</span><span className="val">{p.pct}%</span></div>
                ))}
              </div>
            </div>
          </div>
          <div className="projects-chart-card">
            <h4>Top Channels by Published Count</h4>
            <p className="chart-subtitle">Channel-level distribution</p>
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eco.channel_dist.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                  <XAxis type="number" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#444" fontSize={10} tickLine={false} axisLine={false} width={60} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                  <Bar dataKey="value" fill="#ff4d6d" radius={[0, 4, 4, 0]} name="Published" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGenerationRate = () => (
    <div className="projects-content">
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card mini"><p className="kpi-label">Avg Generation Rate</p><h2 className="kpi-value" style={{ color: '#00c864' }}>{gr.avg_rate}</h2><p className="kpi-sub">items per upload</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Peak Rate</p><h2 className="kpi-value" style={{ color: '#ff4d6d' }}>{gr.peak_rate}</h2><p className="kpi-sub">{gr.peak_format}</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Total Generated</p><h2 className="kpi-value">{fmtK(gr.total_generated)}</h2><p className="kpi-sub">total items</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Total Uploads</p><h2 className="kpi-value" style={{ color: '#a855f7' }}>{fmt(gr.total_uploads)}</h2><p className="kpi-sub">source videos</p></div>
      </div>
      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>CEF by Output Format</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gr.by_output}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="CEF">
                  {gr.by_output.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Monthly CEF Trend</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gr.monthly_cef}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Line type="monotone" dataKey="rate" stroke="#a855f7" strokeWidth={3} dot={{ r: 4, fill: '#a855f7' }} name="CEF" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>CEF by Input Type</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gr.by_input} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#444" fontSize={10} tickLine={false} axisLine={false} width={120} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="rate" fill="#3b82f6" radius={[0, 4, 4, 0]} name="CEF" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Output Mix Donut</h4>
          <div style={{ height: 300, display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={gr.by_output} dataKey="created" innerRadius={60} outerRadius={100} paddingAngle={2} stroke="none">
                  {gr.by_output.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ width: '180px' }}>
              {gr.by_output.map((o, i) => <div key={i} style={{ color: COLORS[i % COLORS.length], fontSize: '12px', marginBottom: '6px' }}>{o.name}: {o.rate}×</div>)}
            </div>
          </div>
        </div>
      </div>

      <div className="projects-table-section">
        <table className="projects-summary-table">
          <thead><tr><th>Format</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Created</th><th style={{ textAlign: 'right' }}>Uploaded</th></tr></thead>
          <tbody>
            {gr.by_output.map((r, i) => (
              <tr key={i}><td style={{ color: '#fff' }}>{r.name}</td><td style={{ textAlign: 'right', color: COLORS[i % COLORS.length], fontWeight: 700 }}>{r.rate}×</td><td style={{ textAlign: 'right' }}>{fmt(r.created)}</td><td style={{ textAlign: 'right' }}>{fmt(r.uploaded)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProductivityIndex = () => (
    <div className="projects-content">
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card mini"><p className="kpi-label">Avg Productivity</p><h2 className="kpi-value" style={{ color: '#00c864' }}>{pr.avg_productivity}</h2><p className="kpi-sub">videos per user</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Peak Month</p><h2 className="kpi-value" style={{ color: '#ff4d6d' }}>{pr.peak_productivity}</h2><p className="kpi-sub">{pr.peak_month}</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Total Published</p><h2 className="kpi-value">{fmtK(pr.total_published)}</h2><p className="kpi-sub">all months</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Total Users</p><h2 className="kpi-value" style={{ color: '#a855f7' }}>{pr.total_users}</h2><p className="kpi-sub">unique contributors</p></div>
      </div>
      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Published Videos per Active User by Month</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pr.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Bar dataKey="productivity" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Productivity" label={{ position: 'top', fill: '#fff', fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Active Users &amp; Total Videos</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pr.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="bottom" align="center" />
                <Bar yAxisId="left" dataKey="users" fill="#a855f7" radius={[4, 4, 0, 0]} name="Active Users" />
                <Line yAxisId="right" type="monotone" dataKey="videos" stroke="#00c864" strokeWidth={3} dot={{ r: 4, fill: '#00c864' }} name="Published Videos" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="projects-table-section">
        <h4>Monthly Breakdown</h4>
        <table className="projects-summary-table">
          <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Videos/User</th><th style={{ textAlign: 'right' }}>Active Users</th><th style={{ textAlign: 'right' }}>Total Videos</th></tr></thead>
          <tbody>
            {pr.monthly.map((r, i) => (
              <tr key={i}><td style={{ color: '#fff' }}>{r.name}</td><td style={{ textAlign: 'right', color: '#00c864', fontWeight: 700 }}>{r.productivity}</td><td style={{ textAlign: 'right' }}>{r.users}</td><td style={{ textAlign: 'right' }}>{fmt(r.videos)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDurationFootprint = () => (
    <div className="projects-content">
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card mini"><p className="kpi-label">Total Uploaded</p><h2 className="kpi-value" style={{ color: '#a855f7' }}>{fmtK(dur.total_uploaded_min)}</h2><p className="kpi-sub">minutes</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Total Created</p><h2 className="kpi-value" style={{ color: '#00c864' }}>{fmtK(dur.total_created_min)}</h2><p className="kpi-sub">minutes</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Total Published</p><h2 className="kpi-value" style={{ color: '#ff4d6d' }}>{fmtK(dur.total_published_min)}</h2><p className="kpi-sub">minutes</p></div>
        <div className="projects-kpi-card mini"><p className="kpi-label">Expansion Rate</p><h2 className="kpi-value" style={{ color: '#f97316' }}>{dur.expansion_rate}×</h2><p className="kpi-sub">created vs uploaded</p></div>
      </div>
      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Duration Footprint by Month</h4>
          <p className="chart-subtitle">Uploaded, Created, and Published Duration (minutes)</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dur.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => fmtK(v)} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="bottom" align="center" />
                <Area type="monotone" dataKey="uploaded" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} name="Uploaded" />
                <Area type="monotone" dataKey="created" stroke="#00c864" fill="#00c864" fillOpacity={0.1} name="Created" />
                <Area type="monotone" dataKey="published" stroke="#ff4d6d" fill="#ff4d6d" fillOpacity={0.1} name="Published" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Expansion &amp; Publish Rate</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dur.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="bottom" align="center" />
                <Line yAxisId="left" type="monotone" dataKey="expansion" stroke="#00c864" strokeWidth={3} dot={{ r: 4, fill: '#00c864' }} name="Expansion Rate (x)" />
                <Line yAxisId="right" type="stepAfter" dataKey="publish_rate" stroke="#ff4d6d" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#ff4d6d' }} name="Publish Rate (%)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="projects-table-section">
        <h4>Monthly Duration Summary</h4>
        <table className="projects-summary-table">
          <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Uploaded</th><th style={{ textAlign: 'right' }}>Created</th><th style={{ textAlign: 'right' }}>Published</th><th style={{ textAlign: 'right' }}>Expansion</th><th style={{ textAlign: 'right' }}>Publish %</th></tr></thead>
          <tbody>
            {dur.monthly.map((r, i) => (
              <tr key={i}><td style={{ color: '#fff' }}>{r.name}</td><td style={{ textAlign: 'right', color: '#a855f7' }}>{fmtK(r.uploaded)}</td><td style={{ textAlign: 'right', color: '#00c864' }}>{fmtK(r.created)}</td><td style={{ textAlign: 'right', color: '#ff4d6d' }}>{fmtK(r.published)}</td><td style={{ textAlign: 'right' }}>{r.expansion}×</td><td style={{ textAlign: 'right' }}>{r.publish_rate}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMetadataHealth = () => {
    const fieldEntries = Object.entries(mh.fields);
    const radarData = fieldEntries.map(([k, v]) => ({ subject: k, A: v }));
    return (
      <div className="projects-content">
        <div className="projects-charts-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <div className="projects-chart-card">
            <p className="kpi-label">System Health Score</p>
            <h2 className="kpi-value" style={{ fontSize: '48px', color: mh.avg_health > 90 ? '#00c864' : mh.avg_health > 70 ? '#f97316' : '#ff4d6d' }}>{mh.avg_health}%</h2>
            <p className="kpi-trend up" style={{ fontSize: '18px', color: mh.avg_health > 90 ? '#00c864' : mh.avg_health > 70 ? '#f97316' : '#ff4d6d' }}>{mh.avg_health > 90 ? 'Excellent' : mh.avg_health > 70 ? 'Good' : 'Needs Work'}</p>
            <div style={{ marginTop: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#555', fontSize: '13px' }}>Total Assets:</span><span style={{ color: '#fff', fontWeight: 700 }}>{fmt(mh.total_videos)}</span></div>
              <div style={{ borderTop: '1px solid #111', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}><span style={{ color: '#555' }}>Excellent</span><span style={{ color: '#00c864' }}>&gt;90%</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}><span style={{ color: '#555' }}>Good</span><span style={{ color: '#f97316' }}>70-90%</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}><span style={{ color: '#555' }}>Needs Work</span><span style={{ color: '#ff4d6d' }}>&lt;70%</span></div>
              </div>
            </div>
          </div>
          <div className="projects-chart-card">
            <h4>Metadata Completeness Radar</h4>
            <p className="chart-subtitle">Field-by-field completeness analysis</p>
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#444', fontSize: 10 }} axisLine={false} />
                  <Radar name="Completeness" dataKey="A" stroke="#ff4d6d" fill="#ff4d6d" fillOpacity={0.3} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="projects-table-section">
          <h4>Metadata Field Details</h4>
          <table className="projects-summary-table">
            <thead><tr><th>Metric</th><th style={{ textAlign: 'right' }}>Completeness %</th><th>Progress</th></tr></thead>
            <tbody>
              {fieldEntries.map(([name, pct], i) => {
                const c = pct > 90 ? '#00c864' : pct > 70 ? '#f97316' : '#ff4d6d';
                return (
                  <tr key={i}><td style={{ color: '#fff' }}>{name}</td><td style={{ textAlign: 'right', fontWeight: 700, color: c }}>{pct}%</td>
                    <td><div className="progress-bg" style={{ width: '150px' }}><div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: c }}></div></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPlatformAdoptionVelocity = () => (
    <div className="projects-content">
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card"><p className="kpi-label">Total Users</p><h2 className="kpi-value">{fmt(adp.total_users)}</h2><p className="kpi-sub">cumulative</p></div>
        <div className="projects-kpi-card"><p className="kpi-label">Avg Velocity</p><h2 className="kpi-value" style={{ color: '#00c864' }}>{adp.avg_velocity}%</h2><p className="kpi-sub">growth rate</p></div>
        <div className="projects-kpi-card"><p className="kpi-label">Current Velocity</p><h2 className="kpi-value" style={{ color: '#f97316' }}>{adp.current_velocity}%</h2><p className="kpi-sub">last month</p></div>
        <div className="projects-kpi-card"><p className="kpi-label" style={{ color: '#ff4d6d' }}>New Users (Latest)</p><h2 className="kpi-value" style={{ color: '#ff4d6d' }}>{adp.latest_new}</h2><p className="kpi-sub">this month</p></div>
      </div>
      <div className="projects-chart-card large">
        <h4>Adoption Velocity Over Time</h4>
        <p className="chart-subtitle">New users, cumulative growth, and velocity percentage</p>
        <div style={{ height: 450 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={adp.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
              <Legend verticalAlign="bottom" align="center" />
              <Bar dataKey="newUsers" fill="#ff4d6d" radius={[4, 4, 0, 0]} name="New Users" />
              <Line type="monotone" dataKey="cumulative" stroke="#00c864" strokeWidth={3} dot={{ r: 4, fill: '#00c864' }} name="Cumulative" />
              <Line yAxisId="right" type="monotone" dataKey="velocity" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#f97316' }} name="Velocity %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderUsageIntensityScore = () => (
    <div className="projects-content">
      <div className="projects-charts-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="projects-chart-card">
          <p className="kpi-label">PLATFORM AVG UIS</p>
          <h2 className="kpi-value" style={{ fontSize: '64px', color: '#ff4d6d' }}>{fmt(uis.avg_uis)}</h2>
          <p className="kpi-sub">Assets Created</p>
          <div style={{ marginTop: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#555', fontSize: '13px' }}>Total Assets:</span><span style={{ color: '#fff', fontWeight: 700 }}>{fmt(uis.total_assets)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#555', fontSize: '13px' }}>Active Users:</span><span style={{ color: '#fff', fontWeight: 700 }}>{uis.active_users}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#555', fontSize: '13px' }}>Power Users:</span><span style={{ color: '#00c864', fontWeight: 700 }}>{uis.power_users}</span></div>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>User Intensity Distribution</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={uis.users}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {uis.users.map((u, i) => <Cell key={i} fill={u.category === 'Power User' ? '#00c864' : '#ff4d6d'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="projects-table-section">
        <h4>User Details</h4>
        <table className="projects-summary-table">
          <thead><tr><th>User</th><th style={{ textAlign: 'right' }}>Outputs</th><th style={{ textAlign: 'right' }}>UIS Score</th><th>Category</th><th style={{ textAlign: 'right' }}>vs. Avg</th></tr></thead>
          <tbody>
            {uis.users.map((r, i) => {
              const c = r.category === 'Power User' ? '#00c864' : '#ff4d6d';
              return (
                <tr key={i}><td style={{ color: '#fff' }}>{r.name}</td><td style={{ textAlign: 'right' }}>{fmt(r.outputs)}</td><td style={{ textAlign: 'right', color: c, fontWeight: 700 }}>{fmt(r.score)}</td>
                  <td><span style={{ color: c, fontSize: '11px', border: `1px solid ${c}44`, padding: '2px 8px', borderRadius: '4px' }}>{r.category}</span></td>
                  <td style={{ textAlign: 'right', color: r.vs_avg >= 0 ? '#00c864' : '#ff4d6d' }}>{r.vs_avg >= 0 ? '+' : ''}{r.vs_avg}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderChannelProductivity = () => {
    const scatterData = cp.map(c => ({ ...c, fill: c.index > (cp.reduce((s, x) => s + x.index, 0) / cp.length) ? '#00c864' : '#ff4d6d' }));
    return (
      <div className="projects-content">
        <div className="projects-chart-card large">
          <h4>Channel Productivity Matrix</h4>
          <p className="chart-subtitle">Active users vs. published videos with productivity index</p>
          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis type="number" dataKey="users" name="Active Users" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="videos" name="Published Videos" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <ZAxis type="number" dataKey="index" range={[100, 400]} />
                <Tooltip cursor={{ stroke: '#555', strokeDasharray: '3 3' }} content={<CustomScatterTooltip />} />
                <Scatter name="Channels" data={scatterData} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-table-section">
          <h4>Channel Details</h4>
          <table className="projects-summary-table">
            <thead><tr><th>Channel</th><th style={{ textAlign: 'right' }}>Active Users</th><th style={{ textAlign: 'right' }}>Published Videos</th><th style={{ textAlign: 'right' }}>Productivity Index</th></tr></thead>
            <tbody>
              {cp.map((r, i) => (
                <tr key={i}><td style={{ color: '#fff' }}>{r.name}</td><td style={{ textAlign: 'right', color: '#00c864' }}>{r.users}</td><td style={{ textAlign: 'right', color: '#ff4d6d' }}>{fmt(r.videos)}</td><td style={{ textAlign: 'right', color: r.index > 50 ? '#00c864' : '#ff4d6d', fontWeight: 700 }}>{r.index}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderOutputDiversity = () => (
    <div className="projects-content">
      <div className="projects-charts-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="projects-chart-card">
          <p className="kpi-label">DIVERSITY SCORE</p>
          <h2 className="kpi-value" style={{ fontSize: '64px', color: '#ff4d6d' }}>{od.diversity_score}</h2>
          <p className="kpi-sub">Types / Total × 10,000</p>
          <div style={{ marginTop: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#555', fontSize: '13px' }}>Unique Types:</span><span style={{ color: '#fff', fontWeight: 700 }}>{od.unique_types}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: '#555', fontSize: '13px' }}>Total Outputs:</span><span style={{ color: '#fff', fontWeight: 700 }}>{fmt(od.total_outputs)}</span></div>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Output Type Distribution</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={od.output_types}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="type" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {od.output_types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="projects-table-section">
        <h4>Output Type Breakdown</h4>
        <table className="projects-summary-table">
          <thead><tr><th>Output Type</th><th style={{ textAlign: 'right' }}>Count</th><th style={{ textAlign: 'right' }}>Percentage</th><th>Share</th></tr></thead>
          <tbody>
            {od.output_types.map((r, i) => (
              <tr key={i}><td style={{ color: '#fff' }}>{r.type}</td><td style={{ textAlign: 'right', color: COLORS[i % COLORS.length], fontWeight: 700 }}>{fmt(r.count)}</td><td style={{ textAlign: 'right' }}>{r.percentage}%</td>
                <td><div className="progress-bg" style={{ width: '150px' }}><div className="progress-fill" style={{ width: `${r.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}></div></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContentImpact = () => {
    const avg = ci.avg_monthly_impact;
    return (
      <div className="projects-content">
        <div className="projects-kpi-grid">
          <div className="projects-kpi-card"><p className="kpi-label">Total Impact Score</p><h2 className="kpi-value" style={{ color: '#ff4d6d' }}>{fmtK(ci.total_impact)}</h2><p className="kpi-sub">Videos × Duration</p></div>
          <div className="projects-kpi-card"><p className="kpi-label">Avg Monthly Impact</p><h2 className="kpi-value" style={{ color: '#00c864' }}>{fmtK(ci.avg_monthly_impact)}</h2><p className="kpi-sub">12-month average</p></div>
          <div className="projects-kpi-card"><p className="kpi-label">Peak Impact</p><h2 className="kpi-value" style={{ color: '#f97316' }}>{fmtK(ci.peak_impact)}</h2><p className="kpi-sub">{ci.peak_month}</p></div>
          <div className="projects-kpi-card"><p className="kpi-label">Peak vs Avg</p><h2 className="kpi-value" style={{ color: '#00c864' }}>{avg ? `+${Math.round((ci.peak_impact - avg) / avg * 100)}%` : '—'}</h2><p className="kpi-sub">above average</p></div>
        </div>
        <div className="projects-chart-card large">
          <h4>Content Impact Over Time</h4>
          <p className="chart-subtitle">Published Videos × Published Duration</p>
          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ci.monthly}>
                <defs><linearGradient id="impactGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.3}/><stop offset="95%" stopColor="#ff4d6d" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => fmtK(v)} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Area type="monotone" dataKey="impact" stroke="#ff4d6d" strokeWidth={3} fill="url(#impactGradient)" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-table-section">
          <h4>Monthly Impact Breakdown</h4>
          <table className="projects-summary-table">
            <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Videos</th><th style={{ textAlign: 'right' }}>Duration (sec)</th><th style={{ textAlign: 'right' }}>Impact</th><th style={{ textAlign: 'right' }}>vs. Avg</th></tr></thead>
            <tbody>
              {ci.monthly.map((r, i) => {
                const vsAvg = avg ? Math.round((r.impact - avg) / avg * 100) : 0;
                return (
                  <tr key={i}><td style={{ color: '#fff' }}>{r.name}</td><td style={{ textAlign: 'right' }}>{fmt(r.videos)}</td><td style={{ textAlign: 'right', color: '#00c864' }}>{fmt(r.duration_sec)}</td><td style={{ textAlign: 'right', color: '#ff4d6d', fontWeight: 700 }}>{fmtK(r.impact)}</td><td style={{ textAlign: 'right', color: vsAvg >= 0 ? '#00c864' : '#ff4d6d' }}>{vsAvg >= 0 ? '+' : ''}{vsAvg}%</td></tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Overview': return renderOverview();
      case 'Editorial Yield': return renderEditorialYield();
      case 'Publishing Ecosystem': return renderEcosystem();
      case 'Output Generation Rate': return renderGenerationRate();
      case 'Monthly Productivity Index': return renderProductivityIndex();
      case 'Duration Footprint': return renderDurationFootprint();
      case 'Metadata Health': return renderMetadataHealth();
      case 'Platform Adoption Velocity': return renderPlatformAdoptionVelocity();
      case 'Usage Intensity Score': return renderUsageIntensityScore();
      case 'Channel Productivity': return renderChannelProductivity();
      case 'Output Diversity': return renderOutputDiversity();
      case 'Content Impact': return renderContentImpact();
      default: return <div className="projects-content"><h2 style={{ color: '#444' }}>Coming Soon: {activeTab}</h2></div>;
    }
  };

  return (
    <div className="projects-dashboard-layout">
      <aside className="projects-sidebar">
        <div className="projects-sidebar-header">
          <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
          <div className="sidebar-brand mini"><span style={{ fontSize: '14px', fontWeight: '800', color: '#ff4d6d' }}>FRAMMER AI</span></div>
        </div>
        <div className="projects-nav-section">
          <p className="projects-nav-label">DASHBOARDS</p>
          {navItems.map(item => (
            <div key={item.id} className={`projects-nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              {item.icon}<span>{item.label}</span>
            </div>
          ))}
        </div>
      </aside>
      <main className="projects-main">
        {/* <header className="projects-header">
          <div className="header-search-container"><Search size={18} color="#555" /><input type="text" placeholder="Search metrics..." /></div>
          <div className="header-actions">
            <div className="time-pill-group"><button className="time-pill">Day</button><button className="time-pill">Week</button><button className="time-pill active">Month</button><button className="time-pill">Quarter</button></div>
            <div className="header-icon-btn"><Bell size={18} /></div>
          </div>
        </header> */}
        <div className="projects-scroll-area">{renderActiveTab()}</div>
        <div className="help-fab mini"><HelpCircle size={20} /></div>
      </main>
    </div>
  );
};

export default ProjectsDashboard;
