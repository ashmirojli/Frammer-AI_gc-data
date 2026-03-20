import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Star, Activity, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';

const API = 'http://localhost:8000/api/anomaly';

const fmtNum = (n) => (n == null ? '0' : Number(n).toLocaleString());

const fmtDuration = (secs) => {
  if (!secs || secs <= 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const ICON_MAP = {
  star:       <Star size={14} fill="#facc15" stroke="#facc15" />,
  dot_green:  <span className="mdx-alert-dot" style={{ backgroundColor: '#00c864' }} />,
  dot_red:    <span className="mdx-alert-dot" style={{ backgroundColor: '#ff4d6d' }} />,
  dot_yellow: <span className="mdx-alert-dot" style={{ backgroundColor: '#facc15' }} />,
  chart:      <Activity size={14} color="#3b82f6" />,
  chart_down: <TrendingDown size={14} color="#ff4d6d" />,
};

const MultidimensionAnomaly = () => {
  const [dim1, setDim1] = useState('channel');
  const [dim2, setDim2] = useState('user');
  const [metricType, setMetricType] = useState('count');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [matrixData, setMatrixData] = useState(null);
  const [clusters, setClusters] = useState(null);
  const [dimensions, setDimensions] = useState([]);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);
  const [breakdown1, setBreakdown1] = useState(null);
  const [breakdown2, setBreakdown2] = useState(null);

  const fetchMatrix = useCallback(async () => {
    try {
      const res = await fetch(`${API}/matrix?dim1=${dim1}&dim2=${dim2}&metric=${metricType}`);
      const data = await res.json();
      setMatrixData(data);
    } catch (e) {
      console.error('Failed to load matrix:', e);
    }
  }, [dim1, dim2, metricType]);

  const fetchBreakdowns = useCallback(async () => {
    try {
      const [b1, b2] = await Promise.all([
        fetch(`${API}/breakdown?dim=${dim1}`).then(r => r.json()),
        fetch(`${API}/breakdown?dim=${dim2}`).then(r => r.json()),
      ]);
      setBreakdown1(b1);
      setBreakdown2(b2);
    } catch (e) {
      console.error('Failed to load breakdowns:', e);
    }
  }, [dim1, dim2]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [dimRes, kpiRes, clusterRes] = await Promise.all([
          fetch(`${API}/dimensions`).then(r => r.json()),
          fetch(`${API}/kpis`).then(r => r.json()),
          fetch(`${API}/clusters`).then(r => r.json()),
        ]);
        setDimensions(dimRes.dimensions || []);
        setKpis(kpiRes);
        setClusters(clusterRes);
      } catch (e) {
        console.error('Failed to load initial data:', e);
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    fetchMatrix();
    fetchBreakdowns();
  }, [fetchMatrix, fetchBreakdowns]);

  if (loading) {
    return (
      <div className="mdx-loading">
        <div className="mdx-spinner" />
        <p>Loading Frammer Analytics Data...</p>
      </div>
    );
  }

  const dimLabel = (key) => {
    const d = dimensions.find(dd => dd.key === key);
    return d ? d.label : key;
  };

  const alerts = matrixData?.alerts || [];
  const anomalies = matrixData?.anomalies || {};
  const highAlerts = alerts.filter(a => a.severity >= 3);
  const lowAlerts = alerts.filter(a => a.severity < 3);
  const isUnsupported = matrixData?.unsupported;

  return (
    <div className="analytics-content mdx-root">
      {/* Header */}
      <div className="mdx-header">
        <div>
          <h1 className="mdx-title">FRAMMER AI</h1>
        </div>
        <div className="mdx-header-right">
          <div className="mdx-header-label">Total Users</div>
          <div className="mdx-header-val">{fmtNum(kpis?.total_users)}</div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mdx-breadcrumb">
        <span className="mdx-crumb-link">All Data</span>
        <span className="mdx-crumb-sep">&rsaquo;</span>
        <span className="mdx-crumb-current">{dimLabel(dim1)} &times; {dimLabel(dim2)}</span>
      </div>

      {/* Controls */}
      <div className="mdx-controls">
        <div className="mdx-ctrl-group">
          <label>DIMENSION 1 (ROWS)</label>
          <select value={dim1} onChange={e => setDim1(e.target.value)}>
            {dimensions.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <div className="mdx-ctrl-group">
          <label>DIMENSION 2 (COLUMNS)</label>
          <select value={dim2} onChange={e => setDim2(e.target.value)}>
            {dimensions.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <div className="mdx-ctrl-sep" />
        <div className="mdx-ctrl-group">
          <label>VALUE</label>
          <div className="mdx-metric-toggle">
            {['count', 'duration', 'conversion'].map(m => (
              <button key={m} className={metricType === m ? 'active' : ''} onClick={() => setMetricType(m)}>
                {m === 'count' ? 'Count' : m === 'duration' ? 'Duration' : 'Conversion %'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="mdx-kpi-row">
          <div className="mdx-kpi-card">
            <p className="mdx-kpi-label">Total Uploaded</p>
            <h2 className="mdx-kpi-value">{fmtNum(kpis.total_uploaded)}</h2>
            <p className="mdx-kpi-sub">{kpis.upload_duration} total duration</p>
          </div>
          <div className="mdx-kpi-card">
            <p className="mdx-kpi-label">Total Created</p>
            <h2 className="mdx-kpi-value">{fmtNum(kpis.total_created)}</h2>
            <p className="mdx-kpi-sub">{kpis.created_duration} processing time</p>
          </div>
          <div className="mdx-kpi-card mdx-kpi-white">
            <p className="mdx-kpi-label">Total Published</p>
            <h2 className="mdx-kpi-value">{fmtNum(kpis.total_published)}</h2>
            <p className="mdx-kpi-sub">{kpis.published_duration} published duration</p>
          </div>
          <div className="mdx-kpi-card mdx-kpi-orange">
            <p className="mdx-kpi-label">Publish Conversion</p>
            <h2 className="mdx-kpi-value">{kpis.conversion_rate}%</h2>
            <p className="mdx-kpi-sub">Published / Created ratio</p>
          </div>
        </div>
      )}

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className={`mdx-alerts ${alertsCollapsed ? 'collapsed' : ''}`}>
          <div className="mdx-alerts-header">
            <div className="mdx-alerts-title">
              <Bell size={18} color="#facc15" fill="#facc15" />
              <strong>Anomaly Detection</strong>
              <span className="mdx-alerts-count">{alerts.length} anomalies detected</span>
            </div>
            <button className="mdx-alerts-toggle" onClick={() => setAlertsCollapsed(!alertsCollapsed)}>
              {alertsCollapsed ? <>Expand <ChevronDown size={12} /></> : <>Collapse <ChevronUp size={12} /></>}
            </button>
          </div>
          {!alertsCollapsed && (
            <div className="mdx-alerts-body">
              {highAlerts.length > 0 && (
                <div className="mdx-alerts-group">
                  <p className="mdx-alerts-group-label">HIGH PRIORITY</p>
                  {highAlerts.slice(0, 8).map((a, i) => {
                    const cls = a.type.includes('low') ? 'negative' : 'positive';
                    return (
                      <div key={i} className={`mdx-alert-item ${cls}`}>
                        {ICON_MAP[a.icon] || null}
                        <span>{a.message}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {lowAlerts.length > 0 && (
                <div className="mdx-alerts-group">
                  <p className="mdx-alerts-group-label">OBSERVATIONS</p>
                  {lowAlerts.slice(0, 6).map((a, i) => (
                    <div key={i} className="mdx-alert-item neutral">
                      {ICON_MAP[a.icon] || null}
                      <span>{a.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Matrix */}
      {isUnsupported ? (
        <div className="mdx-matrix-section" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>Cross-tabulation not available for this dimension pair.</p>
          <p style={{ fontSize: 12, color: '#555' }}>{matrixData?.source_tag}</p>
        </div>
      ) : matrixData ? (
        <MatrixTable
          data={matrixData}
          anomalies={anomalies}
          dim1Label={dimLabel(dim1)}
          dim2Label={dimLabel(dim2)}
          metricType={metricType}
        />
      ) : null}

      {/* Breakdowns */}
      <div className="mdx-breakdown-grid">
        {breakdown1 && <BreakdownCard title={`${dimLabel(dim1)} Breakdown`} items={breakdown1.items} />}
        {breakdown2 && <BreakdownCard title={`${dimLabel(dim2)} Breakdown`} items={breakdown2.items} />}
      </div>

      {/* ML Insights */}
      {clusters && <MLInsights data={clusters} />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Matrix Table
// ═══════════════════════════════════════════════════════════════════════════════

const MatrixTable = ({ data, anomalies, dim1Label, dim2Label, metricType }) => {
  const {
    matrix, row_ids, col_ids, row_totals, col_totals, grand_total,
    max_count, max_duration, max_conversion, source_tag, dim_names,
  } = data;
  const anomalyCount = Object.keys(anomalies).length;
  const names = dim_names || {};

  const getMax = () => {
    if (metricType === 'duration') return max_duration || 0;
    if (metricType === 'conversion') return max_conversion || 0;
    return max_count || 0;
  };

  const getCellValue = (cell) => {
    if (!cell) return 0;
    if (metricType === 'duration') return cell.duration || 0;
    if (metricType === 'conversion') return cell.conversion || 0;
    return cell.count || 0;
  };

  const formatValue = (val) => {
    if (val == null) return '—';
    if (metricType === 'duration') return val > 0 ? fmtDuration(val) : '—';
    if (metricType === 'conversion') return val > 0 ? `${val}%` : '—';
    return val > 0 ? fmtNum(val) : '—';
  };

  const maxVal = getMax();

  const heatLevel = (val) => {
    if (!val || !maxVal) return 0;
    return Math.round((val / maxVal) * 10);
  };

  const rowName = (rid) => names[`row_${rid}`] || String(rid);
  const colName = (cid) => names[`col_${cid}`] || String(cid);

  return (
    <div className="mdx-matrix-section">
      <div className="mdx-matrix-header">
        <h4>{dim1Label} &times; {dim2Label} Matrix</h4>
        <div className="mdx-matrix-badges">
          {anomalyCount > 0 && (
            <span className="mdx-anomaly-badge">
              <Bell size={10} fill="#facc15" /> {anomalyCount} anomalies
            </span>
          )}
          <span className="mdx-source-tag">{source_tag} &middot; {row_ids.length} &times; {col_ids.length}</span>
        </div>
      </div>
      <div className="mdx-matrix-wrapper">
        <table className="mdx-matrix-table">
          <thead>
            <tr>
              <th className="mdx-sticky-col">{dim1Label} ↓ / {dim2Label} →</th>
              {col_ids.map(cid => <th key={cid}>{colName(cid)}</th>)}
              <th className="mdx-total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {row_ids.map(rid => (
              <tr key={rid}>
                <td className="mdx-sticky-col">{rowName(rid)}</td>
                {col_ids.map(cid => {
                  const cell = matrix?.[String(rid)]?.[String(cid)] || {};
                  const val = getCellValue(cell);
                  const heat = heatLevel(val);
                  const aKey = `${rid}_${cid}`;
                  const anomaly = anomalies[aKey];
                  let anomalyClass = '';
                  let anomalyIcon = null;
                  if (anomaly) {
                    anomalyClass = ` mdx-anomaly-${anomaly.type}`;
                    anomalyIcon = anomaly.icon === 'star'
                      ? <Star size={9} fill="#facc15" stroke="#facc15" />
                      : anomaly.icon === 'dot_green'
                        ? <span className="mdx-cell-dot" style={{ backgroundColor: '#00c864' }} />
                        : anomaly.icon === 'dot_red'
                          ? <span className="mdx-cell-dot" style={{ backgroundColor: '#ff4d6d' }} />
                          : <span className="mdx-cell-dot" style={{ backgroundColor: '#facc15' }} />;
                  }
                  return (
                    <td key={cid} className={`mdx-heat-cell mdx-heat-${heat}${anomalyClass}`}
                        title={`${rowName(rid)} × ${colName(cid)}: ${formatValue(val)}`}>
                      {anomalyIcon}{formatValue(val)}
                    </td>
                  );
                })}
                <td className="mdx-total-col">{formatValue(getCellValue(row_totals?.[String(rid)]))}</td>
              </tr>
            ))}
            <tr className="mdx-total-row">
              <td className="mdx-sticky-col"><strong>Total</strong></td>
              {col_ids.map(cid => (
                <td key={cid}>{formatValue(getCellValue(col_totals?.[String(cid)]))}</td>
              ))}
              <td className="mdx-total-col"><strong>{formatValue(getCellValue(grand_total))}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Breakdown Card
// ═══════════════════════════════════════════════════════════════════════════════

const BreakdownCard = ({ title, items }) => {
  if (!items || items.length === 0) return null;
  const maxCount = items[0]?.uploaded || items[0]?.count || 1;

  return (
    <div className="mdx-breakdown-card">
      <div className="mdx-breakdown-header">
        <h4>{title}</h4>
        <span className="mdx-breakdown-count">{items.length} items</span>
      </div>
      <div className="mdx-breakdown-body">
        <table className="mdx-breakdown-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="r">Uploaded</th>
              <th className="r">Created</th>
              <th className="r">Published</th>
              <th className="r">Conv%</th>
              <th>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 25).map((item, i) => {
              const barW = Math.max(2, ((item.uploaded || 0) / maxCount) * 100);
              const convCls = item.conversion >= 5 ? 'high' : item.conversion >= 1 ? 'medium' : 'low';
              return (
                <tr key={i}>
                  <td className="mdx-name-col">{item.name}</td>
                  <td className="r mono">{fmtNum(item.uploaded)}</td>
                  <td className="r mono">{fmtNum(item.created)}</td>
                  <td className="r mono">{fmtNum(item.published)}</td>
                  <td className="r"><span className={`mdx-conv-badge ${convCls}`}>{item.conversion}%</span></td>
                  <td className="mdx-bar-cell"><div className="mdx-micro-bar" style={{ width: `${barW}%` }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ML Insights
// ═══════════════════════════════════════════════════════════════════════════════

const MLInsights = ({ data }) => {
  const { clusters, user_assignments, summary } = data;
  if (!clusters || !summary) return null;

  const sortedClusters = Object.values(clusters).sort((a, b) => {
    if (a.is_noise) return 1;
    if (b.is_noise) return -1;
    return b.avg_uploaded - a.avg_uploaded;
  });

  const clusterColors = ['#ffffff', '#a3a3a3', '#737373', '#555555'];

  return (
    <div className="mdx-ml-section">
      <div className="mdx-ml-header">
        <span className="mdx-ml-icon">&#129504;</span>
        <div>
          <h3>ML-Powered Insights</h3>
          <p>scikit-learn Backend</p>
        </div>
      </div>

      <div className="mdx-ml-summary">
        <div className="mdx-ml-summary-card">
          <label>MODEL</label>
          <div className="val">DBSCAN</div>
          <p className="sub">eps={summary.parameters?.eps}, min_samples={summary.parameters?.min_samples}</p>
        </div>
        <div className="mdx-ml-summary-card">
          <label>USERS ANALYZED</label>
          <div className="val">{summary.total_users}</div>
          <p className="sub">From Fact_User_Summary</p>
        </div>
        <div className="mdx-ml-summary-card">
          <label>CLUSTERS FOUND</label>
          <div className="val">{summary.user_clusters}</div>
          <p className="sub">Natural behavior groups</p>
        </div>
        <div className="mdx-ml-summary-card outlier">
          <label>BEHAVIORAL OUTLIERS</label>
          <div className="val">{summary.user_outliers}</div>
          <p className="sub">Don't fit any cluster</p>
        </div>
      </div>

      <div className="mdx-ml-explanation">
        <span style={{ color: '#ff4d6d' }}>How it works:</span> DBSCAN groups users by measuring <strong>density</strong> in feature space. Users close together (similar upload/create/publish patterns) form clusters. Users in sparse regions — with unique behavior patterns — are labeled as outliers. Unlike K-means, DBSCAN doesn't need a pre-set number of clusters.
      </div>

      <div className="mdx-cluster-grid">
        {sortedClusters.map((c, i) => {
          const color = c.is_noise ? '#ff4d6d' : (clusterColors[i % clusterColors.length]);
          const members = (user_assignments || []).filter(u => u.cluster_id === c.id);
          return (
            <div key={c.id} className={`mdx-cluster-card ${c.is_noise ? 'outlier' : ''}`} style={{ borderLeftColor: color }}>
              <div className="mdx-cluster-card-header">
                <span style={{ fontWeight: 700, color }}>{c.label}</span>
                <span className="mdx-cluster-size">{c.size} users</span>
              </div>
              <div className="mdx-cluster-stats">
                <div className="mdx-cluster-stat">
                  <label>AVG UPLOADED</label>
                  <div className="val">{fmtNum(Math.round(c.avg_uploaded))}</div>
                </div>
                <div className="mdx-cluster-stat">
                  <label>AVG CREATED</label>
                  <div className="val">{fmtNum(Math.round(c.avg_created))}</div>
                </div>
                <div className="mdx-cluster-stat">
                  <label>AVG PUBLISHED</label>
                  <div className="val">{fmtNum(Math.round(c.avg_published))}</div>
                </div>
                <div className="mdx-cluster-stat">
                  <label>AVG CONV%</label>
                  <div className="val">{c.avg_conversion}%</div>
                </div>
              </div>
              <div className="mdx-cluster-members">
                {members.slice(0, 8).map((m, j) => (
                  <span key={j} className="mdx-member-tag" style={{ borderColor: `${color}40`, color }}>
                    {m.user_name}
                  </span>
                ))}
                {members.length > 8 && <span className="mdx-member-more">+{members.length - 8} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultidimensionAnomaly;
