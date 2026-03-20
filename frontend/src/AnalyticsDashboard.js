import React, { useState, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter, Line
} from 'recharts';
import { 
  ArrowLeft, Search, Bell, Grid, FileText, Users, FileDown, MoreHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import MultidimensionAnomaly from './MultidimensionAnomaly';

const TAB3_API = 'http://localhost:8000/api/tab3';

const AnalyticsDashboard = () => {
  const [activeNav, setActiveNav] = useState('User Analysis');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${TAB3_API}/all`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { console.error('Tab3 fetch error:', err); setLoading(false); });
  }, []);

  const sidebarItems = [
    { id: 'User Analysis', icon: <Users size={18} />, label: 'User Analysis' },
    { id: 'Channel Analysis', icon: <FileText size={18} />, label: 'Channel Analysis' },
    { id: 'Multidimension & Anomaly', icon: <Grid size={18} />, label: 'Multidimension & Anomaly' },
  ];

  const renderUserAnalysis = () => {
    if (!data) return null;
    const ua = data.user_analysis;
    const k = ua.kpis;
    return (
      <div className="analytics-content">
        <div className="analytics-header-row">
          <div className="analytics-title-group">
            <h1>User Analysis</h1>
            <p>Individual contributor performance, loyalty tiers, and publish efficiency across {k.total_users} users.</p>
          </div>
          <div className="analytics-actions">
            <div className="sort-dropdown">Sort: Published <MoreHorizontal size={14} className="rotate-90" /></div>
            <button className="export-csv-btn"><FileDown size={16} /> Export CSV</button>
          </div>
        </div>

        <div className="analytics-kpi-grid">
          <div className="analytics-kpi-card">
            <p className="kpi-label">Total Users</p>
            <div className="kpi-main">
              <h2 className="kpi-value">{k.total_users}</h2>
              <p className="kpi-sub">Unique uploaders</p>
            </div>
          </div>
          <div className="analytics-kpi-card">
            <p className="kpi-label">Active Users</p>
            <div className="kpi-main">
              <h2 className="kpi-value">{k.active_users}</h2>
              <p className="kpi-sub">Uploaded &ge;1 video</p>
            </div>
          </div>
          <div className="analytics-kpi-card">
            <p className="kpi-label">Repeatability Rate</p>
            <div className="kpi-main">
              <h2 className="kpi-value" style={{ color: '#00c864' }}>{k.repeatability_rate}</h2>
              <p className="kpi-sub">{k.repeat_users} / {k.total_users} repeat uploaders</p>
            </div>
          </div>
          <div className="analytics-kpi-card">
            <p className="kpi-label">Avg Uploads / User</p>
            <div className="kpi-main">
              <h2 className="kpi-value">{k.avg_uploads}</h2>
              <p className="kpi-sub">Per active user</p>
            </div>
          </div>
          <div className="analytics-kpi-card">
            <p className="kpi-label">Top 10% Contribution</p>
            <div className="kpi-main">
              <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>{k.top_10_pct}</h2>
              <p className="kpi-sub">{k.top_10_limit} users &rarr; {k.top_10_pub} of {k.total_published} pubs</p>
            </div>
          </div>
        </div>

        <div className="analytics-main-grid">
          <div className="analytics-card leaderboard-card">
            <div className="card-header">
              <h4>USER LEADERBOARD &mdash; ALL {k.total_users} USERS</h4>
              <div className="card-filters">
                <button className="filter-pill active">All</button>
                <button className="filter-pill">Published Only</button>
                <button className="filter-pill">Zero-Pub</button>
              </div>
            </div>
            <div className="table-container table-container-sticky">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th># User</th>
                    <th style={{ textAlign: 'right' }}>Uploaded</th>
                    <th style={{ textAlign: 'right' }}>Created</th>
                    <th style={{ textAlign: 'right' }}>Published</th>
                    <th style={{ textAlign: 'right' }}>Pub Rate</th>
                    <th style={{ textAlign: 'right' }}>Cr. Eff.</th>
                    <th>Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {ua.leaderboard.map((row) => (
                    <tr key={row.id}>
                      <td><span className="user-index">{row.id}</span> {row.name}</td>
                      <td style={{ textAlign: 'right' }}>{row.uploaded}</td>
                      <td style={{ textAlign: 'right' }}>{row.created}</td>
                      <td style={{ textAlign: 'right', color: '#ff4d6d', fontWeight: 700 }}>{row.published}</td>
                      <td style={{ textAlign: 'right', color: '#00c864' }}>{row.pubRate}</td>
                      <td style={{ textAlign: 'right', color: '#888' }}>{row.crEff}</td>
                      <td>
                        <span className="tier-tag" style={{ color: row.tierCol, border: `1px solid ${row.tierCol}44`, backgroundColor: `${row.tierCol}11` }}>{row.tier}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="analytics-right-col">
            <div className="analytics-card side-card">
              <h4>USER LOYALTY TIERS</h4>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ua.loyaltyTiers}
                      cx="40%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {ua.loyaltyTiers.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} />
                    <Legend 
                      layout="vertical" 
                      verticalAlign="middle" 
                      align="right" 
                      iconType="circle"
                      formatter={(value) => <span style={{ color: '#888', fontSize: '11px', fontWeight: 600 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="analytics-card side-card">
              <h4>UPLOADED VS PUBLISHED &mdash; SCATTER</h4>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} horizontal={false} />
                    <XAxis type="number" dataKey="uploaded" name="Uploaded" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis type="number" dataKey="published" name="Published" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} />
                    <Scatter name="Users" data={ua.scatter} fill="#3b82f6" fillOpacity={0.6} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="analytics-bottom-grid">
          <div className="analytics-card">
            <h4>TOP 12 USERS &mdash; PUBLISHED COUNT</h4>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ua.top12Published}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} />
                  <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                    {ua.top12Published.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="analytics-card">
            <h4>TOP 12 USERS &mdash; PUBLISH RATE %</h4>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ua.top12PublishRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} />
                  <Bar dataKey="val" radius={[4, 4, 0, 0]} fill="#00c864" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMultidimensionAnomaly = () => <MultidimensionAnomaly />;

  const renderChannelAnalysis = () => {
    if (!data) return null;
    const ca = data.channel_analysis;
    const ck = ca.kpis;
    return (
      <div className="analytics-content">
        <div className="analytics-header-row">
          <div className="analytics-title-group">
            <h1>Channel Analysis</h1>
            <p>Per-channel performance breakdown &mdash; upload volume, publish rates, efficiency, and top contributors.</p>
          </div>
          <div className="analytics-actions">
            <button className="filter-pill active">All Channels</button>
            <button className="export-csv-btn"><FileDown size={16} /> Export CSV</button>
          </div>
        </div>

        <div className="analytics-kpi-grid">
          <div className="analytics-kpi-card">
            <p className="kpi-label">Total Channels</p>
            <div className="kpi-main">
              <h2 className="kpi-value">{ck.total_channels}</h2>
              <p className="kpi-sub">Active channels</p>
            </div>
          </div>
          <div className="analytics-kpi-card">
            <p className="kpi-label">Publishing Channels</p>
            <div className="kpi-main">
              <h2 className="kpi-value" style={{ color: '#00c864' }}>{ck.publishing_channels}</h2>
              <p className="kpi-sub">At least 1 published</p>
            </div>
          </div>
          <div className="analytics-kpi-card">
            <p className="kpi-label">Zero-Pub Channels</p>
            <div className="kpi-main">
              <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>{ck.zero_pub_channels}</h2>
              <p className="kpi-sub">0% publish rate</p>
            </div>
          </div>
          <div className="analytics-kpi-card">
            <p className="kpi-label">Best Channel</p>
            <div className="kpi-main">
              <h2 className="kpi-value">{ck.best_channel}</h2>
              <p className="kpi-sub">{ck.best_rate} rate &middot; {ck.best_published} published</p>
            </div>
          </div>
          <div className="analytics-kpi-card">
            <p className="kpi-label">Avg Creation Eff.</p>
            <div className="kpi-main">
              <h2 className="kpi-value" style={{ color: '#00c864' }}>{ck.avg_creation_eff}</h2>
              <p className="kpi-sub">Clips per upload</p>
            </div>
          </div>
        </div>

        <div className="analytics-main-grid">
          <div className="analytics-card">
            <h4>CHANNEL UPLOAD &middot; CREATED &middot; PUBLISHED COMPARISON</h4>
            <div style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ca.comparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v} />
                  <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                  <Legend verticalAlign="top" align="center" iconType="rect" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Bar dataKey="uploaded" fill="#8b1e33" name="Uploaded" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="created" fill="#f97316" name="Created" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="published" fill="#00c864" name="Published" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="analytics-card">
            <h4>CHANNEL PUBLISH RATE % (PUBLISHED / UPLOADED)</h4>
            <div style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ca.publishRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {ca.publishRate.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="analytics-main-grid">
          <div className="analytics-card leaderboard-card">
            <div className="card-header">
              <h4>CHANNEL &times; USER DRILL-DOWN MATRIX</h4>
              <div className="header-dropdown">All Channels <ArrowLeft size={12} className="rotate-270" /></div>
            </div>
            <div className="table-container table-container-sticky">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>User</th>
                    <th style={{ textAlign: 'right' }}>Uploaded</th>
                    <th style={{ textAlign: 'right' }}>Created</th>
                    <th style={{ textAlign: 'right' }}>Published</th>
                    <th style={{ textAlign: 'right' }}>Rate %</th>
                  </tr>
                </thead>
                <tbody>
                  {ca.drilldown.map((row, i) => (
                    <tr key={i}>
                      <td style={{ color: '#ff4d6d', fontWeight: 600 }}>{row.channel}</td>
                      <td>{row.user}</td>
                      <td style={{ textAlign: 'right' }}>{row.uploaded}</td>
                      <td style={{ textAlign: 'right' }}>{row.created}</td>
                      <td style={{ textAlign: 'right', color: '#00c864', fontWeight: 700 }}>{row.published}</td>
                      <td style={{ textAlign: 'right', color: '#00c864' }}>{row.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="analytics-right-col">
            <div className="analytics-card side-card">
              <h4>USERS PER CHANNEL</h4>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ca.usersPerChannel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#222' }} />
                    <Bar dataKey="val" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="analytics-card side-card">
              <h4>CHANNEL CREATION EFFICIENCY (CLIPS / UPLOAD)</h4>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ca.creationEfficiency}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="name" stroke="#444" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} unit="x" />
                    <Tooltip cursor={{ fill: '#222' }} />
                    <Bar dataKey="val" radius={[2, 2, 0, 0]}>
                      {ca.creationEfficiency.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.highlight ? '#00c864' : '#8b1e33'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h4>CHANNEL SPOTLIGHT &mdash; PERFORMANCE BADGES</h4>
          <div className="spotlight-grid">
            {ca.spotlight.map((ch, i) => (
              <div key={i} className="spotlight-badge">
                <h3 className="spotlight-title">{ch.id}</h3>
                <p className="spotlight-users">{ch.users} users</p>
                <div className="spotlight-stats">
                  <div className="spotlight-stat-item">
                    <span className="label">Uploaded</span>
                    <span className="value">{ch.uploaded}</span>
                  </div>
                  <div className="spotlight-stat-item">
                    <span className="label">Pub Rate</span>
                    <span className="value" style={{ color: '#00c864' }}>{ch.rate}</span>
                  </div>
                </div>
                <div className="spotlight-footer">
                  <span className="eff-tag">{ch.eff} eff</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="analytics-dashboard-layout">
        <aside className="analytics-sidebar">
          <div className="analytics-sidebar-header">
            <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
            <div className="sidebar-brand mini">
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#ff4d6d' }}>FRAMMER AI</span>
            </div>
          </div>
        </aside>
        <main className="analytics-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading analysis…</main>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard-layout">
      <aside className="analytics-sidebar">
        <div className="analytics-sidebar-header">
           <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
           <div className="sidebar-brand mini">
            <span style={{ fontSize: '20px', fontWeight: '900', color: '#ff4d6d' }}>FRAMMER AI</span>
           </div>
        </div>
        
        <div className="analytics-nav-section">
          <p className="analytics-nav-label">DASHBOARDS</p>
          {sidebarItems.map(item => (
            <div 
              key={item.id} 
              className={`analytics-nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
       </aside>

      <main className="analytics-main">
        <div className="analytics-scroll-area">
          {activeNav === 'User Analysis' ? renderUserAnalysis() : 
           activeNav === 'Channel Analysis' ? renderChannelAnalysis() : 
           activeNav === 'Multidimension & Anomaly' ? renderMultidimensionAnomaly() : (
            <div className="analytics-content">
              <h2 style={{ color: '#444' }}>Coming Soon: {activeNav}</h2>
            </div>
          )}
        </div>
        
      </main>
    </div>
  );
};

export default AnalyticsDashboard;
