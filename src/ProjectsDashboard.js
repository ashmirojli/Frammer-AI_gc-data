import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Area, AreaChart, ScatterChart, Scatter, ZAxis,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  ArrowLeft, Search, Bell, Grid, FileText, Globe, Zap, Clock, Database, BarChart2, TrendingUp, Users, Activity, HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

// --- MOCK DATA ---
const overviewTrendData = [
  { name: 'Jan', reels: 4000, shorts: 6000, posts: 8000 },
  { name: 'Feb', reels: 3000, shorts: 5000, posts: 7000 },
  { name: 'Mar', reels: 12000, shorts: 10000, posts: 14000 },
  { name: 'Apr', reels: 6000, shorts: 8000, posts: 9000 },
  { name: 'May', reels: 5000, shorts: 7000, posts: 8000 },
  { name: 'Jun', reels: 6000, shorts: 8000, posts: 9000 },
  { name: 'Jul', reels: 7000, shorts: 9000, posts: 10000 },
];

const inputTypeTrendData = [
  { name: 'Jan', podcast: 1000, webinar: 1200, talkinghead: 2800 },
  { name: 'Feb', podcast: 1500, webinar: 1800, talkinghead: 3200 },
  { name: 'Mar', podcast: 1800, webinar: 2200, talkinghead: 4200 },
  { name: 'Apr', podcast: 1600, webinar: 2000, talkinghead: 3800 },
  { name: 'May', podcast: 2200, webinar: 2800, talkinghead: 4800 },
  { name: 'Jun', podcast: 2500, webinar: 3200, talkinghead: 5200 },
  { name: 'Jul', podcast: 3000, webinar: 3800, talkinghead: 6200 },
];

const editorialYieldData = [
  { name: 'Jan', created: 8000, published: 5000, expansion: 4 },
  { name: 'Feb', created: 8200, published: 5500, expansion: 4.2 },
  { name: 'Mar', created: 9500, published: 7500, expansion: 5 },
  { name: 'Apr', created: 9000, published: 7200, expansion: 4.8 },
  { name: 'May', created: 12000, published: 8000, expansion: 5.5 },
  { name: 'Jun', created: 13000, published: 9500, expansion: 5.8 },
  { name: 'Jul', created: 15000, published: 11000, expansion: 6 },
];

const ecosystemData = [
  { name: 'YouTube', value: 35, color: '#ff4d6d' },
  { name: 'Instagram', value: 28, color: '#ff4d6d' },
  { name: 'TikTok', value: 37, color: '#00c864' },
];

const generationRateData = [
  { name: 'Instagram Reels', rate: 8.5, color: '#00c864' },
  { name: 'TikTok Shorts', rate: 7.2, color: '#3b82f6' },
  { name: 'YouTube Chapters', rate: 6.8, color: '#3b82f6' },
  { name: 'Video Summaries', rate: 5.4, color: '#3b82f6' },
  { name: 'Highlight Clips', rate: 4.9, color: '#3b82f6' },
];

const summaryMetrics = [
  { group: 'Total Processing', uploaded: '145,200', created: '98,600', published: '84,200', rate: '85%', color: '#00c864' },
  { group: 'Q3 Townhall', uploaded: '1,250', created: '3,800', published: '2,900', rate: '76%', color: '#ff4d6d' },
];

// --- COMPONENTS ---

const CustomScatterTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ 
        backgroundColor: '#0c0c0e', 
        border: '1px solid #333', 
        padding: '12px 16px', 
        borderRadius: '8px',
        boxShadow: '0 10px 20px rgba(0,0,0,0.5)'
      }}>
        <h4 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700 }}>{data.name}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
          <div style={{ color: '#00c864' }}>Active Users: {data.users}</div>
          <div style={{ color: '#ff4d6d' }}>Videos: {data.videos.toLocaleString()}</div>
          <div style={{ color: '#f97316' }}>Productivity: {data.index}</div>
        </div>
      </div>
    );
  }
  return null;
};

const ProjectsDashboard = () => {
  const [activeTab, setActiveTab] = useState('Overview');

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

  const renderOverview = () => (
    <div className="projects-content">
      <svg style={{ height: 0, width: 0, position: 'absolute' }}>
        <defs>
          <linearGradient id="colorReels" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#ff4d6d" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorShorts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff8da1" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#ff8da1" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ffd1d9" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#ffd1d9" stopOpacity={0}/>
          </linearGradient>
        </defs>
      </svg>
      {/* KPI Row 1 */}
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card">
          <div className="kpi-icon-box"><Database size={20} /></div>
          <div>
            <p className="kpi-label">UPLOADED</p>
            <h2 className="kpi-value">145,200</h2>
          </div>
        </div>
        <div className="projects-kpi-card">
          <div className="kpi-icon-box"><Activity size={20} /></div>
          <div>
            <p className="kpi-label">PROCESSED</p>
            <h2 className="kpi-value">132,450</h2>
            <p className="kpi-trend down">-- 8.8% drop</p>
          </div>
        </div>
        <div className="projects-kpi-card">
          <div className="kpi-icon-box" style={{ color: '#ff4d6d' }}><Zap size={20} /></div>
          <div>
            <p className="kpi-label">AI CREATED</p>
            <h2 className="kpi-value">98,600</h2>
            <p className="kpi-trend down">-- 25.5% drop</p>
          </div>
        </div>
        <div className="projects-kpi-card">
          <div className="kpi-icon-box" style={{ color: '#00c864' }}><Globe size={20} /></div>
          <div>
            <p className="kpi-label">PUBLISHED</p>
            <h2 className="kpi-value">84,200</h2>
            <p className="kpi-trend down">-- 14.6% drop</p>
          </div>
        </div>
      </div>

      {/* KPI Row 2 */}
      <div className="projects-stats-grid">
        <div className="projects-stat-box">
          <p className="stat-label">Total Published</p>
          <h3 className="stat-value">12,458</h3>
          <p className="stat-trend up">+18.2% from last month</p>
        </div>
        <div className="projects-stat-box">
          <p className="stat-label">Active Users</p>
          <h3 className="stat-value">1,247</h3>
          <p className="stat-trend up">+5.4% growth</p>
        </div>
        <div className="projects-stat-box">
          <p className="stat-label">Publish Rate</p>
          <h3 className="stat-value">86.3%</h3>
          <p className="stat-status-ok">Above target (80%)</p>
        </div>
        <div className="projects-stat-box">
          <p className="stat-label">Avg Creation Time</p>
          <h3 className="stat-value">2.4h</h3>
          <p className="stat-trend down">-12% efficiency</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Output Type Published vs Month</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overviewTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="posts" stackId="1" stroke="#ff4d6d" fill="url(#colorReels)" fillOpacity={1} />
                <Area type="monotone" dataKey="shorts" stackId="1" stroke="#ff8da1" fill="url(#colorShorts)" fillOpacity={1} />
                <Area type="monotone" dataKey="reels" stackId="1" stroke="#ffd1d9" fill="url(#colorPosts)" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Input Type Published vs Month</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inputTypeTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="talkinghead" stroke="#ff4d6d" strokeWidth={2} dot={{ r: 4 }} name="Talking Head" />
                <Line type="monotone" dataKey="webinar" stroke="#ff8da1" strokeWidth={2} dot={{ r: 4 }} name="Webinar" />
                <Line type="monotone" dataKey="podcast" stroke="#ffd1d9" strokeWidth={2} dot={{ r: 4 }} name="Podcast" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="projects-table-section">
        <h4>Overall Summary Metrics</h4>
        <table className="projects-summary-table">
          <thead>
            <tr>
              <th>METRIC GROUP</th>
              <th>UPLOADED</th>
              <th>CREATED</th>
              <th>PUBLISHED</th>
              <th>PUBLISH RATE</th>
            </tr>
          </thead>
          <tbody>
            {summaryMetrics.map((row, i) => (
              <tr key={i}>
                <td>{row.group}</td>
                <td>{row.uploaded}</td>
                <td>{row.created}</td>
                <td>{row.published}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: row.color, fontWeight: 700, minWidth: '35px' }}>{row.rate}</span>
                    <div className="progress-bg">
                      <div className="progress-fill" style={{ width: row.rate, backgroundColor: row.color }}></div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderEditorialYield = () => (
    <div className="projects-content">
      <div className="projects-chart-card large">
        <h4>Created vs Published & Expansion Factor</h4>
        <p className="chart-subtitle">Output efficiency and creation multiplier</p>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={editorialYieldData}>
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
          <h4>Contributor Matrix</h4>
          <p className="chart-subtitle">Volume vs Quality</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid stroke="#222" />
                <XAxis type="number" dataKey="x" name="Volume" unit="" stroke="#444" />
                <YAxis type="number" dataKey="y" name="Quality" unit="" stroke="#444" />
                <ZAxis type="number" dataKey="z" range={[60, 400]} name="Users" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Contributors" data={[
                  { x: 150, y: 55, z: 200 },
                  { x: 200, y: 90, z: 260 },
                  { x: 300, y: 70, z: 400 },
                  { x: 350, y: 85, z: 300 },
                  { x: 450, y: 75, z: 280 },
                  { x: 500, y: 88, z: 350 },
                ]} fill="#00c864" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Platform Distribution</h4>
          <p className="chart-subtitle">% Share over time</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { name: 'Jan', yt: 30, ig: 40, tt: 20, ln: 10 },
                { name: 'Feb', yt: 25, ig: 45, tt: 20, ln: 10 },
                { name: 'Mar', yt: 35, ig: 35, tt: 20, ln: 10 },
                { name: 'Apr', yt: 28, ig: 42, tt: 20, ln: 10 },
                { name: 'May', yt: 20, ig: 50, tt: 20, ln: 10 },
                { name: 'Jun', yt: 15, ig: 55, tt: 20, ln: 10 },
              ]}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="yt" stackId="1" stroke="none" fill="#ff4d6d" />
                <Area type="monotone" dataKey="ig" stackId="1" stroke="none" fill="#8b1e33" />
                <Area type="monotone" dataKey="tt" stackId="1" stroke="none" fill="#00c864" />
                <Area type="monotone" dataKey="ln" stackId="1" stroke="none" fill="#3b82f6" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEcosystem = () => (
    <div className="projects-content">
      <div className="projects-charts-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <div className="projects-chart-card">
          <h4>Publishing Ecosystem Map</h4>
          <p className="chart-subtitle">Two-layer hierarchy: Platform (inner) -> Channel (outer)</p>
          <div style={{ height: 450, position: 'relative' }}>
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ecosystemData} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                    {ecosystemData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Pie data={[
                    { name: 'YT Long', value: 12, color: '#8b1e33' },
                    { name: 'YT Clips', value: 5, color: '#ff4d6d' },
                    { name: 'YT Shorts', value: 18, color: '#ff8da1' },
                    { name: 'IG Reels', value: 15, color: '#ff8da1' },
                    { name: 'IG Stories', value: 9, color: '#ff4d6d' },
                    { name: 'IG Posts', value: 4, color: '#8b1e33' },
                    { name: 'TT Shorts', value: 20, color: '#00c864' },
                    { name: 'TT Series', value: 12, color: '#10b981' },
                    { name: 'TT Live', value: 5, color: '#2dd4bf' },
                  ]} dataKey="value" innerRadius={100} outerRadius={140} paddingAngle={2} stroke="none" labelLine={false} label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    <Cell fill="#8b1e33" /><Cell fill="#ff4d6d" /><Cell fill="#ff8da1" />
                    <Cell fill="#ff8da1" /><Cell fill="#ff4d6d" /><Cell fill="#8b1e33" />
                    <Cell fill="#00c864" /><Cell fill="#10b981" /><Cell fill="#2dd4bf" />
                  </Pie>
                </PieChart>
             </ResponsiveContainer>
          </div>
          
          <div className="ecosystem-stats-overlay">
             <div className="eco-platform-row">
                <div className="eco-platform-card">
                   <div className="dot" style={{ backgroundColor: '#ff4d6d' }}></div>
                   <span className="label">YouTube</span>
                   <span className="val">35%</span>
                </div>
                <div className="eco-platform-card">
                   <div className="dot" style={{ backgroundColor: '#ff8da1' }}></div>
                   <span className="label">Instagram</span>
                   <span className="val">28%</span>
                </div>
                <div className="eco-platform-card">
                   <div className="dot" style={{ backgroundColor: '#00c864' }}></div>
                   <span className="label">TikTok</span>
                   <span className="val">37%</span>
                </div>
             </div>
             
             <div className="eco-channel-grid">
                {[
                   { name: 'YT Shorts', val: '18%', color: '#ff4d6d' },
                   { name: 'YT Long Form', val: '12%', color: '#ff4d6d' },
                   { name: 'YT Clips', val: '5%', color: '#ff4d6d' },
                   { name: 'IG Reels', val: '15%', color: '#ff8da1' },
                   { name: 'IG Stories', val: '9%', color: '#ff8da1' },
                   { name: 'IG Posts', val: '4%', color: '#ff8da1' },
                   { name: 'TT Shorts', val: '20%', color: '#00c864' },
                   { name: 'TT Series', val: '12%', color: '#00c864' },
                   { name: 'TT Live', val: '5%', color: '#00c864' },
                ].map((item, i) => (
                   <div key={i} className="eco-channel-pill">
                      <div className="dot" style={{ backgroundColor: item.color }}></div>
                      <span className="label">{item.name}</span>
                      <span className="val">{item.val}</span>
                   </div>
                ))}
             </div>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Channel Output Velocity</h4>
          <p className="chart-subtitle">Publishing volume trends across primary channels</p>
          <div style={{ height: 450 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { name: 'Jan', yt: 1500, ig: 1200, tt: 800 },
                { name: 'Feb', yt: 1600, ig: 1400, tt: 1000 },
                { name: 'Mar', yt: 1550, ig: 1500, tt: 1400 },
                { name: 'Apr', yt: 1800, ig: 1600, tt: 1600 },
                { name: 'May', yt: 2000, ig: 1900, tt: 1800 },
                { name: 'Jun', yt: 2200, ig: 2100, tt: 2000 },
                { name: 'Jul', yt: 2300, ig: 2300, tt: 2200 },
                { name: 'Aug', yt: 2400, ig: 2500, tt: 2400 },
                { name: 'Sep', yt: 2500, ig: 2600, tt: 2600 },
                { name: 'Oct', yt: 2600, ig: 2700, tt: 2700 },
                { name: 'Nov', yt: 2700, ig: 2800, tt: 2800 },
                { name: 'Dec', yt: 2850, ig: 2900, tt: 2950 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 2800]} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                <Line type="monotone" dataKey="yt" stroke="#ff4d6d" strokeWidth={3} name="YouTube" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="ig" stroke="#ff8da1" strokeWidth={3} name="Instagram" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="tt" stroke="#ffd1d9" strokeWidth={3} name="TikTok" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGenerationRate = () => (
    <div className="projects-content">
      <svg style={{ height: 0, width: 0, position: 'absolute' }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00c864" stopOpacity={1}/>
            <stop offset="100%" stopColor="#00c864" stopOpacity={0.6}/>
          </linearGradient>
        </defs>
      </svg>
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Avg Generation Rate</p>
          <h2 className="kpi-value" style={{ color: '#00c864' }}>6.61</h2>
          <p className="kpi-sub">items per upload</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Peak Rate</p>
          <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>8.5</h2>
          <p className="kpi-sub">Instagram Reels</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Total Generated</p>
          <h2 className="kpi-value">48.4K</h2>
          <p className="kpi-sub">total items</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Total Uploads</p>
          <h2 className="kpi-value" style={{ color: '#a855f7' }}>7,322</h2>
          <p className="kpi-sub">source videos</p>
        </div>
      </div>

      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Items Generated per Upload by Output Format</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={generationRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {generationRateData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Monthly Average Generation Rate</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { name: 'Jan', rate: 5.8 },
                { name: 'Feb', rate: 6.2 },
                { name: 'Mar', rate: 6.5 },
                { name: 'Apr', rate: 6.8 },
                { name: 'May', rate: 6.3 },
                { name: 'Jun', rate: 6.9 },
                { name: 'Jul', rate: 7.2 },
                { name: 'Aug', rate: 7.8 },
                { name: 'Sep', rate: 7.3 },
                { name: 'Oct', rate: 7.9 },
                { name: 'Nov', rate: 7.4 },
                { name: 'Dec', rate: 8.1 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[5, 9]} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Line type="monotone" dataKey="rate" stroke="#a855f7" strokeWidth={3} dot={{ r: 4, fill: '#a855f7' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Platform Generation Rate</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'YouTube', rate: 7.2, color: '#ff4d6d' },
                { name: 'Instagram', rate: 8.1, color: '#ff4d6d' },
                { name: 'TikTok', rate: 7.5, color: '#00c864' },
                { name: 'LinkedIn', rate: 4.8, color: '#3b82f6' },
              ]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 12]} />
                <YAxis dataKey="name" type="category" stroke="#444" fontSize={11} tickLine={false} axisLine={false} width={80} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {[
                    { color: '#ff4d6d' }, { color: '#ff4d6d' }, { color: '#00c864' }, { color: '#3b82f6' }
                  ].map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Efficiency Distribution</h4>
          <div style={{ height: 300, display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[
                  { name: 'High Yield (>7)', value: 45, color: '#00c864' },
                  { name: 'Medium Yield (5-7)', value: 35, color: '#f97316' },
                  { name: 'Low Yield (<5)', value: 20, color: '#ff4d6d' },
                ]} dataKey="value" innerRadius={0} outerRadius={100} paddingAngle={0} stroke="none">
                  <Cell fill="#00c864" />
                  <Cell fill="#f97316" />
                  <Cell fill="#ff4d6d" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ width: '150px' }}>
               <div style={{ color: '#00c864', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>High Yield (&gt;7)</div>
                <div style={{ color: '#f97316', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Medium Yield (5-7)</div>
                <div style={{ color: '#ff4d6d', fontSize: '14px', fontWeight: 700 }}>Low Yield (&lt;5)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="projects-table-section">
        <table className="projects-summary-table">
          <thead>
            <tr>
              <th>Format</th>
              <th style={{ textAlign: 'right' }}>Rate</th>
              <th style={{ textAlign: 'right' }}>Items</th>
              <th style={{ textAlign: 'right' }}>Uploads</th>
              <th>Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {[
              { format: 'Instagram Reels', rate: '8.50', items: '12,850', uploads: '1,512', eff: 85, color: '#00c864' },
              { format: 'TikTok Shorts', rate: '7.20', items: '11,420', uploads: '1,586', eff: 72, color: '#00c864' },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#fff' }}>{row.format}</td>
                <td style={{ textAlign: 'right', color: row.color, fontWeight: 700 }}>{row.rate}</td>
                <td style={{ textAlign: 'right' }}>{row.items}</td>
                <td style={{ textAlign: 'right' }}>{row.uploads}</td>
                <td>
                  <div className="progress-bg" style={{ width: '200px' }}>
                    <div className="progress-fill" style={{ width: `${row.eff}%`, backgroundColor: row.color }}></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProductivityIndex = () => (
    <div className="projects-content">
      {/* KPI Row */}
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Avg Productivity</p>
          <h2 className="kpi-value" style={{ color: '#00c864' }}>50.6</h2>
          <p className="kpi-sub">videos per user</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Peak Month</p>
          <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>61.2</h2>
          <p className="kpi-sub">December 2026</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Total Videos</p>
          <h2 className="kpi-value">94.7K</h2>
          <p className="kpi-sub">published in 2026</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Avg Active Users</p>
          <h2 className="kpi-value" style={{ color: '#a855f7' }}>154</h2>
          <p className="kpi-sub">monthly average</p>
        </div>
      </div>

      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Published Videos per Active User by Month</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Jan', val: 42 }, { name: 'Feb', val: 45 }, { name: 'Mar', val: 44 },
                { name: 'Apr', val: 48 }, { name: 'May', val: 47 }, { name: 'Jun', val: 51 },
                { name: 'Jul', val: 50 }, { name: 'Aug', val: 54 }, { name: 'Sep', val: 52 },
                { name: 'Oct', val: 58 }, { name: 'Nov', val: 55 }, { name: 'Dec', val: 61 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 80]} />
                <Tooltip cursor={{ fill: '#222' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Bar dataKey="val" fill="#3b82f6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#fff', fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Active Users &amp; Total Videos</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={[
                { name: 'Jan', users: 125, videos: 5288 },
                { name: 'Feb', users: 132, videos: 5953 },
                { name: 'Mar', users: 130, videos: 5720 },
                { name: 'Apr', users: 145, videos: 6960 },
                { name: 'May', users: 140, videos: 6580 },
                { name: 'Jun', users: 155, videos: 7905 },
                { name: 'Jul', users: 150, videos: 7500 },
                { name: 'Aug', users: 165, videos: 8910 },
                { name: 'Sep', users: 160, videos: 8320 },
                { name: 'Oct', users: 180, videos: 10440 },
                { name: 'Nov', users: 175, videos: 9625 },
                { name: 'Dec', users: 195, videos: 11895 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 200]} />
                <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 12000]} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="bottom" align="center" />
                <Bar yAxisId="left" dataKey="users" fill="#a855f7" radius={[4, 4, 0, 0]} name="Active Users" />
                <Line yAxisId="right" type="monotone" dataKey="videos" stroke="#00c864" strokeWidth={3} dot={{ r: 4, fill: '#00c864' }} name="Published Videos" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Productivity by User Category</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Power Users (>60)', val: 78.4, color: '#00c864' },
                { name: 'Regular Users (40-60)', val: 52.3, color: '#3b82f6' },
                { name: 'Light Users (<40)', val: 28.7, color: '#f97316' },
              ]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 80]} />
                <YAxis dataKey="name" type="category" stroke="#444" fontSize={10} tickLine={false} axisLine={false} width={120} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="val" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#fff', fontSize: 11 }}>
                  {[
                    { color: '#00c864' }, { color: '#3b82f6' }, { color: '#f97316' }
                  ].map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Quarterly Productivity Growth</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { name: 'Q1', prod: 43.5, growth: 0 },
                { name: 'Q2', prod: 48.2, growth: 10.8 },
                { name: 'Q3', prod: 51.4, growth: 6.6 },
                { name: 'Q4', prod: 58.1, growth: 13.0 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 60]} />
                <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 15]} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="bottom" align="center" />
                <Line yAxisId="left" type="monotone" dataKey="prod" stroke="#ff4d6d" strokeWidth={3} dot={{ r: 5, fill: '#ff4d6d' }} name="Productivity" />
                <Line yAxisId="right" type="monotone" dataKey="growth" stroke="#00c864" strokeWidth={3} dot={{ r: 5, fill: '#00c864' }} name="Growth %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="projects-table-section">
        <h4>Monthly Breakdown</h4>
        <table className="projects-summary-table">
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: 'right' }}>Videos/User</th>
              <th style={{ textAlign: 'right' }}>Active Users</th>
              <th style={{ textAlign: 'right' }}>Total Videos</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {[
              { month: 'Jan', vpu: '42.3', users: '125', total: '5,288', perf: 75, color: '#f97316' },
              { month: 'Feb', vpu: '45.1', users: '132', total: '5,953', perf: 82, color: '#f97316' },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#fff' }}>{row.month}</td>
                <td style={{ textAlign: 'right', color: row.color, fontWeight: 700 }}>{row.vpu}</td>
                <td style={{ textAlign: 'right' }}>{row.users}</td>
                <td style={{ textAlign: 'right' }}>{row.total}</td>
                <td>
                  <div className="progress-bg" style={{ width: '200px' }}>
                    <div className="progress-fill" style={{ width: `${row.perf}%`, backgroundColor: row.color }}></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDurationFootprint = () => (
    <div className="projects-content">
      {/* KPI Row */}
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Total Uploaded</p>
          <h2 className="kpi-value" style={{ color: '#a855f7' }}>225K</h2>
          <p className="kpi-sub">minutes in 2026</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Total Created</p>
          <h2 className="kpi-value" style={{ color: '#00c864' }}>708K</h2>
          <p className="kpi-sub">minutes created</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Total Published</p>
          <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>566K</h2>
          <p className="kpi-sub">minutes published</p>
        </div>
        <div className="projects-kpi-card mini">
          <p className="kpi-label">Expansion Rate</p>
          <h2 className="kpi-value" style={{ color: '#f97316' }}>3.14x</h2>
          <p className="kpi-sub">created vs uploaded</p>
        </div>
      </div>

      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Duration Footprint by Month</h4>
          <p className="chart-subtitle">Uploaded, Created, and Published Duration (minutes)</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { name: 'Jan', uploaded: 15400, created: 48700, published: 38900 },
                { name: 'Feb', uploaded: 16900, created: 52300, published: 41900 },
                { name: 'Mar', uploaded: 18200, created: 58500, published: 46800 },
                { name: 'Apr', uploaded: 17500, created: 55200, published: 44100 },
                { name: 'May', uploaded: 19800, created: 64100, published: 51200 },
                { name: 'Jun', uploaded: 21200, created: 68500, published: 54800 },
                { name: 'Jul', uploaded: 20500, created: 65800, published: 52600 },
                { name: 'Aug', uploaded: 22800, created: 74100, published: 59200 },
                { name: 'Sep', uploaded: 21500, created: 69200, published: 55300 },
                { name: 'Oct', uploaded: 24200, created: 78500, published: 62800 },
                { name: 'Nov', uploaded: 23500, created: 75200, published: 60100 },
                { name: 'Dec', uploaded: 26800, created: 88500, published: 70800 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}K`} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="bottom" align="center" />
                <Area type="monotone" dataKey="uploaded" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} name="Uploaded Duration" />
                <Area type="monotone" dataKey="created" stroke="#00c864" fill="#00c864" fillOpacity={0.1} name="Created Duration" />
                <Area type="monotone" dataKey="published" stroke="#ff4d6d" fill="#ff4d6d" fillOpacity={0.1} name="Published Duration" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Expansion &amp; Publish Rate</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={[
                { name: 'Jan', exp: 3.16, pub: 80 },
                { name: 'Feb', exp: 3.11, pub: 80.1 },
                { name: 'Mar', exp: 3.21, pub: 80.2 },
                { name: 'Apr', exp: 3.15, pub: 79.9 },
                { name: 'May', exp: 3.24, pub: 80.3 },
                { name: 'Jun', exp: 3.23, pub: 80.4 },
                { name: 'Jul', exp: 3.21, pub: 80.1 },
                { name: 'Aug', exp: 3.25, pub: 80.5 },
                { name: 'Sep', exp: 3.22, pub: 80.2 },
                { name: 'Oct', exp: 3.24, pub: 80.4 },
                { name: 'Nov', exp: 3.20, pub: 80.1 },
                { name: 'Dec', exp: 3.30, pub: 80.6 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 5]} />
                <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[70, 85]} />
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                <Legend verticalAlign="bottom" align="center" />
                <Line yAxisId="left" type="monotone" dataKey="exp" stroke="#00c864" strokeWidth={3} dot={{ r: 4, fill: '#00c864' }} name="Expansion Rate (x)" />
                <Line yAxisId="right" type="stepAfter" dataKey="pub" stroke="#ff4d6d" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#ff4d6d' }} name="Publish Rate (%)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="projects-charts-grid">
        <div className="projects-chart-card">
          <h4>Duration by Format Type</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Short Form', val: 145000, color: '#ff4d6d' },
                { name: 'Medium Form', val: 198000, color: '#00c864' },
                { name: 'Long Form', val: 172000, color: '#3b82f6' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}K`} domain={[0, 200000]} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                  {[
                    { color: '#ff4d6d' }, { color: '#00c864' }, { color: '#3b82f6' }
                  ].map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="projects-chart-card">
          <h4>Efficiency Metrics</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Upload Efficiency', val: 94.2, color: '#00c864' },
                { name: 'Creation Efficiency', val: 91.5, color: '#00c864' },
                { name: 'Publish Efficiency', val: 78.4, color: '#f97316' },
                { name: 'Overall Footprint', val: 88.1, color: '#00c864' },
              ]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" stroke="#444" fontSize={10} tickLine={false} axisLine={false} width={120} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="val" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#fff', fontSize: 11 }}>
                  {[
                    { color: '#00c864' }, { color: '#00c864' }, { color: '#f97316' }, { color: '#00c864' }
                  ].map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="projects-table-section">
        <h4>Monthly Duration Summary</h4>
        <table className="projects-summary-table">
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: 'right' }}>Uploaded</th>
              <th style={{ textAlign: 'right' }}>Created</th>
              <th style={{ textAlign: 'right' }}>Published</th>
              <th style={{ textAlign: 'right' }}>Expansion</th>
              <th style={{ textAlign: 'right' }}>Publish %</th>
            </tr>
          </thead>
          <tbody>
            {[
              { month: 'Jan', up: '15.4K', cr: '48.7K', pb: '38.9K', exp: '3.16x', pub: '80.0%' },
              { month: 'Feb', up: '16.9K', cr: '52.3K', pb: '41.9K', exp: '3.11x', pub: '80.1%' },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#fff' }}>{row.month}</td>
                <td style={{ textAlign: 'right', color: '#a855f7' }}>{row.up}</td>
                <td style={{ textAlign: 'right', color: '#00c864' }}>{row.cr}</td>
                <td style={{ textAlign: 'right', color: '#ff4d6d' }}>{row.pb}</td>
                <td style={{ textAlign: 'right' }}>{row.exp}</td>
                <td style={{ textAlign: 'right' }}>{row.pub}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMetadataHealth = () => (
    <div className="projects-content">
      <div className="projects-charts-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="projects-chart-card">
          <p className="kpi-label">System Health Score</p>
          <h2 className="kpi-value" style={{ fontSize: '48px', color: '#f97316' }}>88.1%</h2>
          <p className="kpi-trend up" style={{ fontSize: '18px', color: '#f97316' }}>Good</p>
          
          <div style={{ marginTop: '40px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#555', fontSize: '13px' }}>Total Assets:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>48,392</span>
             </div>
             <div style={{ borderTop: '1px solid #111', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                   <span style={{ color: '#555' }}>Excellent</span>
                   <span style={{ color: '#00c864' }}>&gt;90%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px' }}>
                   <span style={{ color: '#555' }}>Good</span>
                   <span style={{ color: '#f97316' }}>70-90%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                   <span style={{ color: '#555' }}>Needs Work</span>
                   <span style={{ color: '#ff4d6d' }}>&lt;70%</span>
                </div>
             </div>
          </div>
        </div>
        
        <div className="projects-chart-card">
          <h4>Metadata Completeness Radar</h4>
          <p className="chart-subtitle">Field-by-field completeness analysis</p>
          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                { subject: 'Platform Tagged', A: 94.5 },
                { subject: 'URL Provided', A: 89.2 },
                { subject: 'Valid User Assigned', A: 96.8 },
                { subject: 'Headline Present', A: 87.3 },
                { subject: 'Description Added', A: 82.1 },
                { subject: 'Tags Applied', A: 78.9 },
              ]}>
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
          <thead>
            <tr>
              <th>Metric</th>
              <th style={{ textAlign: 'right' }}>Complete</th>
              <th style={{ textAlign: 'right' }}>Incomplete</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>%</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Valid User Assigned', ok: '46,843', nok: '1,549', tot: '48,392', p: '96.8', color: '#00c864' },
              { name: 'Platform Tagged', ok: '45,732', nok: '2,660', tot: '48,392', p: '94.5', color: '#00c864' },
              { name: 'URL Provided', ok: '43,182', nok: '5,210', tot: '48,392', p: '89.2', color: '#f97316' },
              { name: 'Headline Present', ok: '42,246', nok: '6,146', tot: '48,392', p: '87.3', color: '#f97316' },
              { name: 'Description Added', ok: '39,730', nok: '8,662', tot: '48,392', p: '82.1', color: '#f97316' },
              { name: 'Tags Applied', ok: '38,201', nok: '10,191', tot: '48,392', p: '78.9', color: '#f97316' },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#fff' }}>{row.name}</td>
                <td style={{ textAlign: 'right' }}>{row.ok}</td>
                <td style={{ textAlign: 'right', color: '#ff4d6d' }}>{row.nok}</td>
                <td style={{ textAlign: 'right' }}>{row.tot}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: row.color }}>{row.p}%</td>
                <td>
                  <div className="progress-bg" style={{ width: '150px' }}>
                    <div className="progress-fill" style={{ width: `${row.p}%`, backgroundColor: row.color }}></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPlatformAdoptionVelocity = () => (
    <div className="projects-content">
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card">
          <p className="kpi-label">Total Active Users</p>
          <h2 className="kpi-value">1,743</h2>
          <p className="kpi-sub">cumulative</p>
        </div>
        <div className="projects-kpi-card">
          <p className="kpi-label">Avg Velocity</p>
          <h2 className="kpi-value" style={{ color: '#00c864' }}>17.3%</h2>
          <p className="kpi-sub">growth rate</p>
        </div>
        <div className="projects-kpi-card">
          <p className="kpi-label">Current Velocity</p>
          <h2 className="kpi-value" style={{ color: '#f97316' }}>11.3%</h2>
          <p className="kpi-sub">last month</p>
        </div>
        <div className="projects-kpi-card">
          <p className="kpi-label" style={{ color: '#ff4d6d' }}>New Users (Dec)</p>
          <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>265</h2>
          <p className="kpi-sub">this month</p>
        </div>
      </div>

      <div className="projects-chart-card large">
        <h4>Adoption Velocity Over Time</h4>
        <p className="chart-subtitle">New users, cumulative growth, and velocity percentage</p>
        <div style={{ height: 450 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={[
              { name: 'Jan', newUsers: 80, cumulative: 80, velocity: 12 },
              { name: 'Feb', newUsers: 120, cumulative: 200, velocity: 38 },
              { name: 'Mar', newUsers: 110, cumulative: 310, velocity: 24 },
              { name: 'Apr', newUsers: 130, cumulative: 440, velocity: 18 },
              { name: 'May', newUsers: 150, cumulative: 590, velocity: 15 },
              { name: 'Jun', newUsers: 140, cumulative: 730, velocity: 12 },
              { name: 'Jul', newUsers: 160, cumulative: 890, velocity: 15 },
              { name: 'Aug', newUsers: 180, cumulative: 1070, velocity: 18 },
              { name: 'Sep', newUsers: 170, cumulative: 1240, velocity: 16 },
              { name: 'Oct', newUsers: 190, cumulative: 1430, velocity: 13 },
              { name: 'Nov', newUsers: 210, cumulative: 1640, velocity: 11 },
              { name: 'Dec', newUsers: 265, cumulative: 1905, velocity: 12 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 1800]} />
              <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 40]} />
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
          <h2 className="kpi-value" style={{ fontSize: '64px', color: '#ff4d6d' }}>839</h2>
          <p className="kpi-sub">Assets + Users</p>
          
          <div style={{ marginTop: '40px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#555', fontSize: '13px' }}>Total Assets:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>6,710</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#555', fontSize: '13px' }}>Active Users:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>8</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#555', fontSize: '13px' }}>Power Users:</span>
                <span style={{ color: '#00c864', fontWeight: 700 }}>3</span>
             </div>
          </div>
        </div>
        
        <div className="projects-chart-card">
          <h4>User Intensity Distribution</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Sarah Chen', val: 1245, color: '#00c864' },
                { name: 'Mike Torres', val: 1120, color: '#00c864' },
                { name: 'Emma Wilson', val: 985, color: '#00c864' },
                { name: 'David Kim', val: 820, color: '#ff4d6d' },
                { name: 'Lisa Martinez', val: 745, color: '#ff4d6d' },
                { name: 'James Park', val: 680, color: '#ff4d6d' },
                { name: 'Rachel Green', val: 595, color: '#ff4d6d' },
                { name: 'Tom Anderson', val: 520, color: '#ff4d6d' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 1400]} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                  {[
                    { color: '#00c864' }, { color: '#00c864' }, { color: '#00c864' },
                    { color: '#ff4d6d' }, { color: '#ff4d6d' }, { color: '#ff4d6d' },
                    { color: '#ff4d6d' }, { color: '#ff4d6d' }
                  ].map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
                {/* Platform Avg Line */}
                <line x1="0" y1="120" x2="1000" y2="120" stroke="#f97316" strokeDasharray="5 5" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: '50%', right: '20px', color: '#f97316', fontSize: '11px' }}>--- Platform Avg ---</div>
          </div>
        </div>
      </div>

      <div className="projects-table-section">
        <h4>User Details</h4>
        <table className="projects-summary-table">
          <thead>
            <tr>
              <th>User</th>
              <th style={{ textAlign: 'right' }}>Outputs</th>
              <th style={{ textAlign: 'right' }}>UIS Score</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>vs. Avg</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Sarah Chen', out: '1,245', score: '1,245', cat: 'Power User', catCol: '#00c864', vs: '+48%', vsCol: '#00c864' },
              { name: 'Mike Torres', out: '1,120', score: '1,120', cat: 'Power User', catCol: '#00c864', vs: '+34%', vsCol: '#00c864' },
              { name: 'Emma Wilson', out: '985', score: '985', cat: 'Power User', catCol: '#00c864', vs: '+17%', vsCol: '#00c864' },
              { name: 'David Kim', out: '820', score: '820', cat: 'Regular User', catCol: '#ff4d6d', vs: '-2%', vsCol: '#ff4d6d' },
              { name: 'Lisa Martinez', out: '745', score: '745', cat: 'Regular User', catCol: '#ff4d6d', vs: '-11%', vsCol: '#ff4d6d' },
              { name: 'James Park', out: '680', score: '680', cat: 'Regular User', catCol: '#ff4d6d', vs: '-19%', vsCol: '#ff4d6d' },
              { name: 'Rachel Green', out: '595', score: '595', cat: 'Regular User', catCol: '#ff4d6d', vs: '-29%', vsCol: '#ff4d6d' },
              { name: 'Tom Anderson', out: '520', score: '520', cat: 'Regular User', catCol: '#ff4d6d', vs: '-38%', vsCol: '#ff4d6d' },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#fff' }}>{row.name}</td>
                <td style={{ textAlign: 'right' }}>{row.out}</td>
                <td style={{ textAlign: 'right', color: row.catCol, fontWeight: 700 }}>{row.score}</td>
                <td>
                  <span style={{ color: row.catCol, fontSize: '11px', border: `1px solid ${row.catCol}44`, padding: '2px 8px', borderRadius: '4px' }}>{row.cat}</span>
                </td>
                <td style={{ textAlign: 'right', color: row.vsCol }}>{row.vs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderChannelProductivity = () => (
    <div className="projects-content">
      <div className="projects-chart-card large">
        <h4>Channel Productivity Matrix</h4>
        <p className="chart-subtitle">Active users vs. published videos with productivity index</p>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} horizontal={false} />
              <XAxis type="number" dataKey="users" name="Active Users" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis type="number" dataKey="videos" name="Published Videos" stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 10000]} />
              <ZAxis type="number" dataKey="index" range={[100, 400]} />
              <Tooltip 
                cursor={{ stroke: '#555', strokeDasharray: '3 3', strokeWidth: 1 }} 
                content={<CustomScatterTooltip />}
                wrapperStyle={{ zIndex: 100 }}
              />
              <Scatter name="Channels" data={[
                { users: 62, videos: 6420, index: 103.5, name: 'YouTube Shorts', fill: '#00c864' },
                { users: 85, videos: 8450, index: 99.4, name: 'YouTube Main', fill: '#00c864' },
                { users: 68, videos: 6240, index: 91.8, name: 'TikTok Short', fill: '#00c864' },
                { users: 72, videos: 5840, index: 81.1, name: 'Instagram Reels', fill: '#00c864' },
                { users: 45, videos: 3120, index: 69.3, name: 'Twitter Videos', fill: '#ff4d6d' },
                { users: 58, videos: 3920, index: 67.6, name: 'Instagram Stories', fill: '#ff4d6d' },
                { users: 38, videos: 2450, index: 64.5, name: 'LinkedIn Videos', fill: '#ff4d6d' },
              ]} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="projects-table-section">
        <h4>Channel Details</h4>
        <table className="projects-summary-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th style={{ textAlign: 'right' }}>Active Users</th>
              <th style={{ textAlign: 'right' }}>Published Videos</th>
              <th style={{ textAlign: 'right' }}>Productivity Index</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'YouTube Shorts', users: '62', videos: '6,420', index: '103.5', color: '#00c864' },
              { name: 'YouTube Main', users: '85', videos: '8,450', index: '99.4', color: '#00c864' },
              { name: 'TikTok Short', users: '68', videos: '6,240', index: '91.8', color: '#00c864' },
              { name: 'Instagram Reels', users: '72', videos: '5,840', index: '81.1', color: '#00c864' },
              { name: 'Twitter Videos', users: '45', videos: '3,120', index: '69.3', color: '#ff4d6d' },
              { name: 'Instagram Stories', users: '58', videos: '3,920', index: '67.6', color: '#ff4d6d' },
              { name: 'LinkedIn Videos', users: '38', videos: '2,450', index: '64.5', color: '#ff4d6d' },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#fff' }}>{row.name}</td>
                <td style={{ textAlign: 'right', color: '#00c864' }}>{row.users}</td>
                <td style={{ textAlign: 'right', color: '#ff4d6d' }}>{row.videos}</td>
                <td style={{ textAlign: 'right', color: row.color, fontWeight: 700 }}>{row.index}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderOutputDiversity = () => (
    <div className="projects-content">
      <div className="projects-charts-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="projects-chart-card">
          <p className="kpi-label">DIVERSITY SCORE</p>
          <h2 className="kpi-value" style={{ fontSize: '64px', color: '#ff4d6d' }}>1.03</h2>
          <p className="kpi-sub">Types / Total × 10,000</p>
          
          <div style={{ marginTop: '40px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#555', fontSize: '13px' }}>Unique Types:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>5</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#555', fontSize: '13px' }}>Total Outputs:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>48,392</span>
             </div>
          </div>
        </div>
        
        <div className="projects-chart-card">
          <h4>Output Type Distribution</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Instagram Reels', val: 12850, color: '#ff4d6d' },
                { name: 'TikTok Shorts', val: 11420, color: '#00c864' },
                { name: 'YouTube Chapters', val: 9850, color: '#f97316' },
                { name: 'Video Summaries', val: 7320, color: '#3b82f6' },
                { name: 'Highlight Clips', val: 6952, color: '#ec4899' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 14000]} />
                <Tooltip cursor={{ fill: '#222' }} />
                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                  {[
                    { color: '#ff4d6d' }, { color: '#00c864' }, { color: '#f97316' },
                    { color: '#3b82f6' }, { color: '#ec4899' }
                  ].map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="projects-table-section">
        <h4>Output Type Breakdown</h4>
        <table className="projects-summary-table">
          <thead>
            <tr>
              <th>Output Type</th>
              <th style={{ textAlign: 'right' }}>Count</th>
              <th style={{ textAlign: 'right' }}>Percentage</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {[
              { type: 'Instagram Reels', count: '12,850', p: '26.6', color: '#ff4d6d' },
              { type: 'TikTok Shorts', count: '11,420', p: '23.6', color: '#00c864' },
              { type: 'YouTube Chapters', count: '9,850', p: '20.4', color: '#f97316' },
              { type: 'Video Summaries', count: '7,320', p: '15.1', color: '#3b82f6' },
              { type: 'Highlight Clips', count: '6,952', p: '14.4', color: '#ec4899' },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#fff' }}>{row.type}</td>
                <td style={{ textAlign: 'right', color: row.color, fontWeight: 700 }}>{row.count}</td>
                <td style={{ textAlign: 'right' }}>{row.p}%</td>
                <td>
                  <div className="progress-bg" style={{ width: '150px' }}>
                    <div className="progress-fill" style={{ width: `${row.p}%`, backgroundColor: row.color }}></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContentImpact = () => (
    <div className="projects-content">
      <div className="projects-kpi-grid">
        <div className="projects-kpi-card">
          <p className="kpi-label">Total Impact Score</p>
          <h2 className="kpi-value" style={{ color: '#ff4d6d' }}>6.98M</h2>
          <p className="kpi-sub">Videos × Duration</p>
        </div>
        <div className="projects-kpi-card">
          <p className="kpi-label">Avg Monthly Impact</p>
          <h2 className="kpi-value" style={{ color: '#00c864' }}>582K</h2>
          <p className="kpi-sub">12-month average</p>
        </div>
        <div className="projects-kpi-card">
          <p className="kpi-label">Peak Impact</p>
          <h2 className="kpi-value" style={{ color: '#f97316' }}>826K</h2>
          <p className="kpi-sub">Dec 2026</p>
        </div>
        <div className="projects-kpi-card">
          <p className="kpi-label">Current Trend</p>
          <h2 className="kpi-value" style={{ color: '#00c864' }}>+25.4%</h2>
          <p className="kpi-sub">vs. previous month</p>
        </div>
      </div>

      <div className="projects-chart-card large">
        <h4>Content Impact Over Time</h4>
        <p className="chart-subtitle">Published Videos × Published Duration</p>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[
              { name: 'Jan', val: 404000 }, { name: 'Feb', val: 462000 }, { name: 'Mar', val: 438000 },
              { name: 'Apr', val: 542000 }, { name: 'May', val: 514000 }, { name: 'Jun', val: 625000 },
              { name: 'Jul', val: 590000 }, { name: 'Aug', val: 685000 }, { name: 'Sep', val: 645000 },
              { name: 'Oct', val: 742000 }, { name: 'Nov', val: 710000 }, { name: 'Dec', val: 826000 },
            ]}>
              <defs>
                <linearGradient id="impactGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4d6d" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff4d6d" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="name" stroke="#444" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#444" fontSize={11} tickLine={false} axisLine={false} domain={[0, 1000000]} tickFormatter={(v) => `${v/1000}K`} />
              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
              <Area type="monotone" dataKey="val" stroke="#ff4d6d" strokeWidth={3} fill="url(#impactGradient)" fillOpacity={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="projects-table-section">
        <h4>Monthly Impact Breakdown</h4>
        <table className="projects-summary-table">
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: 'right' }}>Videos</th>
              <th style={{ textAlign: 'right' }}>Avg Duration</th>
              <th style={{ textAlign: 'right' }}>Impact</th>
              <th style={{ textAlign: 'right' }}>vs. Avg</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {[
              { month: 'Jan', v: '3,234', d: '125s', imp: '404K', vs: '-30.5', color: '#ff4d6d', p: 40 },
              { month: 'Feb', v: '3,502', d: '132s', imp: '462K', vs: '-20.5', color: '#ff4d6d', p: 46 },
              { month: 'Mar', v: '3,422', d: '128s', imp: '438K', vs: '-24.7', color: '#ff4d6d', p: 44 },
              { month: 'Apr', v: '3,738', d: '145s', imp: '542K', vs: '-6.8', color: '#ff4d6d', p: 54 },
              { month: 'May', v: '3,725', d: '138s', imp: '514K', vs: '-11.6', color: '#ff4d6d', p: 51 },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ color: '#fff' }}>{row.month}</td>
                <td style={{ textAlign: 'right' }}>{row.v}</td>
                <td style={{ textAlign: 'right', color: '#00c864' }}>{row.d}</td>
                <td style={{ textAlign: 'right', color: '#ff4d6d', fontWeight: 700 }}>{row.imp}</td>
                <td style={{ textAlign: 'right' }}>{row.vs}%</td>
                <td>
                  <div className="progress-bg" style={{ width: '200px' }}>
                    <div className="progress-fill" style={{ width: `${row.p}%`, backgroundColor: row.color }}></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch(activeTab) {
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
      {/* Sub-Sidebar */}
      <aside className="projects-sidebar">
        <div className="projects-sidebar-header">
           <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
           <div className="sidebar-brand mini">
              <div className="logo-box mini">F</div>
              <span style={{ fontSize: '14px' }}>Frammer <span style={{ color: '#ff4d6d' }}>AI</span></span>
           </div>
        </div>
        
        <div className="projects-nav-section">
          <p className="projects-nav-label">DASHBOARDS</p>
          {navItems.map(item => (
            <div 
              key={item.id} 
              className={`projects-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>

         </aside>

      {/* Main Content */}
      <main className="projects-main">
        <header className="projects-header">
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
          </div>
        </header>

        <div className="projects-scroll-area">
          {renderActiveTab()}
        </div>
        
        <div className="help-fab mini">
          <HelpCircle size={20} />
        </div>
      </main>
    </div>
  );
};

export default ProjectsDashboard;
