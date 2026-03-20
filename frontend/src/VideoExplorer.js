import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, ChevronDown, Download, ChevronLeft, ChevronRight,
  BarChart2, Lightbulb, Search as InspectIcon,
  Video, CheckCircle, Users, Layout, Share2, ExternalLink, Copy, ArrowLeft, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from 'recharts';

const TAB5_API = 'http://localhost:8000/api/tab5';
const PLAT_COLORS = ['#8b0000', '#ff4d6d', '#ff4d6dbb', '#ff4d6d88', '#ff4d6d55'];

const ALL_COLUMNS = [
  { id: 'Video_ID', label: 'Video ID' },
  { id: 'Headline', label: 'Headline' },
  { id: 'Type', label: 'Type' },
  { id: 'Published', label: 'Status' },
  { id: 'User_Name', label: 'User' },
  { id: 'Team_Name', label: 'Team' },
];

function buildQS(f) {
  const p = new URLSearchParams();
  if (f.search) p.set('search', f.search);
  if (f.published !== 'All') p.set('published', f.published);
  if (f.outputType !== 'All') p.append('types', f.outputType);
  if (f.team !== 'All') p.append('teams', f.team);
  if (f.user !== 'All') p.append('users', f.user);
  if (f.platform !== 'All') p.append('platforms', f.platform);
  return p;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

const CustomDropdown = ({ options, currentSelection, onSelect, isOpen, onToggle }) => (
  <div className={`custom-dropdown-container ${isOpen ? 'open' : ''}`}>
    <div className="sidebar-dropdown" onClick={onToggle}>
      {currentSelection} <ChevronDown size={14} />
    </div>
    {isOpen && (
      <div className="dropdown-menu">
        {options.map(opt => (
          <div
            key={opt}
            className={`dropdown-item ${opt === 'All' ? 'select-all' : ''}`}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </div>
        ))}
      </div>
    )}
  </div>
);

const ExplorerTab = ({ visibleColumns, videos, currentPage, totalPages, total, pageSize, onPageChange, onExport }) => (
  <div className="tab-content">
    <div className="explorer-actions">
      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="export-btn" onClick={onExport}><Download size={16} /> Export CSV</button>
      </div>
      <div className="pagination">
        <button className="page-btn" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft size={16} /> Previous
        </button>
        <span className="page-info">
          Page {currentPage} of {totalPages} • Showing {videos.length} of {total.toLocaleString()} videos
        </span>
        <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
    <table className="explorer-table">
      <thead>
        <tr>
          {ALL_COLUMNS.filter(c => visibleColumns.includes(c.id)).map(c => (
            <th key={c.id}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {videos.map((row, i) => (
          <tr key={row.Video_ID || i}>
            {ALL_COLUMNS.filter(c => visibleColumns.includes(c.id)).map(c => (
              <td key={c.id} className={c.id === 'Headline' ? 'headline-cell' : ''}>
                {c.id === 'Published'
                  ? (row[c.id] === 'Yes' ? '● Published' : '○ Unpublished')
                  : (row[c.id] ?? '—')}
              </td>
            ))}
          </tr>
        ))}
        {videos.length === 0 && (
          <tr>
            <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              No videos match current filters
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const ChartsTab = ({ data }) => {
  if (!data) return <div className="tab-content" style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading charts…</div>;

  const platTotal = data.platform_dist.reduce((s, d) => s + d.value, 0) || 1;
  const platPct = data.platform_dist.map((d, i) => ({
    ...d,
    pct: parseFloat((d.value / platTotal * 100).toFixed(1)),
    color: PLAT_COLORS[i % PLAT_COLORS.length],
  }));

  return (
    <div className="tab-content charts-grid-layout">
      <div className="chart-item">
        <h5>OUTPUT TYPE DISTRIBUTION</h5>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.type_dist}>
            <XAxis dataKey="name" hide />
            <YAxis hide />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }} />
            <Bar dataKey="value" fill="#8b0000" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-item">
        <h5>TOP CONTRIBUTORS</h5>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.top_users} layout="vertical">
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" stroke="#888" fontSize={10} width={100} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }} />
            <Bar dataKey="value" fill="#ff4d6d" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-item">
        <h5>VIDEOS BY TEAM</h5>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.team_dist}>
            <XAxis dataKey="name" hide />
            <YAxis hide />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }} />
            <Bar dataKey="value" fill="#8b0000" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-item">
        <h5>PLATFORM REACH</h5>
        <ResponsiveContainer width="100%" height={250}>
          <RePieChart>
            <Pie data={platPct} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="pct">
              {platPct.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip />
          </RePieChart>
        </ResponsiveContainer>
        <div className="donut-legend">
          {platPct.map(d => <div key={d.name}>{d.name}: {d.pct}%</div>)}
        </div>
      </div>
    </div>
  );
};

const InsightsTab = ({ data }) => {
  if (!data) return <div className="tab-content" style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading insights…</div>;

  return (
    <div className="tab-content">
      <div className="auto-insights">
        <p className="insight-label"><Sparkles size={14} color="#ff4d6d" /> AUTO INSIGHTS</p>
        <ul>
          {data.insights.map((text, i) => <li key={i}>{text}</li>)}
        </ul>
      </div>
      <div className="breakdown-tables">
        <div className="breakdown-card">
          <h5>TYPE BREAKDOWN</h5>
          <table>
            <thead><tr><th>Type</th><th>Count</th><th>Share %</th></tr></thead>
            <tbody>
              {data.type_table.map(r => (
                <tr key={r.Type}><td>{r.Type}</td><td>{r.Count}</td><td>{r.Share}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="breakdown-card">
          <h5>TEAM BREAKDOWN</h5>
          <table>
            <thead><tr><th>Team</th><th>Videos</th><th>Users</th><th>Published</th><th>Pub %</th></tr></thead>
            <tbody>
              {data.team_table.map(r => (
                <tr key={r.Team_Name}>
                  <td>{r.Team_Name}</td><td>{r.Videos}</td><td>{r.Users}</td><td>{r.Published}</td><td>{r.Pub_Pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const RecordInspectorTab = ({ videos }) => {
  const [selectedId, setSelectedId] = useState('');
  const [record, setRecord] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (videos.length > 0 && !videos.find(r => String(r.Video_ID) === selectedId)) {
      setSelectedId(String(videos[0].Video_ID));
    }
  }, [videos, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`${TAB5_API}/video/${selectedId}`)
      .then(r => r.json())
      .then(setRecord)
      .catch(() => {});
  }, [selectedId]);

  const r = record || {};

  const handleCopy = () => {
    navigator.clipboard.writeText(r.Headline || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="tab-content">
      <div className="inspector-header">
        <label>Select a Video ID</label>
        <div className="video-id-select" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
          {selectedId || '—'} <ChevronDown size={14} />
          {isDropdownOpen && (
            <div className="dropdown-menu explorer" style={{ top: '100%', left: 0, width: '200px', maxHeight: '300px', overflowY: 'auto' }}>
              {videos.map(row => (
                <div key={row.Video_ID} className="dropdown-item" onClick={e => {
                  e.stopPropagation();
                  setSelectedId(String(row.Video_ID));
                  setIsDropdownOpen(false);
                }}>{row.Video_ID}</div>
              ))}
              {videos.length === 0 && <div className="dropdown-item">No videos available</div>}
            </div>
          )}
        </div>
      </div>
      <div className="inspector-grid">
        <div className="record-details">
          <p className="detail-label"><Video size={14} /> VIDEO RECORD</p>
          <div className="detail-row"><span>VIDEO ID</span><span>{r.Video_ID}</span></div>
          <div className="detail-row"><span>HEADLINE</span><span>{r.Headline}</span></div>
          <div className="detail-row"><span>TYPE</span><span>{r.Type}</span></div>
          <div className="detail-row"><span>STATUS</span><span>{r.Published === 'Yes' ? '● Published' : '○ Unpublished'}</span></div>
          <div className="detail-row"><span>USER</span><span>{r.User_Name}</span></div>
          <div className="detail-row"><span>TEAM</span><span>{r.Team_Name}</span></div>
          <div className="detail-row"><span>PLATFORM</span><span>{r.Platform_Name}</span></div>
        </div>
        <div className="record-links">
          <p className="detail-label"><InspectIcon size={14} /> LINKS</p>
          <div className="detail-row"><span>SOURCE URL</span><span className="url">{r.Source || '—'}</span></div>
          <div className="detail-row"><span>PUBLISHED URL</span><span>{r.Published_URL || '—'}</span></div>
          {r.Source && r.Source !== '—' && (
            <button className="open-source-btn" onClick={() => window.open(r.Source, '_blank')}>
              <ExternalLink size={16} /> Open Source
            </button>
          )}
          <div className="copy-box" onClick={handleCopy}>
            <span>{r.Headline || '—'}</span>
            <Copy size={14} />
            {copied && <span style={{ color: '#00c864', fontSize: '11px', marginLeft: '8px' }}>Copied!</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

const VideoExplorer = () => {
  const [activeTab, setActiveTab] = useState('explorer');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.map(c => c.id));
  const [openDropdown, setOpenDropdown] = useState(null);
  const [selections, setSelections] = useState({
    outputType: 'All', team: 'All', user: 'All', platform: 'All',
  });
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [filterOptions, setFilterOptions] = useState({ types: [], teams: [], users: [], platforms: [], total: 0 });
  const [stats, setStats] = useState(null);
  const [videoResp, setVideoResp] = useState({ data: [], total: 0, total_pages: 1, page: 1 });
  const [chartData, setChartData] = useState(null);
  const [insightData, setInsightData] = useState(null);

  const searchTimer = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  const filterState = useMemo(() => ({
    search: debouncedSearch,
    published: statusFilter,
    outputType: selections.outputType,
    team: selections.team,
    user: selections.user,
    platform: selections.platform,
  }), [debouncedSearch, statusFilter, selections]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (selections.team !== 'All') p.append('teams', selections.team);
    fetch(`${TAB5_API}/filters?${p.toString()}`)
      .then(r => r.json())
      .then(setFilterOptions)
      .catch(() => {});
  }, [selections.team]);

  useEffect(() => {
    const qs = buildQS(filterState).toString();
    fetch(`${TAB5_API}/stats?${qs}`).then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${TAB5_API}/charts?${qs}`).then(r => r.json()).then(setChartData).catch(() => {});
    fetch(`${TAB5_API}/insights?${qs}`).then(r => r.json()).then(setInsightData).catch(() => {});
    setCurrentPage(1);
  }, [filterState]);

  useEffect(() => {
    const p = buildQS(filterState);
    p.set('page', String(currentPage));
    p.set('page_size', String(pageSize));
    fetch(`${TAB5_API}/videos?${p.toString()}`)
      .then(r => r.json())
      .then(setVideoResp)
      .catch(() => {});
  }, [filterState, currentPage, pageSize]);

  const handleExport = () => {
    const qs = buildQS(filterState).toString();
    window.open(`${TAB5_API}/export?${qs}`, '_blank');
  };

  const handleToggleDropdown = (name) => setOpenDropdown(openDropdown === name ? null : name);
  const handleSelect = (category, value) => {
    setSelections(prev => ({ ...prev, [category]: value }));
    setOpenDropdown(null);
  };
  const removeColumn = (id) => setVisibleColumns(prev => prev.filter(c => c !== id));

  const s = stats || {};

  return (
    <div className="explorer-layout">
      {/* Sidebar Filters */}
      <aside className="explorer-sidebar">
        <div className="sidebar-brand">
          <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
          <span style={{ fontSize: '20px', fontWeight: '900', color: '#ff4d6d' }}>FRAMMER AI</span>
        </div>

        <div className="filter-section">
          <label><Search size={14} /> SEARCH</label>
          <input
            type="text"
            placeholder="Search headline, source, user, team..."
            className="sidebar-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-section">
          <label>Output Type</label>
          <CustomDropdown
            options={['All', ...filterOptions.types]}
            currentSelection={selections.outputType}
            onSelect={val => handleSelect('outputType', val)}
            isOpen={openDropdown === 'outputType'}
            onToggle={() => handleToggleDropdown('outputType')}
          />
        </div>

        <div className="filter-section">
          <label>STATUS</label>
          <div className="radio-group">
            {['All', 'Published', 'Unpublished'].map(v => (
              <label key={v}>
                <input type="radio" name="status" checked={statusFilter === v} onChange={() => setStatusFilter(v)} /> {v}
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label>TEAM</label>
          <CustomDropdown
            options={['All', ...filterOptions.teams]}
            currentSelection={selections.team}
            onSelect={val => handleSelect('team', val)}
            isOpen={openDropdown === 'team'}
            onToggle={() => handleToggleDropdown('team')}
          />
        </div>

        <div className="filter-section">
          <label>User</label>
          <CustomDropdown
            options={['All', ...filterOptions.users]}
            currentSelection={selections.user}
            onSelect={val => handleSelect('user', val)}
            isOpen={openDropdown === 'user'}
            onToggle={() => handleToggleDropdown('user')}
          />
        </div>

        <div className="filter-section">
          <label>PLATFORM</label>
          <CustomDropdown
            options={['All', ...filterOptions.platforms]}
            currentSelection={selections.platform}
            onSelect={val => handleSelect('platform', val)}
            isOpen={openDropdown === 'platform'}
            onToggle={() => handleToggleDropdown('platform')}
          />
        </div>

        <div className="filter-section">
          <label>VIEW</label>
          <div className="tag-cloud">
            {visibleColumns.map(colId => {
              const col = ALL_COLUMNS.find(c => c.id === colId);
              return (
                <span key={colId} className="tag" onClick={() => removeColumn(colId)}>
                  {col?.label} ✕
                </span>
              );
            })}
          </div>
        </div>

        <div className="filter-section">
          <label>Rows per page</label>
          <input
            type="range" min="5" max="100" value={pageSize}
            className="sidebar-slider"
            onChange={e => setPageSize(Number(e.target.value))}
          />
          <div className="slider-value">{pageSize}</div>
        </div>

        <button className="clear-filters-btn" onClick={() => {
          setVisibleColumns(ALL_COLUMNS.map(c => c.id));
          setStatusFilter('All');
          setSearchQuery('');
          setSelections({ outputType: 'All', team: 'All', user: 'All', platform: 'All' });
          setPageSize(20);
        }}>
          ✕ Clear all filters
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="explorer-main">
        {/* <header className="explorer-header">
          <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
          <div className="fork-btn">Fork</div>
        </header> */}

        {/* Top Stats Cards */}
        <div className="explorer-stats-grid">
          <div className="stat-card-dark">
            <div className="icon-row"><Video size={20} color="#ff4d6d" /></div>
            <h2>{(s.total || 0).toLocaleString()}</h2>
            <p>Videos in view</p>
            <div className="stat-progress"><div className="bar" style={{ width: `${s.pct_of_total || 0}%` }}></div></div>
          </div>
          <div className="stat-card-dark">
            <div className="icon-row"><CheckCircle size={20} color="#00c864" /></div>
            <h2>{(s.published || 0).toLocaleString()}</h2>
            <p>Published</p>
            <span className="sub">{s.pub_pct || 0}% publish rate</span>
          </div>
          <div className="stat-card-dark">
            <div className="icon-row"><Users size={20} color="#c084fc" /></div>
            <h2>{s.unique_users || 0}</h2>
            <p>Users</p>
            <span className="sub">Filtered contributors</span>
          </div>
          <div className="stat-card-dark">
            <div className="icon-row"><Layout size={20} color="#fbbf24" /></div>
            <h2>{s.unique_types || 0}</h2>
            <p>Output types</p>
            <span className="sub">Unique categories</span>
          </div>
          <div className="stat-card-dark">
            <div className="icon-row"><Share2 size={20} color="#2dd4bf" /></div>
            <h2>{s.platforms || 0}</h2>
            <p>Platforms</p>
            <span className="sub">Active destinations</span>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="explorer-tabs">
          {[
            { key: 'explorer', icon: Layout, label: 'Explorer' },
            { key: 'charts', icon: BarChart2, label: 'Charts' },
            { key: 'insights', icon: Lightbulb, label: 'Insights' },
            { key: 'inspector', icon: InspectIcon, label: 'Record Inspector' },
          ].map(t => (
            <button
              key={t.key}
              className={`tab-link ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        <div className="explorer-tab-content">
          {activeTab === 'explorer' && (
            <ExplorerTab
              visibleColumns={visibleColumns}
              videos={videoResp.data}
              currentPage={videoResp.page}
              totalPages={videoResp.total_pages}
              total={videoResp.total}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onExport={handleExport}
            />
          )}
          {activeTab === 'charts' && <ChartsTab data={chartData} />}
          {activeTab === 'insights' && <InsightsTab data={insightData} />}
          {activeTab === 'inspector' && <RecordInspectorTab videos={videoResp.data} />}
        </div>
      </main>
    </div>
  );
};

export default VideoExplorer;
