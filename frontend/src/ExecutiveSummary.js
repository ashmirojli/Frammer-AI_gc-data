import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ReferenceArea, ReferenceLine, Label,
  ComposedChart, Area
} from 'recharts';
import { 
  Activity, Share2, Lightbulb, Search, 
  ChevronDown, ExternalLink, HelpCircle, ArrowLeft,
  Share, Send, User, Bot, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

// --- DATA ---
const platformDistData = [
  { platform: '7', volume: 35, cumulative: 30 },
  { platform: '4', volume: 33, cumulative: 55 },
  { platform: '5', volume: 23, cumulative: 80 },
  { platform: '2', volume: 11, cumulative: 92 },
  { platform: '1', volume: 9, cumulative: 100 },
  { platform: '3', volume: 0, cumulative: 100 },
  { platform: '6', volume: 0, cumulative: 100 },
  { platform: '8', volume: 0, cumulative: 100 },
];

const contentTypeDistData = [
  { type: 'interview', count: 1299 },
  { type: 'news bulletin', count: 1026 },
  { type: 'special reports', count: 755 },
  { type: 'speech', count: 742 },
  { type: 'debate', count: 290 },
  { type: 'press conference', count: 280 },
  { type: 'discussion-show', count: 19 },
  { type: 'sports show', count: 17 },
  { type: 'Unknown', count: 12 },
  { type: 'podcast', count: 8 },
  { type: 'drama', count: 4 },
  { type: 'in-brief', count: 1 },
];

const deliveryLatencyData = [
  { platform: 'Facebook', latency: 2, color: '#ff4d6d88' },
  { platform: 'Linkedin', latency: 4, color: '#c084fc88' },
  { platform: 'Shorts', latency: 12, color: '#2dd4bf88' },
  { platform: 'X', latency: 16, color: '#818cf888' },
  { platform: 'Threads', latency: 3, color: '#f472b688' },
];

const lorenzCurveData = [
  { x: 0, actual: 0, perfect: 0 },
  { x: 20, actual: 0.5, perfect: 20 },
  { x: 40, actual: 1, perfect: 40 },
  { x: 60, actual: 2, perfect: 60 },
  { x: 80, actual: 4, perfect: 80 },
  { x: 90, actual: 20, perfect: 90 },
  { x: 95, actual: 40, perfect: 95 },
  { x: 100, actual: 100, perfect: 100 },
];

// --- DATA ---
const trendData = [
  { month: 'Apr, 2025', uploaded: 535, published: 44 },
  { month: 'Aug, 2025', uploaded: 260, published: 7 },
  { month: 'Dec, 2025', uploaded: 195, published: 7 },
  { month: 'Feb, 2026', uploaded: 675, published: 14 },
  { month: 'Jan, 2026', uploaded: 490, published: 20 },
  { month: 'Jul, 2025', uploaded: 285, published: 0 },
  { month: 'Jun, 2025', uploaded: 240, published: 3 },
  { month: 'Mar, 2025', uploaded: 640, published: 0 },
  { month: 'May, 2025', uploaded: 220, published: 4 },
  { month: 'Nov, 2025', uploaded: 350, published: 2 },
  { month: 'Oct, 2025', uploaded: 340, published: 10 },
  { month: 'Sep, 2025', uploaded: 230, published: 0 },
];

const latencyData = [
  { month: 'Apr, 2025', latency: 1.5 },
  { month: 'Aug, 2025', latency: 0.9 },
  { month: 'Dec, 2025', latency: 2.1 },
  { month: 'Feb, 2026', latency: 4.0 },
  { month: 'Jan, 2026', latency: 4.35 },
  { month: 'Jul, 2025', latency: 3.9 },
  { month: 'Jun, 2025', latency: 2.8 },
  { month: 'Mar, 2025', latency: 0.95 },
  { month: 'May, 2025', latency: 1.1 },
  { month: 'Nov, 2025', latency: 1.5 },
];

const outputMixData = [
  { name: 'Summary', value: 15, color: '#ff4d6d88' },
  { name: 'My Key moments', value: 10, color: '#ff4d6dbb' },
  { name: 'Chapters', value: 25, color: '#ff4d6d' },
  { name: 'Key moments', value: 5, color: '#8b1e33' },
  { name: 'Full package', value: 45, color: '#555' },
];

// --- COMPONENTS ---

const ExecutiveSummaryContent = () => (
  <div className="scrollable-content">
    <div className="content-header">
      <div>
        <h1>Executive Summary</h1>
        <p className="subtitle">Overview of overall content processing and conversion.</p>
      </div>
      <div className="status-badge">
        <ExternalLink size={14} />
        Overall conversion up 4.2% this period
      </div>
    </div>

    <div className="stats-grid">
      <div className="stat-card">
        <p className="label">Total Uploaded</p>
        <h3>4,453</h3>
        <p className="subtext">Videos</p>
      </div>
      <div className="stat-card">
        <p className="label">Total Processed/Created</p>
        <h3>14,916</h3>
        <p className="subtext">Clips</p>
      </div>
      <div className="stat-card">
        <p className="label">Total Published</p>
        <h3>111</h3>
        <p className="subtext">Unique assets</p>
      </div>
      <div className="stat-card">
        <p className="label">Overall Publish Conversion Rate</p>
        <h3>2.49%</h3>
        <p className="subtext">(Published / Uploaded)</p>
      </div>
    </div>

    <div className="charts-row">
      <div className="chart-card">
        <h4>Output Mix Health: <span className="highlight">68.1%</span></h4>
        <div className="mix-chart-container">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={[ { name: 'mix', ...outputMixData.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.value }), {}) } ]} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="custom-tooltip">
                        {payload.map((p, i) => (
                          <p key={i} style={{ color: p.color }}>{`${p.name}: ${p.value}%`}</p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {outputMixData.map((entry, index) => (
                <Bar key={index} dataKey={entry.name} stackId="a" fill={entry.color} radius={index === 0 ? [4, 0, 0, 4] : index === outputMixData.length - 1 ? [0, 4, 4, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="legend-grid">
          {outputMixData.map((d, i) => (
            <div key={i} className="legend-item">
              <span className="dot" style={{ backgroundColor: d.color }}></span>
              {d.name}
            </div>
          ))}
        </div>
        <p className="chart-footer">
          Your output is currently concentrated in Full Packages; consider diversifying into Chapters or Key Moments to boost cross-platform engagement.
        </p>
      </div>

      <div className="chart-card">
        <h4>Input Mix Health: <span className="highlight">72.4%</span></h4>
        <div className="mix-chart-container">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={[ { name: 'mix', a: 20, b: 30, c: 15, d: 25, e: 10 } ]} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <Bar dataKey="a" stackId="a" fill="#ff4d6d" radius={[4, 0, 0, 4]} />
              <Bar dataKey="b" stackId="a" fill="#ff4d6dbb" />
              <Bar dataKey="c" stackId="a" fill="#ff4d6d88" />
              <Bar dataKey="d" stackId="a" fill="#8b1e33" />
              <Bar dataKey="e" stackId="a" fill="#555" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="legend-grid">
          <div className="legend-item"><span className="dot" style={{backgroundColor: '#ff4d6d'}}></span>Debates</div>
          <div className="legend-item"><span className="dot" style={{backgroundColor: '#ff4d6dbb'}}></span>Special Reports</div>
          <div className="legend-item"><span className="dot" style={{backgroundColor: '#ff4d6d88'}}></span>Meetings</div>
          <div className="legend-item"><span className="dot" style={{backgroundColor: '#8b1e33'}}></span>Podcasts</div>
          <div className="legend-item"><span className="dot" style={{backgroundColor: '#555'}}></span>Webinars</div>
        </div>
        <p className="chart-footer">
          You have a balanced content intake, but increasing variety in your Special Reports and Debates could further stabilize your mix.
        </p>
      </div>
    </div>

    <div className="chart-card large">
      <h4>Monthly Trend: Uploaded vs Published</h4>
      <div className="trend-chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="month" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
              itemStyle={{ fontSize: '14px' }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
            <Line type="monotone" dataKey="published" stroke="#ff4d6d" strokeWidth={3} dot={{ fill: '#ff4d6d', r: 6 }} activeDot={{ r: 8 }} />
            <Line type="monotone" dataKey="uploaded" stroke="#ff9eaf" strokeWidth={3} dot={{ fill: '#ff9eaf', r: 6 }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

const PipelineEfficiencyContent = () => (
  <div className="scrollable-content">
    <div className="content-header">
      <div>
        <h1>Pipeline & Efficiency</h1>
        <p className="subtitle">Deep dive into conversion stages, latencies, and output consistency.</p>
      </div>
      <Activity size={24} color="#ff4d6d" />
    </div>

    <div className="pipeline-grid">
      {/* Funnel Card */}
      <div className="pipeline-card">
        <h4>Content Efficiency Funnel (CEI: 0.7%)</h4>
        <div className="funnel-container">
          <div className="funnel-stage top">
            <div className="funnel-bar">Total Created</div>
            <div className="funnel-value">14,916k<br/><span>100%</span></div>
          </div>
          <div className="funnel-connector"></div>
          <div className="funnel-stage bottom">
            <div className="funnel-bar mini">Total Published</div>
            <div className="funnel-value">111<br/><span>1%</span></div>
          </div>
        </div>
      </div>

      {/* Gauge Card */}
      <div className="pipeline-card">
        <h4>Duration Amplification Ratio</h4>
        <div className="gauge-container">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { value: 1.68, color: '#ff4d6d' },
                  { value: 5 - 1.68, color: '#333' }
                ]}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={0}
                dataKey="value"
              >
                <Cell fill="#ff4d6d" />
                <Cell fill="#333" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="gauge-value">1.68</div>
          <div className="gauge-labels">
            <span>0</span>
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
          </div>
        </div>
        <p className="chart-footer centered">
          The <span className="highlight">1.68</span> Duration Amplification Ratio indicates strong engagement, showing that users are spending 68% more time interacting with content than its actual base duration.
        </p>
      </div>

      {/* KPI Chart Card */}
      <div className="pipeline-card">
        <h4>KPI: Monthly Average Publishing Latency</h4>
        <div className="kpi-chart-container">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="month" hide />
              <YAxis domain={[0, 5]} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '4px' }}
                itemStyle={{ color: '#ff4d6d' }}
              />
              <text x="50%" y="20" textAnchor="middle" fill="#fff" fontSize="12">Peak (4.35m)</text>
              <Line type="monotone" dataKey="latency" stroke="#ff4d6d" strokeWidth={3} dot={{ fill: '#ff4d6d', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="kpi-labels">
            <div className="kpi-label">Optimal (~1m)</div>
            <div className="kpi-label">Optimal (~1m)</div>
          </div>
        </div>
      </div>
    </div>

    {/* Production Consistency Analysis Chart */}
    <div className="chart-card large" style={{ marginTop: '24px' }}>
      <h4>Production Consistency Analysis (CV: 1.36)</h4>
      <div className="trend-chart-container">
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="month" stroke="#888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Month', position: 'bottom', fill: '#ff4d6d', dy: 10 }} />
            <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 60]} label={{ value: 'Total Published Count', angle: -90, position: 'insideLeft', fill: '#fff', dx: -10 }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
              itemStyle={{ fontSize: '14px' }}
            />
            <ReferenceArea y1={5} y2={22} fill="#ff4d6d" fillOpacity={0.1}>
              <Label value="Stability Zone" position="insideTopLeft" fill="#888" fontSize={12} offset={10} />
            </ReferenceArea>
            <ReferenceLine y={9.3} stroke="#888" strokeDasharray="5 5">
              <Label value="Average Production" position="right" fill="#888" fontSize={12} dx={10} />
            </ReferenceLine>
            <Line 
              type="monotone" 
              dataKey="published" 
              stroke="#ff4d6d" 
              strokeWidth={3} 
              dot={{ fill: '#ff4d6d', r: 6, strokeWidth: 0, stroke: 'none' }} 
              activeDot={{ r: 8 }} 
              label={({ x, y, value }) => (
                <text x={x} y={y} dy={-15} fill="#fff" fontSize={12} fontWeight="bold" textAnchor="middle">{value}</text>
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="volatility-warning">
        Based on a Coefficient of Variation (CV) of <span className="highlight">1.36</span>, your production data is currently highly volatile and inconsistent, characterized by extreme output surges followed by several months of zero production.
      </div>
    </div>
  </div>
);

const DistributionPlatformHealthContent = () => (
  <div className="scrollable-content">
    <div className="content-header">
      <div>
        <h1>Distribution & Platform Health</h1>
        <p className="subtitle">Analyze platform diversity, delivery latencies, and output destinations.</p>
      </div>
      <Share size={24} color="#ff4d6d" />
    </div>

    <div className="charts-row">
      <div className="chart-card">
        <h4>Platform Distribution Analysis (PDI: 1.48 | Gini: 0.87)</h4>
        <div className="mix-chart-container" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={platformDistData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis dataKey="platform" stroke="#888" fontSize={12} label={{ value: 'Platforms (Ranked by Volume)', position: 'bottom', fill: '#888', dy: 10 }} />
              <YAxis yAxisId="left" stroke="#888" fontSize={12} label={{ value: 'Units Published', angle: -90, position: 'insideLeft', fill: '#888' }} />
              <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={12} label={{ value: 'Cumulative % of Total Reach', angle: 90, position: 'insideRight', fill: '#888' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
              <Legend verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ top: -10 }} />
              <Bar yAxisId="left" dataKey="volume" fill="#ff4d6d" radius={[4, 4, 0, 0]} name="Platform Volume" />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#ff4d6d" strokeDasharray="5 5" dot={{ fill: '#ff4d6d', r: 4 }} name="Cumulative Share %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="volatility-warning">
          This analysis shows extreme volume concentration (Gini: <span className="highlight">0.87</span>), where Platforms 7 and 4 drive almost all results while several others contribute nothing.
        </div>
      </div>

      <div className="chart-card">
        <h4>Gini Concentration Index</h4>
        <div className="gauge-container" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { value: 0.873, color: '#ff4d6d' },
                  { value: 1 - 0.873, color: '#333' }
                ]}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={100}
                outerRadius={140}
                paddingAngle={0}
                dataKey="value"
              >
                <Cell fill="#ff4d6d" />
                <Cell fill="#333" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="gauge-value" style={{ fontSize: '80px', bottom: '40px' }}>0.873</div>
          <div className="gauge-labels" style={{ padding: '0 20px', bottom: '20px' }}>
            <span>0</span>
            <span>0.2</span>
            <span>0.4</span>
            <span>0.6</span>
            <span>0.8</span>
            <span>1</span>
          </div>
        </div>
        <div className="volatility-warning">
          A Gini Index of <span className="highlight">0.873</span> indicates extreme distribution inequality, meaning your platform strategy is highly dependent on a single channel and lacks a balanced omnichannel presence.
        </div>
      </div>
    </div>

    <div className="charts-row">
      <div className="chart-card">
        <h4>Content Type Distribution</h4>
        <div className="trend-chart-container" style={{ height: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={contentTypeDistData} layout="vertical" margin={{ left: 50, right: 30 }}>
              <XAxis type="number" stroke="#888" fontSize={12} />
              <YAxis type="category" dataKey="type" stroke="#fff" fontSize={12} width={100} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }} />
              <Bar dataKey="count" fill="#ff4d6d" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#fff', fontSize: 12, fontWeight: 'bold' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h4>KPI: Delivery Latency by Platform</h4>
        <div className="trend-chart-container" style={{ height: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deliveryLatencyData} margin={{ top: 40, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis dataKey="platform" stroke="#888" fontSize={12} label={{ value: 'Platform_Name', position: 'bottom', fill: '#888', dy: 10 }} />
              <YAxis stroke="#888" fontSize={12} label={{ value: 'Total Seconds in Publishing State', angle: -90, position: 'insideLeft', fill: '#888', dx: -20 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }} />
              <Bar dataKey="latency" radius={[4, 4, 0, 0]}>
                {deliveryLatencyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.platform === 'X' ? '#ff4d6d' : 'none'} strokeWidth={entry.platform === 'X' ? 2 : 0} />
                ))}
              </Bar>
              <ReferenceLine y={0} stroke="#888" />
              <text x="120" y="20" fill="#00c864" fontSize="12" fontWeight="bold">Lowest</text>
              <text x="360" y="20" fill="#ff4d6d" fontSize="12" fontWeight="bold">Highest</text>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    <div className="chart-card large">
      <h4>Channel Distribution Inequality (Gini: 0.87)</h4>
      <div className="trend-chart-container" style={{ height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lorenzCurveData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="x" stroke="#888" fontSize={12} label={{ value: 'Cumulative % of Channels', position: 'bottom', fill: '#888', dy: 10 }} unit="%" />
            <YAxis stroke="#888" fontSize={12} label={{ value: 'Cumulative % of Published Content', angle: -90, position: 'insideLeft', fill: '#888', dx: -10 }} unit="%" />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="custom-tooltip" style={{ backgroundColor: '#111', padding: '12px' }}>
                      <p style={{ color: '#fff' }}>Channels: {payload[0].payload.x}%</p>
                      <p style={{ color: '#ff4d6d' }}>Actual Distribution : {payload[0].payload.actual}%</p>
                      <p style={{ color: '#fff' }}>Perfect Equality : {payload[0].payload.perfect}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ top: -10 }} />
            <Area type="monotone" dataKey="actual" stroke="none" fill="#ff4d6d" fillOpacity={0.1} />
            <Line type="monotone" dataKey="actual" stroke="#ff4d6d" strokeWidth={3} dot={{ fill: '#ff4d6d', r: 4 }} name="Actual Distribution" />
            <Line type="monotone" dataKey="perfect" stroke="#888" strokeDasharray="5 5" dot={{ fill: '#888', r: 4 }} name="Perfect Equality" />
            <ReferenceLine x={80} stroke="#fff" strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

const RecommendationsContent = () => (
  <div className="scrollable-content recommendations-page">
    <div className="content-header">
      <div>
        <h1>Recommendations</h1>
        <p className="subtitle">Chat with your AI assistant for personalized content strategy insights.</p>
      </div>
      <div className="ai-status-icon">
        <Sparkles size={20} color="#ff4d6d" />
      </div>
    </div>

    <div className="chat-container">
      <div className="chat-messages">
        {/* AI Message 1 */}
        <div className="message ai">
          <div className="avatar ai"><Bot size={18} /></div>
          <div className="bubble">
            Hello! I'm your Frammer AI assistant. How can I help you analyze your content strategy today?
          </div>
        </div>

        {/* User Message */}
        <div className="message user">
          <div className="bubble">
            Can you give me recommendations based on my current content mix?
          </div>
          <div className="avatar user"><User size={18} /></div>
        </div>

        {/* AI Message 2 */}
        <div className="message ai">
          <div className="avatar ai"><Bot size={18} /></div>
          <div className="bubble">
            Based on your Executive Summary, your output is currently concentrated in Full Packages (30%). I recommend diversifying into Chapters or Key Moments to boost cross-platform engagement. Would you like me to generate a plan for expanding into Key Moments?
          </div>
        </div>
      </div>

      <div className="chat-input-wrapper">
        <div className="chat-input-box">
          <input type="text" placeholder="Ask for recommendations, insights, or analysis..." />
          <button className="send-btn">
            <Send size={18} />
          </button>
        </div>
        <p className="chat-disclaimer">AI RECOMMENDATIONS ARE GENERATED BASED ON YOUR DASHBOARD METRICS</p>
      </div>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

const ExecutiveSummary = () => {
  const [activeSubPage, setActiveSubPage] = useState('executive');

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-box mini">F</div>
          <span>Frammer AI</span>
        </div>
        
        <div className="sidebar-section">
          <p className="section-label">DASHBOARDS</p>
          <div 
            className={`nav-item ${activeSubPage === 'executive' ? 'active' : ''}`}
            onClick={() => setActiveSubPage('executive')}
          >
            <Activity size={18} />
            <span>Executive Summary</span>
          </div>
          <div 
            className={`nav-item ${activeSubPage === 'pipeline' ? 'active' : ''}`}
            onClick={() => setActiveSubPage('pipeline')}
          >
            <Activity size={18} className="rotate-90" />
            <span>Pipeline & Efficiency</span>
          </div>
          <div 
            className={`nav-item ${activeSubPage === 'distribution' ? 'active' : ''}`}
            onClick={() => setActiveSubPage('distribution')}
          >
            <Share2 size={18} />
            <span>Distribution & Platform Health</span>
          </div>
          <div 
            className={`nav-item ${activeSubPage === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveSubPage('recommendations')}
          >
            <Lightbulb size={18} />
            <span>Recommendations</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
             <Link to="/" className="back-btn-mini">
                <ArrowLeft size={16} />
             </Link>
            <div className="search-bar">
              <Search size={16} />
              <input type="text" placeholder="Search metrics..." />
            </div>
            <div className="time-filters">
              <span>Day</span>
              <span>Week</span>
              <span className="active">Month</span>
              <span>Quarter</span>
            </div>
          </div>
          <div className="header-right">
            <div className="dropdown">Client <ChevronDown size={14} /></div>
            <div className="dropdown">Platform <ChevronDown size={14} /></div>
            <div className="dropdown">User <ChevronDown size={14} /></div>
          </div>
        </header>

        {activeSubPage === 'executive' ? (
          <ExecutiveSummaryContent />
        ) : activeSubPage === 'pipeline' ? (
          <PipelineEfficiencyContent />
        ) : activeSubPage === 'distribution' ? (
          <DistributionPlatformHealthContent />
        ) : (
          <RecommendationsContent />
        )}

        <div className="help-fab">
          <HelpCircle size={24} />
        </div>
      </main>
    </div>
  );
};

export default ExecutiveSummary;
