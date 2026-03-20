import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ReferenceArea, ReferenceLine, Label,
  ComposedChart, Area
} from 'recharts';
import { 
  Activity, Share2, Lightbulb, Search, 
  ChevronDown, ExternalLink, ArrowLeft,
  Share, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

const TAB4_API = 'http://localhost:8000/api/tab4';
const OUTPUT_COLORS = ['#ff4d6d88', '#ff4d6dbb', '#ff4d6d', '#8b1e33', '#555', '#a3a3a3'];
const INPUT_COLORS = ['#ff4d6d', '#ff4d6dbb', '#ff4d6d88', '#8b1e33', '#555', '#a3a3a3'];
const LATENCY_COLORS = ['#ff4d6d88', '#c084fc88', '#2dd4bf88', '#818cf888', '#f472b688', '#fbbf2488', '#34d39988'];

// --- COMPONENTS ---

const ExecutiveSummaryContent = ({ data }) => {
  if (!data) return <div style={{ padding: 40, color: '#888' }}>Loading executive summary...</div>;
  const { summary, kpi3_input_mix, kpi8_output_mix, charts } = data;
  const outputMix = kpi8_output_mix.data;
  const inputMix = kpi3_input_mix.data;
  const trendData = charts.trend;

  const outputBarData = [outputMix.reduce((acc, d) => ({ ...acc, [d.name]: d.value }), { name: 'mix' })];
  const inputBarData = [inputMix.reduce((acc, d) => ({ ...acc, [d.name]: d.published }), { name: 'mix' })];

  return (
    <div className="scrollable-content">
      <div className="content-header">
        <div>
          <h1>Executive Summary</h1>
          <p className="subtitle">Overview of overall content processing and conversion.</p>
        </div>
        <div className="status-badge">
          <ExternalLink size={14} />
          Overall Publish Conversion: {summary.conversion_rate}%
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="label">Total Uploaded</p>
          <h3>{summary.total_uploaded.toLocaleString()}</h3>
          <p className="subtext">Videos</p>
        </div>
        <div className="stat-card">
          <p className="label">Total Processed/Created</p>
          <h3>{summary.total_created.toLocaleString()}</h3>
          <p className="subtext">Clips</p>
        </div>
        <div className="stat-card">
          <p className="label">Total Published</p>
          <h3>{summary.total_published.toLocaleString()}</h3>
          <p className="subtext">Unique assets</p>
        </div>
        <div className="stat-card">
          <p className="label">Overall Publish Conversion Rate</p>
          <h3>{summary.conversion_rate}%</h3>
          <p className="subtext">(Published / Uploaded)</p>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h4>Output Mix Health: <span className="highlight">{kpi8_output_mix.health_pct}%</span></h4>
          <div className="mix-chart-container">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={outputBarData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="custom-tooltip">
                          {payload.map((p, i) => (
                            <p key={i} style={{ color: p.color }}>{`${p.name}: ${p.value}`}</p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {outputMix.map((entry, i) => (
                  <Bar key={i} dataKey={entry.name} stackId="a" fill={OUTPUT_COLORS[i % OUTPUT_COLORS.length]}
                    radius={i === 0 ? [4, 0, 0, 4] : i === outputMix.length - 1 ? [0, 4, 4, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-grid">
            {outputMix.map((d, i) => (
              <div key={i} className="legend-item">
                <span className="dot" style={{ backgroundColor: OUTPUT_COLORS[i % OUTPUT_COLORS.length] }}></span>
                {d.name}
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h4>Input Mix Health: <span className="highlight">{kpi3_input_mix.health_pct}%</span></h4>
          <div className="mix-chart-container">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={inputBarData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="custom-tooltip">
                          {payload.map((p, i) => (
                            <p key={i} style={{ color: p.color }}>{`${p.name}: ${p.value}`}</p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {inputMix.map((entry, i) => (
                  <Bar key={i} dataKey={entry.name} stackId="a" fill={INPUT_COLORS[i % INPUT_COLORS.length]}
                    radius={i === 0 ? [4, 0, 0, 4] : i === inputMix.length - 1 ? [0, 4, 4, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-grid">
            {inputMix.map((d, i) => (
              <div key={i} className="legend-item">
                <span className="dot" style={{ backgroundColor: INPUT_COLORS[i % INPUT_COLORS.length] }}></span>
                {d.name}
              </div>
            ))}
          </div>
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
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} itemStyle={{ fontSize: '14px' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
              <Line type="monotone" dataKey="published" stroke="#ff4d6d" strokeWidth={3} dot={{ fill: '#ff4d6d', r: 6 }} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="uploaded" stroke="#ff9eaf" strokeWidth={3} dot={{ fill: '#ff9eaf', r: 6 }} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const PipelineEfficiencyContent = ({ data }) => {
  if (!data) return <div style={{ padding: 40, color: '#888' }}>Loading pipeline data...</div>;
  const { kpi1_cei, kpi2_duration_amp, kpi6_latency, kpi7_consistency, charts } = data;
  const durAmp = kpi2_duration_amp.value;
  const latencyData = kpi6_latency.monthly;
  const peakLatency = latencyData.length ? Math.max(...latencyData.map(d => d.latency)) : 0;
  const trendData = charts.trend;
  const maxPub = trendData.length ? Math.max(...trendData.map(d => d.published)) : 60;
  const ampPct = Math.round((durAmp - 1) * 100);

  return (
    <div className="scrollable-content">
      <div className="content-header">
        <div>
          <h1>Pipeline & Efficiency</h1>
          <p className="subtitle">Deep dive into conversion stages, latencies, and output consistency.</p>
        </div>
        <Activity size={24} color="#ff4d6d" />
      </div>

      <div className="pipeline-grid">
        <div className="pipeline-card">
          <h4>Content Efficiency Funnel (CEI: {kpi1_cei.cei}%)</h4>
          <div className="funnel-container">
            <div className="funnel-stage top">
              <div className="funnel-bar">Total Created</div>
              <div className="funnel-value">{kpi1_cei.total_created.toLocaleString()}<br/><span>100%</span></div>
            </div>
            <div className="funnel-connector"></div>
            <div className="funnel-stage bottom">
              <div className="funnel-bar mini">Total Published</div>
              <div className="funnel-value">{kpi1_cei.total_published.toLocaleString()}<br/><span>{kpi1_cei.cei}%</span></div>
            </div>
          </div>
        </div>

        <div className="pipeline-card">
          <h4>Duration Amplification Ratio</h4>
          <div className="gauge-container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[{ value: durAmp }, { value: Math.max(0, 5 - durAmp) }]}
                  cx="50%" cy="100%" startAngle={180} endAngle={0}
                  innerRadius={60} outerRadius={80} paddingAngle={0} dataKey="value"
                >
                  <Cell fill="#ff4d6d" />
                  <Cell fill="#333" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="gauge-value">{durAmp}</div>
            <div className="gauge-labels">
              <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
          <p className="chart-footer centered">
            The <span className="highlight">{durAmp}</span> Duration Amplification Ratio indicates {durAmp >= 1 ? 'strong engagement' : 'content is being condensed'}, showing that users are spending {ampPct > 0 ? `${ampPct}% more` : `${Math.abs(ampPct)}% less`} time interacting with content than its actual base duration.
          </p>
        </div>

        <div className="pipeline-card">
          <h4>KPI: Monthly Average Publishing Latency</h4>
          <div className="kpi-chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="month" hide />
                <YAxis domain={[0, Math.ceil(peakLatency + 1)]} hide />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '4px' }} itemStyle={{ color: '#ff4d6d' }} />
                <text x="50%" y="20" textAnchor="middle" fill="#fff" fontSize="12">Peak ({peakLatency.toFixed(2)}m)</text>
                <Line type="monotone" dataKey="latency" stroke="#ff4d6d" strokeWidth={3} dot={{ fill: '#ff4d6d', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="kpi-labels">
              <div className="kpi-label">Avg: {kpi6_latency.avg_latency_min}m</div>
              <div className="kpi-label">Peak: {peakLatency.toFixed(1)}m</div>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-card large" style={{ marginTop: '24px' }}>
        <h4>Production Consistency Analysis (CV: {kpi7_consistency.cv})</h4>
        <div className="trend-chart-container">
          <ResponsiveContainer width="100%" height={450}>
            <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis dataKey="month" stroke="#888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Month', position: 'bottom', fill: '#ff4d6d', dy: 10 }} />
              <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} domain={[0, Math.ceil(maxPub * 1.4)]} label={{ value: 'Total Published Count', angle: -90, position: 'insideLeft', fill: '#fff', dx: -10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} itemStyle={{ fontSize: '14px' }} />
              <ReferenceArea y1={kpi7_consistency.stability_y1} y2={kpi7_consistency.stability_y2} fill="#ff4d6d" fillOpacity={0.1}>
                <Label value="Stability Zone" position="insideTopLeft" fill="#888" fontSize={12} offset={10} />
              </ReferenceArea>
              <ReferenceLine y={kpi7_consistency.mean} stroke="#888" strokeDasharray="5 5">
                <Label value="Average Production" position="right" fill="#888" fontSize={12} dx={10} />
              </ReferenceLine>
              <Line type="monotone" dataKey="published" stroke="#ff4d6d" strokeWidth={3}
                dot={{ fill: '#ff4d6d', r: 6, strokeWidth: 0, stroke: 'none' }} activeDot={{ r: 8 }}
                label={({ x, y, value }) => (
                  <text x={x} y={y} dy={-15} fill="#fff" fontSize={12} fontWeight="bold" textAnchor="middle">{value}</text>
                )}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="volatility-warning">
          Based on a Coefficient of Variation (CV) of <span className="highlight">{kpi7_consistency.cv}</span>, your production data is currently {kpi7_consistency.cv > 1 ? 'highly volatile and inconsistent' : 'relatively stable'}.
        </div>
      </div>
    </div>
  );
};

const DistributionPlatformHealthContent = ({ data }) => {
  if (!data) return <div style={{ padding: 40, color: '#888' }}>Loading distribution data...</div>;
  const { kpi4_pdi, kpi5_gini, kpi6_latency, charts } = data;
  const platformDist = kpi4_pdi.platform_dist;
  const lorenzData = kpi5_gini.lorenz;
  const contentTypeDist = charts.content_type_dist;
  const deliveryLat = kpi6_latency.by_platform;

  return (
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
          <h4>Platform Distribution Analysis (PDI: {kpi4_pdi.pdi} | Gini: {kpi5_gini.gini})</h4>
          <div className="mix-chart-container" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={platformDist} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
            This analysis shows {kpi5_gini.gini > 0.7 ? 'extreme' : kpi5_gini.gini > 0.4 ? 'moderate' : 'low'} volume concentration (Gini: <span className="highlight">{kpi5_gini.gini}</span>).
          </div>
        </div>

        <div className="chart-card">
          <h4>Gini Concentration Index</h4>
          <div className="gauge-container" style={{ height: '300px', paddingTop: '44px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: kpi5_gini.gini }, { value: Math.max(0, 1 - kpi5_gini.gini) }]}
                  cx="50%" cy="100%" startAngle={180} endAngle={0}
                  innerRadius={100} outerRadius={140} paddingAngle={0} dataKey="value"
                >
                  <Cell fill="#ff4d6d" />
                  <Cell fill="#333" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="gauge-value" style={{ fontSize: '72px', top: '8px' }}>{kpi5_gini.gini}</div>
            <div className="gauge-labels" style={{ padding: '0 20px', bottom: '20px' }}>
              <span>0</span><span>0.2</span><span>0.4</span><span>0.6</span><span>0.8</span><span>1</span>
            </div>
          </div>
          <div className="volatility-warning">
            A Gini Index of <span className="highlight">{kpi5_gini.gini}</span> indicates {kpi5_gini.gini > 0.7 ? 'extreme distribution inequality' : kpi5_gini.gini > 0.4 ? 'moderate inequality' : 'relatively balanced distribution'}.
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h4>Content Type Distribution</h4>
          <div className="trend-chart-container" style={{ height: '500px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contentTypeDist} layout="vertical" margin={{ left: 50, right: 30 }}>
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
              <BarChart data={deliveryLat} margin={{ top: 40, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="platform" stroke="#888" fontSize={12} label={{ value: 'Platform', position: 'bottom', fill: '#888', dy: 10 }} />
                <YAxis stroke="#888" fontSize={12} label={{ value: 'Avg Seconds in Publishing State', angle: -90, position: 'insideLeft', fill: '#888', dx: -20 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }} />
                <Bar dataKey="latency" radius={[4, 4, 0, 0]}>
                  {deliveryLat.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={LATENCY_COLORS[i % LATENCY_COLORS.length]} />
                  ))}
                </Bar>
                <ReferenceLine y={0} stroke="#888" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="chart-card large">
        <h4>Channel Distribution Inequality (Gini: {kpi5_gini.gini})</h4>
        <div className="trend-chart-container" style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lorenzData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="x" stroke="#888" fontSize={12} label={{ value: 'Cumulative % of Channels', position: 'bottom', fill: '#888', dy: 10 }} unit="%" />
              <YAxis stroke="#888" fontSize={12} label={{ value: 'Cumulative % of Published Content', angle: -90, position: 'insideLeft', fill: '#888', dx: -10 }} unit="%" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="custom-tooltip" style={{ backgroundColor: '#111', padding: '12px' }}>
                        <p style={{ color: '#fff' }}>Channels: {payload[0].payload.x}%</p>
                        <p style={{ color: '#ff4d6d' }}>Actual Distribution: {payload[0].payload.actual}%</p>
                        <p style={{ color: '#fff' }}>Perfect Equality: {payload[0].payload.perfect}%</p>
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const REC_API = 'http://localhost:8000/api/recommend';

const RecommendationsContent = () => {
  const [inputType, setInputType] = useState(1);
  const [duration, setDuration] = useState(60);
  const [platform, setPlatform] = useState(1);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [contextMeta, setContextMeta] = useState({ input_types: [], platforms: [], output_types: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${REC_API}/context`)
      .then(r => r.json())
      .then(data => setContextMeta(data))
      .catch(() => {});
  }, []);

  const generateRecommendations = async () => {
    setLoading(true);
    setRecommendations([]);
    setError('');
    try {
      const res = await fetch(`${REC_API}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputtype_id: inputType,
          duration_sec: duration * 60,
          platform_id: platform,
        }),
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch {
      setError('Failed to connect to backend. Is the Python server running?');
    }
    setLoading(false);
  };

  const publishAction = async (rec, btnRef) => {
    if (btnRef) {
      btnRef.textContent = 'Learning... 🧠';
      btnRef.classList.add('learning');
      btnRef.disabled = true;
    }
    try {
      await fetch(`${REC_API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputtype_id: inputType,
          duration_sec: duration * 60,
          platform_id: platform,
          action: rec.output_type_id,
          reward: 5.0,
          probability: rec.probability,
        }),
      });
      await generateRecommendations();
    } catch {
      if (btnRef) {
        btnRef.textContent = 'Publish! 🚀';
        btnRef.classList.remove('learning');
        btnRef.disabled = false;
      }
    }
  };

  return (
    <div className="scrollable-content recommendations-page">
      <div className="content-header">
        <div>
          <h1>Recommendation Simulator</h1>
          <p className="subtitle">Real-Time Telemetry & Personalization — VW-Bandit</p>
        </div>
        <div className="ai-status-icon">
          <Sparkles size={20} color="#ff4d6d" />
        </div>
      </div>

      <div className="rec-simulator">
        {/* Left: Controls */}
        <section className="rec-controls">
          <h2 className="rec-section-title">1. Input Your Video</h2>

          <div className="rec-form-group">
            <label className="rec-label">Input Type</label>
            <select
              className="rec-select"
              value={inputType}
              onChange={e => setInputType(+e.target.value)}
            >
              {contextMeta.input_types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              {contextMeta.input_types.length === 0 && (
                <>
                  <option value={1}>Webinar</option>
                  <option value={2}>Podcast</option>
                  <option value={3}>Interview</option>
                  <option value={4}>Roundtable</option>
                  <option value={5}>Presentation</option>
                  <option value={6}>News Bulletin</option>
                </>
              )}
            </select>
          </div>

          <div className="rec-form-group">
            <label className="rec-label">
              Raw Duration (Minutes): <span className="rec-dur-val">{duration}m</span>
            </label>
            <input
              type="range"
              className="rec-range"
              min="1"
              max="180"
              value={duration}
              onChange={e => setDuration(+e.target.value)}
            />
          </div>

          <div className="rec-form-group">
            <label className="rec-label">Target Platform</label>
            <select
              className="rec-select"
              value={platform}
              onChange={e => setPlatform(+e.target.value)}
            >
              {contextMeta.platforms.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {contextMeta.platforms.length === 0 && (
                <>
                  <option value={1}>YouTube</option>
                  <option value={2}>LinkedIn</option>
                  <option value={3}>Twitter</option>
                  <option value={4}>TikTok</option>
                  <option value={5}>Instagram</option>
                </>
              )}
            </select>
          </div>

          <button
            className="rec-generate-btn"
            onClick={generateRecommendations}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Strategy'}
          </button>
        </section>

        {/* Right: Results */}
        <section className="rec-results">
          <div className="rec-results-header">
            <h2 className="rec-section-title">2. Choose Your Output Strategy</h2>
            {loading && <div className="rec-spinner" />}
          </div>

          <p className="rec-instruction">
            The Global Model recommends the following.{' '}
            <strong>Click Publish to train the Bandit!</strong>
          </p>

          <div className="rec-recs-list">
            {recommendations.length === 0 && !loading && !error && (
              <div className="rec-empty-state">Waiting for input...</div>
            )}
            {loading && recommendations.length === 0 && (
              <div className="rec-empty-state">Calculating AI strategy...</div>
            )}
            {error && (
              <div className="rec-empty-state rec-error">{error}</div>
            )}
            {recommendations.map((rec, i) => {
              const pct = (rec.probability * 100).toFixed(1);
              const isTop = i === 0;
              return (
                <div
                  key={rec.output_type_id}
                  className={`rec-sim-card ${isTop ? 'top-choice' : ''}`}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="rec-sim-info">
                    <div className={`rec-sim-name ${isTop ? 'highlight' : ''}`}>
                      {isTop && '✨ '}{rec.output_type_name}
                    </div>
                    <div className="rec-prob-bar-container">
                      <div className="rec-prob-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="rec-prob-text">Win Probability: {pct}%</div>
                  </div>
                  <button
                    className="rec-publish-btn"
                    onClick={e => publishAction(rec, e.currentTarget)}
                  >
                    Publish! 🚀
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const ExecutiveSummary = () => {
  const [activeSubPage, setActiveSubPage] = useState('executive');
  const [kpiData, setKpiData] = useState(null);

  useEffect(() => {
    fetch(`${TAB4_API}/kpis`)
      .then(r => r.json())
      .then(data => setKpiData(data))
      .catch(() => {});
  }, []);

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
          <span style={{ fontSize: '20px', fontWeight: '900', color: '#ff4d6d' }}>FRAMMER AI</span>
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
        {/* <header className="dashboard-header">
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
            <div className="dropdown">Client <ChevronDown size={14} /></div> */}
            {/* <div className="dropdown">Platform <ChevronDown size={14} /></div>
            <div className="dropdown">User <ChevronDown size={14} /></div>
          </div>
        </header> */}

        {activeSubPage === 'executive' ? (
          <ExecutiveSummaryContent data={kpiData} />
        ) : activeSubPage === 'pipeline' ? (
          <PipelineEfficiencyContent data={kpiData} />
        ) : activeSubPage === 'distribution' ? (
          <DistributionPlatformHealthContent data={kpiData} />
        ) : (
          <RecommendationsContent />
        )}

      </main>
    </div>
  );
};

export default ExecutiveSummary;
