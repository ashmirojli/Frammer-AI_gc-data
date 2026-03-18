import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Area, AreaChart, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { 
  ArrowLeft, Search, Bell, Grid, FileText, Globe, Zap, Clock, Database, BarChart2, TrendingUp, Users, Activity, HelpCircle, FileDown, MoreHorizontal, Star
} from 'lucide-react';
import { Link } from 'react-router-dom';


const leaderboardData = [
  { id: 3, name: 'Neha', uploaded: 158, created: 510, published: 10, pubRate: '6.3%', crEff: '3.23x', tier: 'Power User', tierCol: '#00c864' },
  { id: 4, name: 'Abhishek', uploaded: 201, created: 408, published: 8, pubRate: '4%', crEff: '2.03x', tier: 'Power User', tierCol: '#00c864' },
  { id: 5, name: 'Harish', uploaded: 41, created: 166, published: 7, pubRate: '17.1%', crEff: '4.05x', tier: 'Active', tierCol: '#00c864' },
  { id: 6, name: 'Subhesh', uploaded: 184, created: 489, published: 7, pubRate: '3.8%', crEff: '2.66x', tier: 'Power User', tierCol: '#00c864' },
  { id: 7, name: 'Sandeep Belaki', uploaded: 253, created: 1039, published: 7, pubRate: '2.8%', crEff: '4.11x', tier: 'Power User', tierCol: '#00c864' },
  { id: 8, name: 'Prithviraj', uploaded: 66, created: 97, published: 6, pubRate: '9.1%', crEff: '1.47x', tier: 'Frequent', tierCol: '#3b82f6' },
  { id: 9, name: 'QA-Bhargavi', uploaded: 75, created: 271, published: 6, pubRate: '8%', crEff: '3.61x', tier: 'Frequent', tierCol: '#3b82f6' },
  { id: 10, name: 'Adarsh (Frammer)', uploaded: 141, created: 262, published: 5, pubRate: '3.5%', crEff: '1.86x', tier: 'Power User', tierCol: '#00c864' },
  { id: 11, name: 'Alok Rai', uploaded: 86, created: 143, published: 4, pubRate: '4.7%', crEff: '1.66x', tier: 'Frequent', tierCol: '#3b82f6' },
  { id: 12, name: 'vikas.s@moolya.com', uploaded: 265, created: 1094, published: 4, pubRate: '1.5%', crEff: '4.13x', tier: 'Power User', tierCol: '#00c864' },
  { id: 13, name: 'QA-Amit', uploaded: 5, created: 22, published: 3, pubRate: '60%', crEff: '4.40x', tier: 'Regular', tierCol: '#f97316' },
];

const loyaltyTiersData = [
  { name: 'Power User', value: 35, color: '#006d44' },
  { name: 'Frequent', value: 25, color: '#00bfa5' },
  { name: 'Active', value: 20, color: '#00c864' },
  { name: 'Regular', value: 10, color: '#f97316' },
  { name: 'One-Tiner', value: 5, color: '#8b5cf6' },
  { name: 'Zero-Upload', value: 5, color: '#ff4d6d' },
];

const scatterData = [
  { uploaded: 50, published: 2 }, { uploaded: 100, published: 4 }, { uploaded: 150, published: 3 },
  { uploaded: 200, published: 8 }, { uploaded: 250, published: 6 }, { uploaded: 300, published: 12 },
  { uploaded: 350, published: 9 }, { uploaded: 400, published: 15 }, { uploaded: 450, published: 13 },
  { uploaded: 500, published: 18 }, { uploaded: 20, published: 1 }, { uploaded: 80, published: 5 },
  { uploaded: 120, published: 6 }, { uploaded: 180, published: 10 }, { uploaded: 220, published: 7 },
  { uploaded: 280, published: 14 }, { uploaded: 330, published: 11 }, { uploaded: 380, published: 16 },
];

const topUsersPublishedData = [
  { name: 'Chandan', val: 18, fill: '#00c864' },
  { name: 'QA-Purushottam', val: 14, fill: '#00c864' },
  { name: 'Neha', val: 10, fill: '#00c864' },
  { name: 'Abhishek', val: 8, fill: '#ff4d6d' },
  { name: 'Sandeep', val: 7, fill: '#ff4d6d' },
  { name: 'Subhesh', val: 7, fill: '#ff4d6d' },
  { name: 'Harish', val: 7, fill: '#ff4d6d' },
  { name: 'QA-Bhargavi', val: 6, fill: '#ff4d6d' },
  { name: 'Prithviraj', val: 6, fill: '#ff4d6d' },
  { name: 'Adarsh', val: 5, fill: '#ff4d6d' },
  { name: 'vikas.s@moolya.com', val: 4, fill: '#ff4d6d' },
  { name: 'Alok', val: 4, fill: '#ff4d6d' },
];

const topUsersPublishRateData = [
  { name: 'Chandan', val: 4 },
  { name: 'QA-Purushottam', val: 4 },
  { name: 'Neha', val: 6 },
  { name: 'Abhishek', val: 4 },
  { name: 'Sandeep', val: 4 },
  { name: 'Subhesh', val: 3 },
  { name: 'Harish', val: 17 },
  { name: 'QA-Bhargavi', val: 8 },
  { name: 'Prithviraj', val: 9 },
  { name: 'Adarsh', val: 4 },
  { name: 'vikas.s@moolya.com', val: 2 },
  { name: 'Alok', val: 5 },
];

const channelComparisonData = [
  { name: 'Ch.A', uploaded: 1500, created: 4800, published: 710 },
  { name: 'Ch.B', uploaded: 1300, created: 4200, published: 190 },
  { name: 'Ch.C', uploaded: 900, created: 2800, published: 160 },
  { name: 'Ch.D', uploaded: 400, created: 800, published: 0 },
  { name: 'Ch.E', uploaded: 500, created: 1000, published: 120 },
  { name: 'Ch.F', uploaded: 300, created: 600, published: 0 },
  { name: 'Ch.G', uploaded: 200, created: 700, published: 20 },
  { name: 'Ch.H', uploaded: 150, created: 600, published: 15 },
];

const channelPublishRateData = [
  { name: 'Ch.A', rate: 4.83, color: '#00c864' },
  { name: 'Ch.B', rate: 1.47, color: '#f97316' },
  { name: 'Ch.C', rate: 1.83, color: '#f97316' },
  { name: 'Ch.D', rate: 0.00, color: '#ff4d6d' },
  { name: 'Ch.E', rate: 2.49, color: '#f97316' },
  { name: 'Ch.F', rate: 0.00, color: '#ff4d6d' },
  { name: 'Ch.G', rate: 0.95, color: '#f97316' },
  { name: 'Ch.H', rate: 1.12, color: '#f97316' },
];

const channelDrilldownData = [
  { channel: 'Ch.A', user: 'Chandan', uploaded: 247, created: 1029, published: 18, rate: '7.3%' },
  { channel: 'Ch.A', user: 'QA-Purushottam', uploaded: 72, created: 270, published: 10, rate: '13.9%' },
  { channel: 'Ch.A', user: 'Neha', uploaded: 67, created: 201, published: 7, rate: '10.4%' },
  { channel: 'Ch.A', user: 'Harish', uploaded: 27, created: 82, published: 6, rate: '22.2%' },
  { channel: 'Ch.C', user: 'Abhishek', uploaded: 36, created: 74, published: 5, rate: '13.9%' },
  { channel: 'Ch.A', user: 'QA-Bhargavi', uploaded: 5, created: 19, published: 5, rate: '100%' },
  { channel: 'Ch.C', user: 'Prithviraj', uploaded: 5, created: 9, published: 4, rate: '80%' },
  { channel: 'Ch.B', user: 'Subhesh', uploaded: 70, created: 146, published: 4, rate: '5.7%' },
  { channel: 'Ch.B', user: 'Sandeep Belaki', uploaded: 44, created: 167, published: 4, rate: '9.1%' },
  { channel: 'Ch.A', user: 'Sandeep Belaki', uploaded: 133, created: 560, published: 3, rate: '2.3%' },
  { channel: 'Ch.B', user: 'Neha', uploaded: 25, created: 98, published: 3, rate: '12%' },
];

const channelSpotlightData = [
  { id: 'Ch.A', users: 37, uploaded: '1,470', rate: '4.83%', eff: '3.21x', color: '#ff4d6d' },
  { id: 'Ch.B', users: 36, uploaded: '1,293', rate: '1.47%', eff: '3.29x', color: '#ff4d6d' },
  { id: 'Ch.C', users: 34, uploaded: '765', rate: '1.83%', eff: '3.44x', color: '#ff4d6d' },
  { id: 'Ch.D', users: 17, uploaded: '221', rate: '0.00%', eff: '3.17x', color: '#ff4d6d' },
  { id: 'Ch.E', users: 20, uploaded: '201', rate: '2.49%', eff: '4.81x', color: '#ff4d6d' },
  { id: 'Ch.F', users: 22, uploaded: '130', rate: '0.00%', eff: '2.46x', color: '#ff4d6d' },
];

const anomalyList = [
  { id: 1, type: 'star', text: 'A × Not Published is exceptional — 4,696 (4.0σ above average)', color: '#facc15' },
  { id: 2, type: 'star', text: 'B × Not Published is exceptional — 4,218 (3.5σ above average)', color: '#facc15' },
  { id: 3, type: 'dot', text: 'C × Not Published is a top performer — 2,609 (+2.0σ)', color: '#00c864' },
  { id: 4, type: 'chart', text: 'A has significantly more activity than other Channels (4,729 total, +2.7σ)', color: '#3b82f6' },
  { id: 5, type: 'chart', text: 'B has significantly more activity than other Channels (4,251 total, +2.4σ)', color: '#3b82f6' },
];

const matrixData = [
  { user: 'Chandan', total: 489, A: {v: 247, star: true, col: '#8b5cf6'}, B: {v: 87, star: true, col: '#1e3a8a'}, C: {v: 17}, D: {v: 67, star: true, col: '#1e3a8a'}, E: {v: 46, dot: true, col: '#064e3b'}, G: {v: 14}, H: {v: 9} },
  { user: 'QA-Purushottam', total: 309, A: {v: 72, star: true, col: '#064e3b'}, B: {v: 93, star: true, col: '#064e3b'}, C: {v: 91, star: true, col: '#064e3b'}, E: {v: 22}, F: {v: 17}, G: {v: 1} },
  { user: 'vikas.s@moolya.com', total: 265, A: {v: 85, star: true, col: '#1e3a8a'}, B: {v: 42, dot: true, col: '#064e3b'}, C: {v: 38, dot: true, col: '#064e3b'}, E: {v: 26}, G: {v: 9}, H: {v: 37, dot: true, col: '#1e3a8a'} },
  { user: 'Sandeep Belaki', total: 253, A: {v: 133, star: true, col: '#1e3a8a'}, B: {v: 44, dot: true, col: '#064e3b'}, C: {v: 26} },
  { user: 'Nitesh', total: 224, B: {v: 103, star: true, col: '#1e3a8a'}, C: {v: 99, star: true, col: '#1e3a8a'} },
  { user: 'Abhishek', total: 201, A: {v: 74, star: true, col: '#1e3a8a'}, B: {v: 54, star: true, col: '#1e3a8a'}, C: {v: 36, dot: true, col: '#064e3b'}, E: {v: 13}, F: {v: 16} },
  { user: 'Auto Upload', total: 185, B: {v: 176, star: true, col: '#8b5cf6'} },
  { user: 'Subhesh', total: 184, A: {v: 50, dot: true, col: '#064e3b'}, B: {v: 70, star: true, col: '#1e3a8a'}, C: {v: 35, dot: true, col: '#064e3b'}, F: {v: 14}, G: {v: 1} },
  { user: 'Trivendra', total: 179, A: {v: 64, star: true, col: '#1e3a8a'}, B: {v: 91, star: true, col: '#1e3a8a'} },
];

const clusterData = [
  { id: 'Power Users', count: 4, icon: '🔥', avg: {up: 171, cr: 417, pub: 8, conv: '1.82%'}, users: ['Abhishek', 'Subhesh', 'Neha', 'Adarsh (Frammer)'], color: '#fff' },
  { id: 'Active Users', count: 4, icon: '⚡', avg: {up: 67, cr: 169, pub: 6, conv: '3.85%'}, users: ['Alok Rai', 'QA-Bhargavi', 'Prithviraj', 'Harish'], color: '#fff' },
  { id: 'Moderate Users', count: 30, icon: '📊', avg: {up: 59, cr: 175, pub: 0, conv: '0.07%'}, users: ['Auto Upload', 'Dheeraj Pareek', 'vinay singh', 'Subhash', 'Anamika Singh', 'Divyanshu Dutta Roy'], color: '#888' },
  { id: 'Behavioral Outliers', count: 7, icon: '🔴', avg: {up: 246, cr: 1045, pub: 7, conv: '2.43%'}, users: ['Chandan', 'QA-Purushottam', 'vikas.s@moolya.com', 'Sandeep Belaki', 'Nitesh', 'Trivendra', 'QA-Amit'], color: '#ff4d6d' },
];

// --- COMPONENTS ---

const AnalyticsDashboard = () => {
  const [activeNav, setActiveNav] = useState('User Analysis');

  const sidebarItems = [
    { id: 'User Analysis', icon: <Users size={18} />, label: 'User Analysis' },
    { id: 'Channel Analysis', icon: <FileText size={18} />, label: 'Channel Analysis' },
    { id: 'Multidimension & Anomaly', icon: <Grid size={18} />, label: 'Multidimension & Anomaly' },
  ];

  const renderUserAnalysis = () => (
    <div className="analytics-content">
      {/* Header Info */}
      <div className="analytics-header-row">
        <div className="analytics-title-group">
          <h1>User Analysis</h1>
          <p>Individual contributor performance, loyalty tiers, and publish efficiency across 45 users.</p>
        </div>
        <div className="analytics-actions">
          <div className="sort-dropdown">Sort: Published <MoreHorizontal size={14} className="rotate-90" /></div>
          <button className="export-csv-btn"><FileDown size={16} /> Export CSV</button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <p className="kpi-label">Total Users</p>
          <div className="kpi-main">
            <h2 className="kpi-value">45</h2>
            <p className="kpi-sub">Unique uploaders</p>
          </div>
        </div>
        <div className="analytics-kpi-card">
          <p className="kpi-label">Active Users</p>
          <div className="kpi-main">
            <h2 className="kpi-value">44</h2>
            <p className="kpi-sub">Uploaded &ge;1 video</p>
          </div>
        </div>
        <div className="analytics-kpi-card">
          <p className="kpi-label">Repeatability Rate</p>
          <div className="kpi-main">
            <h2 className="kpi-value" style={{ color: '#00c864' }}>95.6%</h2>
            <p className="kpi-sub">43 / 45 repeat uploaders</p>
          </div>
        </div>
        <div className="analytics-kpi-card">
          <p className="kpi-label">Avg Uploads / User</p>
          <div className="kpi-main">
            <h2 className="kpi-value">99.0</h2>
            <p className="kpi-sub">Per active user</p>
          </div>
        </div>
        <div className="analytics-kpi-card">
          <p className="kpi-label">Top 10% Contribution</p>
          <div className="kpi-main">
            <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>51.4%</h2>
            <p className="kpi-sub">5 users &rarr; 57 of 111 pubs</p>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="analytics-main-grid">
        {/* Left Column: Leaderboard */}
        <div className="analytics-card leaderboard-card">
          <div className="card-header">
            <h4>USER LEADERBOARD &mdash; ALL 45 USERS</h4>
            <div className="card-filters">
              <button className="filter-pill active">All</button>
              <button className="filter-pill">Published Only</button>
              <button className="filter-pill">Zero-Pub</button>
            </div>
          </div>
          <div className="table-container">
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
                {leaderboardData.map((row) => (
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

        {/* Right Column: Donut & Scatter */}
        <div className="analytics-right-col">
          <div className="analytics-card side-card">
            <h4>USER LOYALTY TIERS</h4>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={loyaltyTiersData}
                    cx="40%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {loyaltyTiersData.map((entry, index) => (
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
                  <XAxis type="number" dataKey="uploaded" name="Uploaded" stroke="#444" fontSize={10} tickLine={false} axisLine={false} domain={[0, 500]} />
                  <YAxis type="number" dataKey="published" name="Published" stroke="#444" fontSize={10} tickLine={false} axisLine={false} domain={[0, 20]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} />
                  <Scatter name="Users" data={scatterData} fill="#3b82f6" fillOpacity={0.6} />
                  <Line type="monotone" dataKey="published" stroke="#ff4d6d" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar Charts */}
      <div className="analytics-bottom-grid">
        <div className="analytics-card">
          <h4>TOP 12 USERS &mdash; PUBLISHED COUNT</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topUsersPublishedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={70} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }} />
                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                  {topUsersPublishedData.map((entry, index) => (
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
              <BarChart data={topUsersPublishRateData}>
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

  const renderMultidimensionAnomaly = () => (
    <div className="analytics-content">
      {/* Top Branding & Breadcrumb */}
      <div className="anomaly-top-bar">
         <div className="anomaly-users-total">TOTAL USERS <span style={{ color: '#ff4d6d' }}>45</span></div>
      </div>
      
      <div className="anomaly-breadcrumb">
         <span style={{ color: '#ff4d6d' }}>All Data</span> &rsaquo; <strong>Channel &times; Published Status</strong>
      </div>

      {/* Dimension Selectors */}
      <div className="anomaly-selectors-row">
        <div className="selector-group">
          <label>DIMENSION 1 (ROWS)</label>
          <div className="selector-box">Channel <ArrowLeft size={12} className="rotate-270" /></div>
        </div>
        <div className="selector-group">
          <label>DIMENSION 2 (COLUMNS)</label>
          <div className="selector-box">Published Status <ArrowLeft size={12} className="rotate-270" /></div>
        </div>
        <div className="selector-group">
          <label>VALUE</label>
          <div className="value-pill-group">
            <button className="value-pill active">Count</button>
            <button className="value-pill">Duration</button>
            <button className="value-pill">Conversion %</button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="anomaly-kpi-grid">
        <div className="anomaly-kpi-card">
          <p className="kpi-label">TOTAL UPLOADED</p>
          <h2 className="kpi-value">4,453</h2>
          <p className="kpi-sub">807h 40m total duration</p>
        </div>
        <div className="anomaly-kpi-card">
          <p className="kpi-label">TOTAL CREATED</p>
          <h2 className="kpi-value">14,914</h2>
          <p className="kpi-sub">1355h 9m processing time</p>
        </div>
        <div className="anomaly-kpi-card white">
          <p className="kpi-label">TOTAL PUBLISHED</p>
          <h2 className="kpi-value">111</h2>
          <p className="kpi-sub">4h 22m published duration</p>
        </div>
        <div className="anomaly-kpi-card orange">
          <p className="kpi-label">PUBLISH CONVERSION</p>
          <h2 className="kpi-value">0.7%</h2>
          <p className="kpi-sub">Published / Created ratio</p>
        </div>
      </div>

      {/* Anomaly Detection List */}
      <div className="anomaly-detection-box">
        <div className="anomaly-detection-header">
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={18} color="#facc15" fill="#facc15" />
              <span style={{ fontWeight: 700 }}>Anomaly Detection</span>
              <span className="anomaly-count-tag">5 anomalies detected</span>
           </div>
           <button className="collapse-btn">Collapse &and;</button>
        </div>
        <div className="anomaly-list-content">
           <p className="list-category">HIGH PRIORITY</p>
           {anomalyList.map(item => (
             <div key={item.id} className="anomaly-item">
                {item.type === 'star' && <Star size={14} fill="#facc15" stroke="#facc15" />}
                {item.type === 'dot' && <span className="anomaly-dot" style={{ backgroundColor: item.color }}></span>}
                {item.type === 'chart' && <Activity size={14} color={item.color} />}
                <span>{item.text}</span>
             </div>
           ))}
        </div>
      </div>

      {/* User x Channel Matrix */}
      <div className="matrix-section">
        <div className="matrix-header">
           <h4>User × Channel Matrix</h4>
           <div style={{ display: 'flex', gap: '10px' }}>
              <div className="anomaly-count-tag mini"><Bell size={10} fill="#facc15" /> 42 anomalies</div>
              <div className="pre-agg-tag">Pre-Aggregated &middot; 45 × 18</div>
           </div>
        </div>
        <div className="matrix-container">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="sticky-col">USER ↓ / CHANNEL →</th>
                {['A','B','C','D','E','F','G','H','I','J','K','L','N','M','O','P','Q','R'].map(c => <th key={c}>{c}</th>)}
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {matrixData.map((row, i) => (
                <tr key={i}>
                  <td className="sticky-col">{row.user}</td>
                  {['A','B','C','D','E','F','G','H','I','J','K','L','N','M','O','P','Q','R'].map(c => (
                    <td key={c} className="matrix-cell">
                      {row[c] ? (
                        <div className="cell-content" style={{ backgroundColor: row[c].col }}>
                          {row[c].star && <Star size={10} fill="#facc15" stroke="#facc15" />}
                          {row[c].dot && <span className="cell-dot" style={{ backgroundColor: '#00c864' }}></span>}
                          {row[c].v}
                        </div>
                      ) : '—'}
                    </td>
                  ))}
                  <td style={{ fontWeight: 700 }}>{row.total}</td>
                </tr>
              ))}
              <tr className="total-row">
                 <td className="sticky-col">Total</td>
                 <td className="matrix-cell">1,470</td>
                 <td className="matrix-cell">1,293</td>
                 <td className="matrix-cell">765</td>
                 <td className="matrix-cell">221</td>
                 <td className="matrix-cell">201</td>
                 <td className="matrix-cell">130</td>
                 <td className="matrix-cell">106</td>
                 <td className="matrix-cell">89</td>
                 {Array(10).fill(0).map((_, i) => <td key={i} className="matrix-cell">—</td>)}
                 <td style={{ fontWeight: 700 }}>4,453</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown Tables */}
      <div className="analytics-bottom-grid">
         <div className="analytics-card">
            <div className="card-header">
               <h4>User Breakdown</h4>
               <span style={{ color: '#444', fontSize: '10px' }}>45 items</span>
            </div>
            <table className="analytics-table mini">
               <thead>
                  <tr>
                     <th>NAME</th>
                     <th style={{ textAlign: 'right' }}>UPLOADED</th>
                     <th style={{ textAlign: 'right' }}>CREATED</th>
                     <th style={{ textAlign: 'right' }}>PUBLISHED</th>
                     <th style={{ textAlign: 'right' }}>CONV%</th>
                  </tr>
               </thead>
               <tbody>
                  {leaderboardData.slice(0, 5).map((u, i) => (
                    <tr key={i}>
                       <td style={{ color: '#fff' }}>{u.name}</td>
                       <td style={{ textAlign: 'right' }}>{u.uploaded}</td>
                       <td style={{ textAlign: 'right' }}>{u.created}</td>
                       <td style={{ textAlign: 'right' }}>{u.published}</td>
                       <td style={{ textAlign: 'right' }}>
                          <span className="conv-tag">{u.pubRate}</span>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <div className="analytics-card">
            <div className="card-header">
               <h4>Channel Breakdown</h4>
               <span style={{ color: '#444', fontSize: '10px' }}>18 items</span>
            </div>
            <table className="analytics-table mini">
               <thead>
                  <tr>
                     <th>NAME</th>
                     <th style={{ textAlign: 'right' }}>VIDEOS</th>
                     <th style={{ textAlign: 'right' }}>PUBLISHED</th>
                     <th style={{ textAlign: 'right' }}>CONV%</th>
                  </tr>
               </thead>
               <tbody>
                  {['A','B','C','E','D'].map((c, i) => (
                    <tr key={i}>
                       <td style={{ color: '#fff' }}>{c}</td>
                       <td style={{ textAlign: 'right' }}>{i === 0 ? '4,729' : '4,251'}</td>
                       <td style={{ textAlign: 'right' }}>33</td>
                       <td style={{ textAlign: 'right' }}>
                          <span className="conv-tag">0.7%</span>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* ML Insights */}
      <div className="ml-insights-section">
         <div className="ml-header">
            <div>
               <h3>ML-Powered Insights</h3>
               <p>scikit-learn Backend</p>
            </div>
         </div>

         <div className="ml-kpi-row">
            <div className="ml-kpi-card">
               <label>MODEL</label>
               <div className="value">DBSCAN</div>
               <p className="sub">eps=1.2, min_samples=2</p>
            </div>
            <div className="ml-kpi-card">
               <label>USERS ANALYZED</label>
               <div className="value">45</div>
               <p className="sub">From Fact_User_Summary</p>
            </div>
            <div className="ml-kpi-card">
               <label>CLUSTERS FOUND</label>
               <div className="value">3</div>
               <p className="sub">Natural behavior groups</p>
            </div>
            <div className="ml-kpi-card outlier">
               <label>BEHAVIORAL OUTLIERS</label>
               <div className="value">7</div>
               <p className="sub">Don't fit any cluster</p>
            </div>
         </div>

         <div className="ml-explanation">
            <span style={{ color: '#ff4d6d' }}>How it works:</span> DBSCAN groups users by measuring <strong>density</strong> in feature space. Users close together (similar upload/create/publish patterns) form clusters. Users in sparse regions &mdash; with unique behavior patterns &mdash; are labeled as outliers. Unlike K-means, DBSCAN doesn't need a pre-set number of clusters.
         </div>

         <div className="cluster-grid">
            {clusterData.map((cluster, i) => (
               <div key={i} className={`cluster-card ${cluster.id === 'Behavioral Outliers' ? 'outlier' : ''}`}>
                  <div className="cluster-header">
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{cluster.icon}</span>
                        <span style={{ fontWeight: 700, color: cluster.color }}>{cluster.id}</span>
                     </div>
                     <span style={{ color: '#444', fontSize: '11px' }}>{cluster.count} users</span>
                  </div>
                  
                  <div className="cluster-stats">
                     <div className="stat">
                        <label>AVG UPLOADED</label>
                        <div className="val">{cluster.avg.up}</div>
                     </div>
                     <div className="stat">
                        <label>AVG CREATED</label>
                        <div className="val">{cluster.avg.cr}</div>
                     </div>
                     <div className="stat">
                        <label>AVG PUBLISHED</label>
                        <div className="val">{cluster.avg.pub}</div>
                     </div>
                     <div className="stat">
                        <label>AVG CONV%</label>
                        <div className="val">{cluster.avg.conv}</div>
                     </div>
                  </div>

                  <div className="cluster-users">
                     {cluster.users.map((u, j) => (
                        <span key={j} className="user-pill">{u}</span>
                     ))}
                     {cluster.id === 'Moderate Users' && <span className="user-pill">+22 more</span>}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );

  const renderChannelAnalysis = () => (
    <div className="analytics-content">
      {/* Header Info */}
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

      {/* KPI Row */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <p className="kpi-label">Total Channels</p>
          <div className="kpi-main">
            <h2 className="kpi-value">18</h2>
            <p className="kpi-sub">Active channels</p>
          </div>
        </div>
        <div className="analytics-kpi-card">
          <p className="kpi-label">Publishing Channels</p>
          <div className="kpi-main">
            <h2 className="kpi-value" style={{ color: '#00c864' }}>6</h2>
            <p className="kpi-sub">At least 1 published</p>
          </div>
        </div>
        <div className="analytics-kpi-card">
          <p className="kpi-label">Zero-Pub Channels</p>
          <div className="kpi-main">
            <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>12</h2>
            <p className="kpi-sub">0% publish rate</p>
          </div>
        </div>
        <div className="analytics-kpi-card">
          <p className="kpi-label">Best Channel</p>
          <div className="kpi-main">
            <h2 className="kpi-value">Ch. A</h2>
            <p className="kpi-sub">4.83% rate &middot; 71 published</p>
          </div>
        </div>
        <div className="analytics-kpi-card">
          <p className="kpi-label">Avg Creation Eff.</p>
          <div className="kpi-main">
            <h2 className="kpi-value" style={{ color: '#00c864' }}>3.35x</h2>
            <p className="kpi-sub">Clips per upload</p>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="analytics-main-grid">
        <div className="analytics-card">
          <h4>CHANNEL UPLOAD &middot; CREATED &middot; PUBLISHED COMPARISON</h4>
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v} />
                <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="top" align="center" iconType="rect" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar dataKey="uploaded" fill="#8b1e33" name="Uploaded" radius={[2, 2, 0, 0]} />
                <Bar dataKey="created" fill="#f97316" name="Created" radius={[2, 2, 0, 0]} />
                <Bar dataKey="published" fill="#00c864" name="Published &times; 10" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="analytics-card">
          <h4>CHANNEL PUBLISH RATE % (PUBLISHED / UPLOADED)</h4>
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelPublishRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {channelPublishRateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="analytics-main-grid">
        {/* Drill-down Table */}
        <div className="analytics-card leaderboard-card">
          <div className="card-header">
            <h4>CHANNEL &times; USER DRILL-DOWN MATRIX</h4>
            <div className="header-dropdown">All Channels <ArrowLeft size={12} className="rotate-270" /></div>
          </div>
          <div className="table-container">
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
                {channelDrilldownData.map((row, i) => (
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

        {/* Right column charts */}
        <div className="analytics-right-col">
          <div className="analytics-card side-card">
            <h4>USERS PER CHANNEL</h4>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Ch.A', val: 37 }, { name: 'Ch.B', val: 36 }, { name: 'Ch.C', val: 34 },
                  { name: 'Ch.D', val: 17 }, { name: 'Ch.E', val: 20 }, { name: 'Ch.F', val: 22 },
                  { name: 'Ch.G', val: 12 }, { name: 'Ch.H', val: 8 },
                ]}>
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
                <BarChart data={[
                  { name: 'Ch.A', val: 3.21 }, { name: 'Ch.B', val: 3.29 }, { name: 'Ch.C', val: 3.44 },
                  { name: 'Ch.D', val: 3.17 }, { name: 'Ch.E', val: 4.81 }, { name: 'Ch.F', val: 2.46 },
                  { name: 'Ch.L', val: 12.5, highlight: true },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#444" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} unit="x" />
                  <Tooltip cursor={{ fill: '#222' }} />
                  <Bar dataKey="val" radius={[2, 2, 0, 0]}>
                    {[{name:'Ch.A',val:3.21},{name:'Ch.B',val:3.29},{name:'Ch.C',val:3.44},{name:'Ch.D',val:3.17},{name:'Ch.E',val:4.81},{name:'Ch.F',val:2.46},{name:'Ch.L',val:12.5,highlight:true}].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.highlight ? '#00c864' : '#8b1e33'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Spotlight Section */}
      <div className="analytics-card">
        <h4>CHANNEL SPOTLIGHT &mdash; PERFORMANCE BADGES</h4>
        <div className="spotlight-grid">
          {channelSpotlightData.map((ch, i) => (
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

  return (
    <div className="analytics-dashboard-layout">
      {/* Sidebar */}
      <aside className="analytics-sidebar">
        <div className="analytics-sidebar-header">
           <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
           <div className="sidebar-brand mini">
              <div className="logo-box mini">F</div>
              <span>Frammer <span style={{ color: '#ff4d6d' }}>AI</span></span>
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

      {/* Main Content */}
      <main className="analytics-main">
        <header className="analytics-header">
          <div className="header-search-container">
            <Search size={18} color="#555" />
            <input type="text" placeholder="Search metrics..." />
          </div>
          <div className="header-actions">
            <div className="time-pill-group">
              <button className="time-pill">Day</button>
              <button className="time-pill">Week</button>
              <button className="time-pill active">Month</button>
              <button className="time-pill">Quarter</button>
            </div>
            <div className="header-dropdown">Client <ArrowLeft size={12} className="rotate-270" /></div>
            <div className="header-dropdown">Platform <ArrowLeft size={12} className="rotate-270" /></div>
            <div className="header-dropdown">User <ArrowLeft size={12} className="rotate-270" /></div>
            <div className="header-icon-btn"><Bell size={18} /></div>
            <div className="user-profile-mini">JD</div>
          </div>
        </header>

        <div className="analytics-scroll-area">
          {activeNav === 'User Analysis' ? renderUserAnalysis() : 
           activeNav === 'Channel Analysis' ? renderChannelAnalysis() : 
           activeNav === 'Multidimension & Anomaly' ? renderMultidimensionAnomaly() : (
            <div className="analytics-content">
              <h2 style={{ color: '#444' }}>Coming Soon: {activeNav}</h2>
            </div>
          )}
        </div>
        
        <div className="help-fab mini">
          <HelpCircle size={20} />
        </div>
      </main>
    </div>
  );
};

export default AnalyticsDashboard;
