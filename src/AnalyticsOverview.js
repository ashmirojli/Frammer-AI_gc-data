import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import { 
  Activity, HelpCircle, ArrowLeft, TrendingUp, TrendingDown, Bot, Users, User
} from 'lucide-react';
import { Link } from 'react-router-dom';

// --- DATA ---
const trendData = [
  { month: 'Mar', uploaded: 2500, created: 2500, published: 0 },
  { month: 'Apr', uploaded: 2100, created: 1000, published: 700 },
  { month: 'May', uploaded: 900, created: 700, published: 100 },
  { month: 'Jun', uploaded: 1000, created: 900, published: 200 },
  { month: 'Jul', uploaded: 1200, created: 900, published: 100 },
  { month: 'Aug', uploaded: 1000, created: 700, published: 50 },
  { month: 'Sep', uploaded: 950, created: 700, published: 20 },
  { month: 'Oct', uploaded: 1400, created: 1100, published: 200 },
  { month: 'Nov', uploaded: 1450, created: 900, published: 50 },
  { month: 'Dec', uploaded: 800, created: 600, published: 150 },
  { month: 'Jan', uploaded: 1800, created: 1200, published: 350 },
  { month: 'Feb', uploaded: 2700, created: 2700, published: 250 },
];

const inputBreakdownData = [
  { type: 'interview', uploaded: 1299, created: 4972, published: 35, rate: '2.69%', color: '#ff4d6d' },
  { type: 'news bulletin', uploaded: 1026, created: 3238, published: 39, rate: '3.80%', color: '#fbbf24' },
  { type: 'special reports', uploaded: 755, created: 2129, published: 15, rate: '1.99%', color: '#3b82f6' },
  { type: 'speech', uploaded: 742, created: 2390, published: 12, rate: '1.62%', color: '#a855f7' },
  { type: 'debate', uploaded: 298, created: 1074, published: 5, rate: '1.72%', color: '#f97316' },
  { type: 'press conference', uploaded: 280, created: 973, published: 2, rate: '0.71%', color: '#10b981' },
];

const outputBreakdownData = [
  { type: 'Full package', created: 4453, published: 35, rate: '0.79%', color: '#ff4d6d' },
  { type: 'Key moments', created: 6377, published: 41, rate: '8.64%', color: '#fbbf24' },
  { type: 'My Key moments', created: 1237, published: 32, rate: '2.59%', color: '#a855f7' },
  { type: 'Chapters', created: 2007, published: 2, rate: '0.10%', color: '#3b82f6' },
  { type: 'Summary', created: 840, published: 1, rate: '0.12%', color: '#10b981' },
];

const platformRanking = [
  { name: 'Youtube', value: 35, color: '#00c864' },
  { name: 'Reels', value: 33, color: '#ff4d6d' },
  { name: 'Shorts', value: 23, color: '#f97316' },
  { name: 'Instagram', value: 11, color: '#3b82f6' },
  { name: 'Facebook', value: 9, color: '#a855f7' },
  { name: 'Linkedin', value: 0, color: '#333' },
  { name: 'Threads', value: 0, color: '#333' },
  { name: 'X', value: 0, color: '#333' },
];

const heatmapData = [
  { channel: 'Ch. D', data: [0, 28, 3, 2, 0, 4, 0, 6, 1, 4, 13, 9] },
  { channel: 'Ch. A', data: [0, 8, 1, 1, 0, 1, 0, 2, 0, 1, 3, 2] },
  { channel: 'Ch. B', data: [0, 6, 1, 0, 0, 1, 0, 1, 0, 1, 3, 2] },
  { channel: 'Ch. I', data: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1] },
];

const topUsersData = [
  { id: 1, name: 'Chandan', uploads: 489, created: 2152, published: 19, color: '#ff4d6d', initial: 'C' },
  { id: 2, name: 'QA-Purushottam', uploads: 309, created: 1227, published: 13, color: '#3b82f6', initial: 'P' },
  { id: 3, name: 'vikas.s@mooiya.com', uploads: 265, created: 1094, published: 4, color: '#10b981', initial: 'V' },
  { id: 4, name: 'Sandeep Belaki', uploads: 253, created: 1039, published: 7, color: '#a855f7', initial: 'S' },
  { id: 5, name: 'Nitesh', uploads: 224, created: 959, published: 8, color: '#fbbf24', initial: 'N' },
  { id: 6, name: 'Abhishek', uploads: 201, created: 488, published: 3, color: '#f97316', initial: 'A' },
  { id: 7, name: 'Auto Upload', uploads: 185, created: 223, published: 0, color: '#2dd4bf', initial: 'AU' },
  { id: 8, name: 'Subhesh', uploads: 184, created: 489, published: 7, color: '#818cf8', initial: 'Su' },
  { id: 9, name: 'Trivendra', uploads: 179, created: 825, published: 3, color: '#f472b6', initial: 'T' },
  { id: 10, name: 'Dheeraj Pareek (QA)', uploads: 166, created: 482, published: 2, color: '#3b82f6', initial: 'D' },
];

// --- COMPONENTS ---

const StatCard = ({ label, value, subtext, trend, trendLabel, type = 'neutral' }) => (
  <div className="stat-card">
    <p className="label">{label}</p>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
      <h3 style={{ margin: 0 }}>{value}</h3>
      {label === 'Total Upload Volume' && <span style={{ fontSize: '10px', color: '#555' }}>videos</span>}
      {label === 'AI Content Created' && <span style={{ fontSize: '10px', color: '#555' }}>outputs</span>}
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
  const [funnelMode, setFunnelMode] = useState('Count');
  const [hoveredUser, setHoveredUser] = useState(null);

  return (
    <div className="dashboard-layout" style={{ display: 'block' }}>
      <main className="dashboard-main" style={{ height: 'auto', overflow: 'visible' }}>
        <header className="dashboard-header">
          <div className="header-left">
             <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
             <div className="sidebar-brand" style={{ marginLeft: '8px' }}>
                <div className="logo-box mini">F</div>
                <span style={{ fontSize: '16px', fontWeight: '800' }}>FRAMMER <span style={{ color: '#ff4d6d' }}>AI</span></span>
             </div>
             <div style={{ width: '1px', height: '20px', backgroundColor: '#333', margin: '0 16px' }}></div>
             <span style={{ fontSize: '13px', color: '#888', fontWeight: '500' }}>Analytics Overview</span>
             <div className="critical-header-badge" style={{ marginLeft: '24px' }}>
                Critical: Orphan Rate 99.49%
             </div>
          </div>
          <div className="header-right">
            <div className="time-filters">
              <span style={{ color: '#888', fontSize: '12px' }}>Feb, 2026 | Current Month</span>
            </div>
          </div>
        </header>

        <div className="scrollable-content" style={{ padding: '24px 32px 100px 32px' }}>
          <div className="section-divider">
            <h2>Top 10 KPIs</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>Feb, 2026 vs Jan, 2026</span>
            </div>
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            <StatCard label="Total Upload Volume" value="676" subtext="Feb 2026" trend="+37.4%" trendLabel="vs Jan" type="up" />
            <StatCard label="AI Content Created" value="2,756" subtext="Feb 2026" trend="+84.7%" trendLabel="vs Jan" type="up" />
            <StatCard label="Total Published Outputs" value="14" subtext="Feb 2026" trend="-30.0%" trendLabel="vs Jan" type="down" />
            <StatCard label="Editorial Yield %" value="0.51%" subtext="Published / Created" trend="-62.1%" trendLabel="vs Jan" type="down" />
            <StatCard label="Content Expansion Factor" value="4.08x" subtext="Created / Uploaded · Feb" trend="+34.4%" trendLabel="vs Jan" type="up" />
            
            <StatCard label="Orphan Content Rate" value="99.49%" subtext="AI outputs unpublished · Feb" trend="CRITICAL" type="critical" />
            <StatCard label="Active Users" value="44" subtext="of 45 total registered" trend="- 97.8%" trendLabel="active rate" type="neutral" />
            <StatCard label="Avg Uploads / Active User" value="101.2" subtext="all-time average" trend="- All-time" type="neutral" />
            <StatCard label="Publish Rate" value="2.07%" subtext="Published / Uploaded · Feb" trend="-49.1%" trendLabel="vs Jan" type="down" />
            <StatCard label="All-Time Publish Rate" value="2.49%" subtext="111 published / 4,453 uploaded" trend="- All-time" type="neutral" />
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
            <div className="funnel-header-actions">
              <button className={`funnel-action-btn ${funnelMode === 'Count' ? 'active' : ''}`} onClick={() => setFunnelMode('Count')}>Count</button>
              <button className={`funnel-action-btn ${funnelMode === 'Duration' ? 'active' : ''}`} onClick={() => setFunnelMode('Duration')}>Duration</button>
            </div>
          </div>

          <div className="funnel-row">
            <div className="funnel-step">
              <h4>{funnelMode === 'Count' ? '4,453' : '807h 40m'}</h4>
              <p>{funnelMode === 'Count' ? 'Uploaded' : 'Uploaded Dur.'}</p>
            </div>
            <div className="funnel-step" style={{ backgroundColor: funnelMode === 'Duration' ? '#3d141b' : '#111' }}>
              <h4>{funnelMode === 'Count' ? '14,916' : '1,273h 30m'}</h4>
              <p>{funnelMode === 'Count' ? 'AI Created' : 'AI Created Dur.'}</p>
            </div>
            <div className="funnel-step" style={{ backgroundColor: funnelMode === 'Duration' ? '#5c1a26' : '#111' }}>
              <h4>{funnelMode === 'Count' ? '111' : '4h 22m'}</h4>
              <p>{funnelMode === 'Count' ? 'Published' : 'Published Dur.'}</p>
            </div>
            <div className="funnel-step highlight-step">
              <h4>{funnelMode === 'Count' ? '2.49%' : '0.54%'}</h4>
              <p>{funnelMode === 'Count' ? 'Publish Rate' : 'Rate'}</p>
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
                  <h4>Monthly Upload / AI Created / Published Trend</h4>
                  <p className="chart-subtitle">12-month overview — actual data from Fact_Monthly</p>
                </div>
              </div>
            </div>
            <div className="area-chart-container">
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="month" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} 
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" align="left" iconType="plainline" wrapperStyle={{ paddingTop: '20px' }} />
                  
                  <Area type="monotone" dataKey="uploaded" fill="#3b82f6" stroke="none" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="created" fill="#ff4d6d" stroke="none" fillOpacity={0.1} />
                  
                  <Line type="monotone" dataKey="uploaded" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="Uploaded" />
                  <Line type="monotone" dataKey="created" stroke="#ff4d6d" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#ff4d6d' }} name="AI Created" />
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
                  <div>
                    <h4>Input Type — Upload Share</h4>
                    <p className="chart-subtitle">By content type · all-time</p>
                  </div>
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
                  <div className="donut-center-label">
                    <span>Input</span>
                  </div>
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
                        <span style={{ color: '#555', marginLeft: '8px' }}>{(item.uploaded / 4453 * 100).toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <table className="breakdown-table">
                <thead>
                  <tr><th>Input Type</th><th>Uploaded</th><th>Created</th><th>Published</th><th>Pub Rate</th></tr>
                </thead>
                <tbody>
                  {inputBreakdownData.map((row, i) => (
                    <tr key={i}>
                      <td style={{ color: '#888' }}>{row.type}</td>
                      <td className="val">{row.uploaded.toLocaleString()}</td>
                      <td className="val" style={{ color: '#555' }}>{row.created.toLocaleString()}</td>
                      <td className="val" style={{ color: '#555' }}>{row.published}</td>
                      <td><span className="rate">{row.rate}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div>
                    <h4>Output Type — AI Created Share</h4>
                    <p className="chart-subtitle">By AI output type · all-time</p>
                  </div>
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
                  <div className="donut-center-label">
                    <span>Output</span>
                  </div>
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
                        <span style={{ color: '#555', marginLeft: '8px' }}>{(item.created / 14916 * 100).toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <table className="breakdown-table">
                <thead>
                  <tr><th>Output Type</th><th>Created</th><th>Published</th><th>Pub Rate %</th></tr>
                </thead>
                <tbody>
                  {outputBreakdownData.map((row, i) => (
                    <tr key={i}>
                      <td style={{ color: '#888' }}>{row.type}</td>
                      <td className="val">{row.created.toLocaleString()}</td>
                      <td className="val" style={{ color: '#555' }}>{row.published}</td>
                      <td><span className="rate">{row.rate}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <div>
                    <h4>Platform Ranking</h4>
                    <p className="chart-subtitle">By published output count · all-time</p>
                  </div>
                </div>
              </div>
              {platformRanking.map((p, i) => (
                <div key={i} className="bar-chart-item">
                  <span className="bar-label">{p.name}</span>
                  <div className="bar-bg">
                    <div className="bar-fill" style={{ width: `${(p.value/35)*100}%`, backgroundColor: p.color }}></div>
                  </div>
                  <span className="bar-value">{p.value}</span>
                </div>
              ))}
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div>
                    <h4>Top Channels by Published</h4>
                    <p className="chart-subtitle">All-time published count per channel</p>
                  </div>
                </div>
              </div>
              <div className="bar-chart-item">
                <span className="bar-label">Channel D</span>
                <div className="bar-bg"><div className="bar-fill" style={{ width: '100%', backgroundColor: '#ff4d6d' }}></div></div>
                <span className="bar-value">71</span>
              </div>
              <div className="bar-chart-item">
                <span className="bar-label">Channel A</span>
                <div className="bar-bg"><div className="bar-fill" style={{ width: '27%', backgroundColor: '#8b1e33' }}></div></div>
                <span className="bar-value">19</span>
              </div>
              <div className="bar-chart-item">
                <span className="bar-label">Channel G</span>
                <div className="bar-bg"><div className="bar-fill" style={{ width: '20%', backgroundColor: '#f97316' }}></div></div>
                <span className="bar-value">14</span>
              </div>
              <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#0a0a0a', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                  <span>Total Active Channels</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>6 / 18</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                  <span>Total Published (all ch.)</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>111</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                  <span>Top Channel Share</span>
                  <span style={{ color: '#ff4d6d', fontWeight: 700 }}>64.0%</span>
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div>
                    <h4>Language Analysis</h4>
                    <p className="chart-subtitle">Upload share + publish rate</p>
                  </div>
                </div>
              </div>
              <div className="bar-chart-item">
                <span className="bar-label">en</span>
                <div className="bar-bg"><div className="bar-fill" style={{ width: '80%', backgroundColor: '#00c864' }}></div></div>
                <span className="bar-value" style={{ color: '#00c864' }}>3.44%</span>
              </div>
              <div className="bar-chart-item">
                <span className="bar-label">hi</span>
                <div className="bar-bg"><div className="bar-fill" style={{ width: '30%', backgroundColor: '#3b82f6' }}></div></div>
                <span className="bar-value" style={{ color: '#3b82f6' }}>1.12%</span>
              </div>
              <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#0a0a0a', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                  <span>Best Language</span>
                  <span style={{ color: '#00c864', fontWeight: 700 }}>en</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                  <span>en Uploads</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>2,647</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                  <span>Total Published (en)</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>91 / 111</span>
                </div>
              </div>
            </div>
          </div>

          <div className="section-divider">
            <h2>Channel × Month Heatmap</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>Published videos per channel per month</span>
            </div>
          </div>

          <div className="heatmap-container">
            <div className="chart-card-header">
              <div className="chart-card-title">
                <div className="chart-title-bar"></div>
                <div>
                  <h4>Per-Month Publishing per Channel</h4>
                  <p className="chart-subtitle">Based on Fact_Channel_Publishing proportions scaled by monthly totals</p>
                </div>
              </div>
            </div>
            <div className="heatmap-row">
              <div className="heatmap-label"></div>
              {['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map(m => (
                <div key={m} className="heatmap-label" style={{ justifyContent: 'center' }}>{m}</div>
              ))}
            </div>
            {heatmapData.map((row, i) => (
              <div key={i} className="heatmap-row">
                <div className="heatmap-label">{row.channel}</div>
                {row.data.map((val, j) => (
                  <div key={j} className={`heatmap-cell ${val > 20 ? 'level-4' : val > 10 ? 'level-3' : val > 5 ? 'level-2' : val > 0 ? 'level-1' : ''}`}>
                    {val > 0 ? val : ''}
                  </div>
                ))}
              </div>
            ))}
            <div className="heatmap-legend">
              <span>LOW</span>
              <div className="legend-box" style={{ backgroundColor: '#1a1a1a' }}></div>
              <div className="legend-box level-1"></div>
              <div className="legend-box level-2"></div>
              <div className="legend-box level-3"></div>
              <div className="legend-box level-4"></div>
              <span>HIGH</span>
            </div>
          </div>

          {/* NEW: USER ACTIVITY SECTION */}
          <div className="section-divider">
            <h2>User Activity</h2>
            <div className="line"></div>
            <div className="section-badge-pill">
              <span>44 Active / 45 Total</span>
            </div>
          </div>

          <div className="breakdown-grid">
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div>
                    <h4>Active Users Summary</h4>
                    <p className="chart-subtitle">44 active / 45 total registered users</p>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '40px', alignItems: 'center', padding: '20px 0' }}>
                <div style={{ position: 'relative', width: 120, height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{v: 44, color: '#00c864'}, {v: 1, color: '#ff4d6d'}]} innerRadius={45} outerRadius={55} dataKey="v" startAngle={90} endAngle={450}>
                        <Cell fill="#00c864" />
                        <Cell fill="#ff4d6d" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center-label">
                    <span style={{ fontSize: '20px' }}>44</span>
                    <p style={{ fontSize: '8px', color: '#555', margin: 0 }}>Active</p>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="donut-summary-row">
                    <span style={{ color: '#888', fontSize: '11px' }}>Active Ratio</span>
                    <span style={{ color: '#00c864', fontWeight: 700 }}>97.8%</span>
                  </div>
                  <div className="donut-summary-row">
                    <span style={{ color: '#888', fontSize: '11px' }}>Inactive</span>
                    <span style={{ color: '#ff4d6d', fontWeight: 700 }}>1</span>
                  </div>
                  <div className="donut-summary-row">
                    <span style={{ color: '#888', fontSize: '11px' }}>Avg Uploads</span>
                    <span className="donut-summary-val">101.2</span>
                  </div>
                  <div className="donut-summary-row">
                    <span style={{ color: '#888', fontSize: '11px' }}>Total Users</span>
                    <span className="donut-summary-val">45</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <div className="donut-summary-row">
                  <span style={{ color: '#888', fontSize: '11px' }}>Orphaned AI Outputs</span>
                  <span style={{ color: '#ff4d6d', fontWeight: 700 }}>14,805</span>
                </div>
                <div className="donut-summary-row">
                  <span style={{ color: '#888', fontSize: '11px' }}>All-Time Publish Rate</span>
                  <span style={{ color: '#ff4d6d', fontWeight: 700 }}>2.49%</span>
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-card-header">
                <div className="chart-card-title">
                  <div className="chart-title-bar"></div>
                  <div>
                    <h4>Top 10 Active Users</h4>
                    <p className="chart-subtitle">By uploaded count · all-time</p>
                  </div>
                </div>
              </div>
              <table className="top-users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th style={{ textAlign: 'right' }}>Uploads / Created / Pub</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsersData.map((user, idx) => (
                    <tr 
                      key={user.id} 
                      onMouseEnter={() => setHoveredUser(user.id)} 
                      onMouseLeave={() => setHoveredUser(null)}
                      style={{ position: 'relative' }}
                    >
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

          {/* NEW: SYSTEM ALERTS SECTION */}
          <div className="section-divider">
            <h2>System Alerts</h2>
            <div className="line"></div>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', padding: '4px 8px', color: '#555' }}>Auto-generated · Threshold Monitoring</span>
            </div>
          </div>

          <div className="alert-bar critical">
            <div>
              <span className="alert-label">CRIT</span>
              <strong style={{ color: '#fff' }}>CRITICAL:</strong> Orphan rate 99.49% in Feb 2026 — 2,742 of 2,758 AI-created outputs never published. Pipeline review required.
            </div>
            <span className="alert-status-tag">CRITICAL</span>
          </div>

          <div className="alert-bar critical">
            <div>
              <span className="alert-label">CRIT</span>
              <strong style={{ color: '#fff' }}>CRITICAL:</strong> Publish rate dropped to 2.07% in Feb 2026 (vs 4.07% in Jan 2026, -49.1%). Only 14 of 676 uploads published.
            </div>
            <span className="alert-status-tag">CRITICAL</span>
          </div>

          <div className="alert-bar warning">
            <div>
              <span className="alert-label">WARN</span>
              <strong style={{ color: '#fff' }}>WARNING:</strong> Channel D dominates with 71 of 111 all-time published videos (64%). Only 6 of 18 channels have any publishing activity.
            </div>
            <span className="alert-status-tag">WARNING</span>
          </div>

          <div className="alert-bar healthy">
            <div>
              <span className="alert-label">OK</span>
              Upload volume up +37.4% MoM (676 vs 492). AI content creation up +84.7% (2,756 vs 1,492). AI expansion factor at record high 4.08x.
            </div>
            <span className="alert-status-tag">HEALTHY</span>
          </div>
        </div>

        <div className="help-fab" style={{ position: 'fixed' }}>
          <HelpCircle size={24} />
        </div>
      </main>
    </div>
  );
};

export default AnalyticsOverview;
