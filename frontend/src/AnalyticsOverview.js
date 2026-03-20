import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import { 
  Activity, ArrowLeft, TrendingUp, TrendingDown, Bot, Users, User
} from 'lucide-react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:8000';

// --- COMPONENTS ---

const StatCard = ({ label, value, subtext, trend, trendLabel, type = 'neutral' }) => (
  <div className="stat-card">
    <p className="label">{label}</p>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
      <h3 style={{ margin: 0 }}>{value}</h3>
      {label === 'Total Upload Volume' && <span style={{ fontSize: '10px', color: '#555' }}>videos</span>}
      {label === 'Content Created' && <span style={{ fontSize: '10px', color: '#555' }}>outputs</span>}
    </div>
    <p className="subtext">{subtext}</p>
    {trend && (
      <div className={`trend-chip ${type}`}>
        {type === 'up' && <TrendingUp size={10} />}
        {type === 'down' && <TrendingDown size={10} />}
        {trend} {trendLabel && <span style={{ fontSize: '9px', opacity: 0.8 }}>{trendLabel}</span>}
      </div>
    )}
  </div>
);

const AnalyticsOverview = () => {
  const [hoveredUser, setHoveredUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [funnel, setFunnel] = useState({});
  const [inputBreakdownData, setInputBreakdown] = useState([]);
  const [outputBreakdownData, setOutputBreakdown] = useState([]);
  const [platformRanking, setPlatformRanking] = useState([]);
  const [topChannels, setTopChannels] = useState({ channels: [], activeChannels: 0, totalChannels: 0, totalPublished: 0, topChannelShare: '0%' });
  const [langData, setLangData] = useState({ languages: [], best: '', bestUploads: 0, bestPublished: 0 });
  const [userData, setUserData] = useState({ topUsers: [], activeUsers: 0, totalUsers: 0, activeRatio: '0%', inactive: 0, avgUploads: 0, orphanedOutputs: '0', allTimePublishRate: '0%' });
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/tab1/kpis`).then(r => r.json()),
      fetch(`${API}/api/tab1/trend`).then(r => r.json()),
      fetch(`${API}/api/tab1/funnel`).then(r => r.json()),
      fetch(`${API}/api/tab1/input-breakdown`).then(r => r.json()),
      fetch(`${API}/api/tab1/output-breakdown`).then(r => r.json()),
      fetch(`${API}/api/tab1/platform-ranking`).then(r => r.json()),
      fetch(`${API}/api/tab1/top-channels`).then(r => r.json()),
      fetch(`${API}/api/tab1/language`).then(r => r.json()),
      fetch(`${API}/api/tab1/users`).then(r => r.json()),
      fetch(`${API}/api/tab1/alerts`).then(r => r.json()),
    ]).then(([k, t, f, ib, ob, pr, tc, lg, ud, al]) => {
      setKpis(k);
      setTrendData(t);
      setFunnel(f);
      setInputBreakdown(ib);
      setOutputBreakdown(ob);
      setPlatformRanking(pr);
      setTopChannels(tc);
      setLangData(lg);
      setUserData(ud);
      setAlerts(al);
      setLoading(false);
    }).catch(err => { console.error('Tab1 fetch error:', err); setLoading(false); });
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>Loading Analytics...</div>;

  const totalUploaded = inputBreakdownData.reduce((s, i) => s + i.uploaded, 0);
  const totalCreatedOutput = outputBreakdownData.reduce((s, i) => s + i.created, 0);
  const maxPlatform = platformRanking.length > 0 ? Math.max(...platformRanking.map(p => p.value)) : 1;

  return (
    <div className="dashboard-layout" style={{ display: 'block' }}>
      <main className="dashboard-main" style={{ height: 'auto', overflow: 'visible' }}>
        <header className="dashboard-header" style={{ borderBottom: 'none' }}>
          <div className="header-left">
             <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
             <div className="sidebar-brand" style={{ marginLeft: '8px' }}>
                {/* <div className="logo-box mini">F</div> */}
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#ff4d6d' }}>FRAMMER AI</span>
             </div>
             {/* <div style={{ width: '1px', height: '20px', backgroundColor: '#333', margin: '0 16px' }}></div> */}
             {/* <span style={{ fontSize: '13px', color: '#888', fontWeight: '500' }}>Analytics Overview</span> */}
             {/* {kpis.find(k => k.label === 'Orphan Content Rate') && ( */}
              {/* //  <div className="critical-header-badge" style={{ marginLeft: '24px' }}> */}
                  {/* Critical: Orphan Rate {kpis.find(k => k.label === 'Orphan Content Rate')?.value} */}
              {/* //  </div> */}
             {/* )} */}
          </div>
          {/* <div className="header-right">
            <div className="time-filters">
              <span style={{ color: '#888', fontSize: '12px' }}>Feb, 2026 | Current Month</span>
            </div>
          </div> */}
        </header>

        <div className="scrollable-content" style={{ padding: '12px 32px 100px 32px' }}>
          <div className="section-divider" style={{ marginTop: 0 }}>
            <h2>Top 10 KPIs</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>Feb, 2026 vs Jan, 2026</span>
            </div>
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {kpis.map((k, i) => (
              <StatCard key={i} label={k.label} value={k.value} subtext={k.subtext} trend={k.trend} trendLabel={k.trendLabel} type={k.type} />
            ))}
          </div>

          <div className="section-divider">
            <h2>Publishing Funnel</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>All-Time Totals</span>
            </div>
          </div>

          <div className="chart-card-header">
            <div className="chart-card-title">
              <div className="chart-title-bar"></div>
              <h4>Publishing Funnel</h4>
            </div>
          </div>

          <div className="funnel-row">
            <div className="funnel-step">
              <h4>{funnel?.Uploaded}</h4>
              <p>Uploaded</p>
            </div>
            <div className="funnel-step" style={{ backgroundColor: '#111' }}>
              <h4>{funnel?.Created}</h4>
              <p>Created</p>
            </div>
            <div className="funnel-step" style={{ backgroundColor: '#111' }}>
              <h4>{funnel?.Published}</h4>
              <p>Published</p>
            </div>
            <div className="funnel-step highlight-step">
              <h4>{funnel?.['Publish Rate (%)']}</h4>
              <p>Publish Rate</p>
            </div>
          </div>

          <div className="section-divider">
            <h2>Monthly Trends</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>Mar 2025 - Feb 2026</span>
            </div>
          </div>

          <div className="chart-card large">
            <div className="chart-card-header">
              <div className="chart-card-title">
                <div className="chart-title-bar"></div>
                <div>
                  <h4>Monthly Upload / Created / Published Trend</h4>
                  <p className="chart-subtitle">12-month overview — live data from database</p>
                </div>
              </div>
            </div>
            <div className="area-chart-container">
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="month" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} itemStyle={{ fontSize: '12px' }} />
                  <Legend verticalAlign="bottom" align="left" iconType="plainline" wrapperStyle={{ paddingTop: '20px' }} />
                  <Area type="monotone" dataKey="uploaded" fill="#3b82f6" stroke="none" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="created" fill="#ff4d6d" stroke="none" fillOpacity={0.1} />
                  <Line type="monotone" dataKey="uploaded" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="Uploaded" />
                  <Line type="monotone" dataKey="created" stroke="#ff4d6d" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#ff4d6d' }} name="Created" />
                  <Line type="monotone" dataKey="published" stroke="#00c864" strokeWidth={2} dot={{ r: 4, fill: '#00c864' }} name="Published (right scale)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="section-divider">
            <h2>Content Breakdown</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>Input & Output Type Analysis</span>
            </div>
          </div>

          <div className="breakdown-grid">
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div><h4>Input Type — Upload Share</h4><p className="chart-subtitle">By content type · all-time</p></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 150, height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={inputBreakdownData} innerRadius={50} outerRadius={70} dataKey="uploaded" paddingAngle={2}>
                        {inputBreakdownData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center-label"><span>Input</span></div>
                </div>
                <div style={{ flex: 1 }}>
                  {inputBreakdownData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px' }}>
                      <span style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', backgroundColor: item.color, borderRadius: '2px' }}></span>
                        {item.type}
                      </span>
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {item.uploaded.toLocaleString()} 
                        <span style={{ color: '#555', marginLeft: '8px' }}>{totalUploaded > 0 ? (item.uploaded / totalUploaded * 100).toFixed(1) : 0}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div><h4>Output Type — Created Share</h4><p className="chart-subtitle">By output type · all-time</p></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 150, height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={outputBreakdownData} innerRadius={50} outerRadius={70} dataKey="created" paddingAngle={2}>
                        {outputBreakdownData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center-label"><span>Output</span></div>
                </div>
                <div style={{ flex: 1 }}>
                  {outputBreakdownData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px' }}>
                      <span style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', backgroundColor: item.color, borderRadius: '2px' }}></span>
                        {item.type}
                      </span>
                      <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                        {item.created.toLocaleString()} 
                        <span style={{ color: '#555', marginLeft: '8px' }}>{totalCreatedOutput > 0 ? (item.created / totalCreatedOutput * 100).toFixed(1) : 0}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="section-divider">
            <h2>Platform & Channel Distribution</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>Publishing Performance — All Time</span>
            </div>
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div><h4>Platform Ranking</h4><p className="chart-subtitle">By published output count · all-time</p></div>
                </div>
              </div>
              {platformRanking.map((p, i) => (
                <div key={i} className="bar-chart-item">
                  <span className="bar-label">{p.name}</span>
                  <div className="bar-bg">
                    <div className="bar-fill" style={{ width: `${maxPlatform > 0 ? (p.value/maxPlatform)*100 : 0}%`, backgroundColor: p.color }}></div>
                  </div>
                  <span className="bar-value">{p.value}</span>
                </div>
              ))}
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div><h4>Top Channels by Published</h4><p className="chart-subtitle">All-time published count per channel</p></div>
                </div>
              </div>
              {topChannels.channels.map((ch, i) => (
                <div key={i} className="bar-chart-item">
                  <span className="bar-label">{ch.name}</span>
                  <div className="bar-bg">
                    <div className="bar-fill" style={{ width: `${topChannels.channels[0]?.value > 0 ? (ch.value/topChannels.channels[0].value)*100 : 0}%`, backgroundColor: i === 0 ? '#ff4d6d' : i === 1 ? '#8b1e33' : '#f97316' }}></div>
                  </div>
                  <span className="bar-value">{ch.value}</span>
                </div>
              ))}
              <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#0a0a0a', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                  <span>Total Active Channels</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{topChannels.activeChannels} / {topChannels.totalChannels}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                  <span>Total Published (all ch.)</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{topChannels.totalPublished}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                  <span>Top Channel Share</span>
                  <span style={{ color: '#ff4d6d', fontWeight: 700 }}>{topChannels.topChannelShare}</span>
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div><h4>Language Analysis</h4><p className="chart-subtitle">Upload share + publish rate</p></div>
                </div>
              </div>
              {langData.languages.slice(0, 2).map((l, i) => (
                <div key={i} className="bar-chart-item">
                  <span className="bar-label">{l.lang}</span>
                  <div className="bar-bg"><div className="bar-fill" style={{ width: `${i === 0 ? '80%' : '30%'}`, backgroundColor: i === 0 ? '#00c864' : '#3b82f6' }}></div></div>
                  <span className="bar-value" style={{ color: i === 0 ? '#00c864' : '#3b82f6' }}>{l.rate}</span>
                </div>
              ))}
              <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#0a0a0a', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                  <span>Best Language</span>
                  <span style={{ color: '#00c864', fontWeight: 700 }}>{langData.best}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                  <span>{langData.best} Uploads</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{langData.bestUploads?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                  <span>Total Published ({langData.best})</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{langData.bestPublished} / {topChannels.totalPublished}</span>
                </div>
              </div>
            </div>
          </div>

          {/* USER ACTIVITY SECTION */}
          <div className="section-divider">
            <h2>User Activity</h2>
            <div className="line"></div>
            <div className="section-badge-pill">
              <span>{userData.activeUsers} Active / {userData.totalUsers} Total</span>
            </div>
          </div>

          <div className="breakdown-grid">
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div><h4>Active Users Summary</h4><p className="chart-subtitle">{userData.activeUsers} active / {userData.totalUsers} total registered users</p></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '40px', alignItems: 'center', padding: '20px 0' }}>
                <div style={{ position: 'relative', width: 120, height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{v: userData.activeUsers, color: '#00c864'}, {v: userData.inactive, color: '#ff4d6d'}]} innerRadius={45} outerRadius={55} dataKey="v" startAngle={90} endAngle={450}>
                        <Cell fill="#00c864" />
                        <Cell fill="#ff4d6d" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center-label">
                    <span style={{ fontSize: '20px' }}>{userData.activeUsers}</span>
                    <p style={{ fontSize: '8px', color: '#555', margin: 0 }}>Active</p>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="donut-summary-row"><span style={{ color: '#888', fontSize: '11px' }}>Active Ratio</span><span style={{ color: '#00c864', fontWeight: 700 }}>{userData.activeRatio}</span></div>
                  <div className="donut-summary-row"><span style={{ color: '#888', fontSize: '11px' }}>Inactive</span><span style={{ color: '#ff4d6d', fontWeight: 700 }}>{userData.inactive}</span></div>
                  <div className="donut-summary-row"><span style={{ color: '#888', fontSize: '11px' }}>Avg Uploads</span><span className="donut-summary-val">{userData.avgUploads}</span></div>
                  <div className="donut-summary-row"><span style={{ color: '#888', fontSize: '11px' }}>Total Users</span><span className="donut-summary-val">{userData.totalUsers}</span></div>
                </div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <div className="donut-summary-row"><span style={{ color: '#888', fontSize: '11px' }}>Orphaned AI Outputs</span><span style={{ color: '#ff4d6d', fontWeight: 700 }}>{userData.orphanedOutputs}</span></div>
                <div className="donut-summary-row"><span style={{ color: '#888', fontSize: '11px' }}>All-Time Publish Rate</span><span style={{ color: '#ff4d6d', fontWeight: 700 }}>{userData.allTimePublishRate}</span></div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div><h4>Top 10 Active Users</h4><p className="chart-subtitle">By uploaded count · all-time</p></div>
                </div>
              </div>
              <table className="top-users-table">
                <thead><tr><th>User</th><th style={{ textAlign: 'right' }}>Uploads / Created / Pub</th></tr></thead>
                <tbody>
                  {userData.topUsers.map((user, idx) => (
                    <tr key={user.id} onMouseEnter={() => setHoveredUser(user.id)} onMouseLeave={() => setHoveredUser(null)} style={{ position: 'relative' }}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '10px', color: '#444', width: '12px' }}>{idx + 1}</span>
                        <div className="user-avatar" style={{ backgroundColor: user.color }}>{user.initial}</div>
                        <span style={{ color: '#ccc' }}>{user.name}</span>
                        {hoveredUser === user.id && (
                          <div className="user-hover-tooltip">
                            <strong>{user.name}</strong>
                            <p>Uploads: {user.uploads} | Created: {user.created} | Published: {user.published}</p>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{user.uploads}</span> / {user.created} / <span style={{ color: '#ff4d6d' }}>{user.published}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SYSTEM ALERTS SECTION */}
          <div className="section-divider">
            <h2>System Alerts</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>Auto-generated · Threshold Monitoring</span>
            </div>
          </div>

          {alerts.map((alert, i) => (
            <div key={i} className={`alert-bar ${alert.level}`}>
              <div>
                <span className="alert-label">{alert.level === 'critical' ? 'CRIT' : alert.level === 'warning' ? 'WARN' : 'OK'}</span>
                {alert.text}
              </div>
              <span className="alert-status-tag">{alert.level.toUpperCase()}</span>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
};

export default AnalyticsOverview;
