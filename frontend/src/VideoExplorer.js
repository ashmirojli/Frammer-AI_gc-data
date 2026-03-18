import React, { useState, useEffect } from 'react';
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

// --- DATA ---
const explorerData = [
  { id: '104798', headline: 'Headline_4a207b1f43e7', type: 'news bulletin', status: 'Unpublished', user: 'vinay singh', team: 'Unknown', platform: 'YouTube' },
  { id: '189241', headline: '(No Headline)', type: 'interview', status: 'Unpublished', user: 'QA-Purushottam', team: 'Unknown', platform: 'YouTube' },
  { id: '202771', headline: 'Headline_f80886dfdc65', type: 'speech', status: 'Published', user: 'Neha', team: 'Unknown', platform: 'Shorts' },
  { id: '364065', headline: 'Headline_871a26de3fd6', type: 'discussion-show', status: 'Unpublished', user: 'sukhleen', team: 'Unknown', platform: 'Facebook' },
  { id: '373871', headline: 'Headline_7776e07e1733', type: 'interview', status: 'Published', user: 'AB', team: 'Unknown', platform: 'Shorts' },
  { id: '401612', headline: 'Headline_f5fddcf12c53', type: 'press conference', status: 'Unpublished', user: 'Chandan', team: 'Unknown', platform: 'Facebook-Reels' },
  { id: '504947', headline: 'Headline_c9cdf71480a6', type: 'special reports', status: 'Unpublished', user: 'Abhishek', team: 'Unknown', platform: 'YouTube' },
];

const FILTER_OPTIONS = {
  outputType: ['Unknown', 'debate', 'discussion-show', 'drama', 'in-brief', 'interview', 'news bulletin', 'podcast', 'speech', 'special reports', 'sports show', 'press conference'],
  team: ['Team_a3be678541', 'Unknown'],
  user: ['AB', 'Abhishek', 'Abhishek Sri', 'Adarsh (Frammer)', 'Alok Rai', 'Anamika Singh', 'Neha', 'Chandan', 'vinay singh', 'QA-Purushottam', 'sukhleen'],
  platform: ['Facebook', 'Facebook-Reels', 'Shorts', 'YouTube'],
  explorerFilters: ['Video_ID', 'Headline', 'Type', 'Published', 'User_Name', 'Team_Name', 'Platform_Name']
};

const chartData = [
  { name: 'interview', count: 5000 },
  { name: 'news bulletin', count: 3200 },
  { name: 'speech', count: 2400 },
  { name: 'special reports', count: 2100 },
  { name: 'debate', count: 1100 },
];

const contributorData = [
  { name: 'Chandan', count: 2100 },
  { name: 'QA-Purushottam', count: 1200 },
  { name: 'vikas.mohiya.com', count: 1100 },
  { name: 'Sandeep Bala', count: 1000 },
  { name: 'Nitesh', count: 950 },
];

const platformReachData = [
  { name: 'YouTube', value: 78.1, color: '#8b0000' },
  { name: 'Shorts', value: 12.5, color: '#ff4d6d' },
  { name: 'Facebook', value: 6.25, color: '#ff4d6dbb' },
  { name: 'Facebook-Reels', value: 3.13, color: '#ff4d6d88' },
];

const ALL_COLUMNS = [
  { id: 'id', label: 'Video ID' },
  { id: 'headline', label: 'Headline' },
  { id: 'type', label: 'Type' },
  { id: 'status', label: 'Status' },
  { id: 'user', label: 'User' },
  { id: 'team', label: 'Team' },
];

// --- COMPONENTS ---

const CustomDropdown = ({ label, options, currentSelection, onSelect, isOpen, onToggle }) => (
  <div className={`custom-dropdown-container ${isOpen ? 'open' : ''}`}>
    <div className="sidebar-dropdown" onClick={onToggle}>
      {currentSelection} <ChevronDown size={14} />
    </div>
    {isOpen && (
      <div className="dropdown-menu">
        {options.map(opt => (
          <div key={opt} className={`dropdown-item ${opt === 'All' ? 'select-all' : ''}`} onClick={() => onSelect(opt)}>{opt}</div>
        ))}
      </div>
    )}
  </div>
);

const ExplorerTab = ({ visibleColumns, data, explorerFilter, onFilterChange }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="tab-content">
      <div className="explorer-actions">
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="export-btn"><Download size={16} /> Export CSV</button>
          <div className="column-select explorer-dropdown" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
            {explorerFilter} <ChevronDown size={14} />
            {isDropdownOpen && (
              <div className="dropdown-menu explorer">
                {FILTER_OPTIONS.explorerFilters.map(opt => (
                  <div key={opt} className="dropdown-item" onClick={(e) => {
                    e.stopPropagation();
                    onFilterChange(opt);
                    setIsDropdownOpen(false);
                  }}>{opt}</div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="pagination">
          <button className="page-btn"><ChevronLeft size={16} /> Previous</button>
          <span className="page-info">Page 1 of 746 • Showing {data.length} of {data.length} videos</span>
          <button className="page-btn">Next <ChevronRight size={16} /></button>
        </div>
      </div>
      <table className="explorer-table">
        <thead>
          <tr>
            {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
              <th key={col.id}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.id}>
              {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
                <td key={col.id} className={col.id === 'headline' ? 'headline-cell' : ''}>
                  {row[col.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ChartsTab = ({ data }) => {
  // Generate dynamic data based on current filtered set
  const typeCounts = data.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + 1;
    return acc;
  }, {});
  const dynamicChartData = Object.keys(typeCounts).map(name => ({ name, count: typeCounts[name] }));

  const userCounts = data.reduce((acc, curr) => {
    acc[curr.user] = (acc[curr.user] || 0) + 1;
    return acc;
  }, {});
  const dynamicContributorData = Object.keys(userCounts).map(name => ({ name, count: userCounts[name] }));

  const platformCounts = data.reduce((acc, curr) => {
    acc[curr.platform] = (acc[curr.platform] || 0) + 1;
    return acc;
  }, {});
  const total = data.length || 1;
  const dynamicPlatformData = Object.keys(platformCounts).map((name, i) => ({
    name,
    value: parseFloat(((platformCounts[name] / total) * 100).toFixed(2)),
    color: ['#8b0000', '#ff4d6d', '#ff4d6dbb', '#ff4d6d88'][i % 4]
  }));

  return (
    <div className="tab-content charts-grid-layout">
      <div className="chart-item">
        <h5>OUTPUT TYPE DISTRIBUTION</h5>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dynamicChartData}>
            <XAxis dataKey="name" hide />
            <YAxis hide />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }} />
            <Bar dataKey="count" fill="#8b0000" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-item">
        <h5>TOP CONTRIBUTORS</h5>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dynamicContributorData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" stroke="#888" fontSize={10} width={100} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: 'none' }} />
            <Bar dataKey="count" fill="#ff4d6d" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-item">
        <h5>VIDEOS BY TEAM</h5>
        <div className="empty-chart-placeholder">
          <div className="bar large" style={{ height: '80%', background: '#8b0000' }}></div>
          <div className="bar small" style={{ height: '10%', background: '#ff4d6d' }}></div>
        </div>
      </div>
      <div className="chart-item">
        <h5>PLATFORM REACH</h5>
        <ResponsiveContainer width="100%" height={250}>
          <RePieChart>
            <Pie
              data={dynamicPlatformData}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {dynamicPlatformData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </RePieChart>
        </ResponsiveContainer>
        <div className="donut-legend">
          {dynamicPlatformData.map(d => (
            <div key={d.name}>{d.name}: {d.value}%</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const InsightsTab = ({ data }) => {
  const total = data.length || 1;
  const typeCounts = data.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + 1;
    return acc;
  }, {});
  const commonType = Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b, 'N/A');
  
  const userCounts = data.reduce((acc, curr) => {
    acc[curr.user] = (acc[curr.user] || 0) + 1;
    return acc;
  }, {});
  const topUser = Object.keys(userCounts).reduce((a, b) => userCounts[a] > userCounts[b] ? a : b, 'N/A');

  const unpublishedCount = data.filter(d => d.status === 'Unpublished').length;

  return (
    <div className="tab-content">
      <div className="auto-insights">
        <p className="insight-label"><Sparkles size={14} color="#ff4d6d" /> AUTO INSIGHTS</p>
        <ul>
          <li>Most common type is <strong>{commonType}</strong>, making up <strong>{((typeCounts[commonType] || 0) / total * 100).toFixed(1)}%</strong> of videos in view.</li>
          <li>Top contributor in this view is <strong>{topUser}</strong>.</li>
          <li><strong>{unpublishedCount} videos ({((unpublishedCount / total) * 100).toFixed(1)}%)</strong> are unpublished — sitting as potential backlog.</li>
          <li>Current view spans <strong>{data.length}</strong> videos across <strong>{Object.keys(typeCounts).length}</strong> types.</li>
        </ul>
      </div>
      <div className="breakdown-tables">
        <div className="breakdown-card">
          <h5>TYPE BREAKDOWN</h5>
          <table>
            <thead><tr><th>Type</th><th>Count</th><th>Share %</th></tr></thead>
            <tbody>
              {Object.keys(typeCounts).map(type => (
                <tr key={type}>
                  <td>{type}</td>
                  <td>{typeCounts[type]}</td>
                  <td>{((typeCounts[type] / total) * 100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="breakdown-card">
          <h5>TEAM BREAKDOWN</h5>
          <table>
            <thead><tr><th>Team_Name</th><th>Videos</th><th>Users</th><th>Published</th></tr></thead>
            <tbody>
              <tr><td>Unknown</td><td>{data.length}</td><td>{Object.keys(userCounts).length}</td><td>{data.filter(d => d.status === 'Published').length}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const RecordInspectorTab = ({ data }) => {
  const [selectedId, setSelectedId] = useState(data[0]?.id || '4168417');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sync selection when data changes due to filters
  useEffect(() => {
    if (data.length > 0 && !data.find(r => r.id === selectedId)) {
      setSelectedId(data[0].id);
    }
  }, [data, selectedId]);

  const selectedRecord = data.find(r => r.id === selectedId) || {
    id: selectedId,
    headline: 'Headline_3a11c61b3c1b',
    type: 'news bulletin',
    status: 'Unpublished',
    user: 'Neha'
  };

  return (
    <div className="tab-content">
      <div className="inspector-header">
        <label>Select a Video ID</label>
        <div className="video-id-select" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
          {selectedId} <ChevronDown size={14} />
          {isDropdownOpen && (
            <div className="dropdown-menu explorer" style={{ top: '100%', left: 0, width: '200px' }}>
              {data.map(row => (
                <div key={row.id} className="dropdown-item" onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(row.id);
                  setIsDropdownOpen(false);
                }}>{row.id}</div>
              ))}
              {data.length === 0 && <div className="dropdown-item">No videos available</div>}
            </div>
          )}
        </div>
      </div>
      <div className="inspector-grid">
        <div className="record-details">
          <p className="detail-label"><Video size={14} /> VIDEO RECORD</p>
          <div className="detail-row"><span>VIDEO ID</span><span>{selectedRecord.id}</span></div>
          <div className="detail-row"><span>HEADLINE</span><span>{selectedRecord.headline}</span></div>
          <div className="detail-row"><span>TYPE</span><span>{selectedRecord.type}</span></div>
          <div className="detail-row"><span>STATUS</span><span>{selectedRecord.status === 'Published' ? '● Published' : '○ Unpublished'}</span></div>
          <div className="detail-row"><span>USER</span><span>{selectedRecord.user}</span></div>
        </div>
        <div className="record-links">
          <p className="detail-label"><InspectIcon size={14} /> LINKS</p>
          <div className="detail-row"><span>SOURCE URL</span><span className="url">https://obfuscated.source.example/...</span></div>
          <div className="detail-row"><span>PUBLISHED URL</span><span>{selectedRecord.status === 'Published' ? 'https://published.example.com/' + selectedRecord.id : 'Not published yet'}</span></div>
          <button className="open-source-btn"><ExternalLink size={16} /> Open Source</button>
          <div className="copy-box">
            <span>{selectedRecord.headline}</span>
            <Copy size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---

const VideoExplorer = () => {
  const [activeTab, setActiveTab] = useState('explorer');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(['id', 'headline', 'type', 'status', 'user', 'team']);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [explorerFilter, setExplorerFilter] = useState('Video_ID');
  const [selections, setSelections] = useState({
    outputType: 'All',
    team: 'All',
    user: 'All',
    platform: 'All'
  });

  const handleToggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const handleSelect = (category, value) => {
    setSelections(prev => ({ ...prev, [category]: value }));
    setOpenDropdown(null);
  };

  const removeColumn = (id) => {
    setVisibleColumns(prev => prev.filter(c => c !== id));
  };

  const filteredData = explorerData.filter(item => {
    // Status Filter
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;

    // Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.headline.toLowerCase().includes(query) || 
        item.id.includes(query) || 
        item.user.toLowerCase().includes(query) || 
        item.type.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Output Type Filter
    if (selections.outputType !== 'All' && item.type !== selections.outputType) return false;

    // Team Filter
    if (selections.team !== 'All' && item.team !== selections.team) return false;

    // User Filter
    if (selections.user !== 'All' && item.user !== selections.user) return false;

    // Platform Filter
    if (selections.platform !== 'All' && item.platform !== selections.platform) return false;

    return true;
  });

  // Calculate dynamic stats
  const videosInView = filteredData.length;
  const publishedCount = filteredData.filter(d => d.status === 'Published').length;
  const uniqueUsers = new Set(filteredData.map(d => d.user)).size;
  const uniqueTypes = new Set(filteredData.map(d => d.type)).size;
  const uniquePlatforms = new Set(filteredData.map(d => d.platform)).size;

  return (
    <div className="explorer-layout">
      {/* Sidebar Filters */}
      <aside className="explorer-sidebar">
        <div className="sidebar-brand">
          <div className="logo-box mini">F</div>
          <span>Frammer AI</span>
        </div>
        
        <div className="filter-section">
          <label><Search size={14} /> SEARCH</label>
          <input 
            type="text" 
            placeholder="Search headline, source, user, team..." 
            className="sidebar-input" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-section">
          <label>Output Type</label>
          <CustomDropdown 
            options={['All', ...FILTER_OPTIONS.outputType]}
            currentSelection={selections.outputType}
            onSelect={(val) => handleSelect('outputType', val)}
            isOpen={openDropdown === 'outputType'}
            onToggle={() => handleToggleDropdown('outputType')}
          />
        </div>

        <div className="filter-section">
          <label>STATUS</label>
          <div className="radio-group">
            <label>
              <input 
                type="radio" 
                name="status" 
                checked={statusFilter === 'All'} 
                onChange={() => setStatusFilter('All')} 
              /> All
            </label>
            <label>
              <input 
                type="radio" 
                name="status" 
                checked={statusFilter === 'Published'} 
                onChange={() => setStatusFilter('Published')} 
              /> Published
            </label>
            <label>
              <input 
                type="radio" 
                name="status" 
                checked={statusFilter === 'Unpublished'} 
                onChange={() => setStatusFilter('Unpublished')} 
              /> Unpublished
            </label>
          </div>
        </div>

        <div className="filter-section">
          <label>TEAM</label>
          <CustomDropdown 
            options={['All', ...FILTER_OPTIONS.team]}
            currentSelection={selections.team}
            onSelect={(val) => handleSelect('team', val)}
            isOpen={openDropdown === 'team'}
            onToggle={() => handleToggleDropdown('team')}
          />
        </div>

        <div className="filter-section">
          <label>User</label>
          <CustomDropdown 
            options={['All', ...FILTER_OPTIONS.user]}
            currentSelection={selections.user}
            onSelect={(val) => handleSelect('user', val)}
            isOpen={openDropdown === 'user'}
            onToggle={() => handleToggleDropdown('user')}
          />
        </div>

        <div className="filter-section">
          <label>PLATFORM</label>
          <CustomDropdown 
            options={['All', ...FILTER_OPTIONS.platform]}
            currentSelection={selections.platform}
            onSelect={(val) => handleSelect('platform', val)}
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
          <input type="range" min="1" max="100" defaultValue="20" className="sidebar-slider" />
          <div className="slider-value">20</div>
        </div>

        <button className="clear-filters-btn" onClick={() => {
          setVisibleColumns(ALL_COLUMNS.map(c => c.id));
          setStatusFilter('All');
          setSearchQuery('');
          setSelections({
            outputType: 'All',
            team: 'All',
            user: 'All',
            platform: 'All'
          });
        }}>
          ✕ Clear all filters
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="explorer-main">
        <header className="explorer-header">
          <Link to="/" className="back-btn-mini"><ArrowLeft size={16} /></Link>
          <div className="fork-btn">Fork</div>
        </header>

        {/* Top Stats Cards */}
        <div className="explorer-stats-grid">
          <div className="stat-card-dark">
            <div className="icon-row"><Video size={20} color="#ff4d6d" /></div>
            <h2>{videosInView.toLocaleString()}</h2>
            <p>Videos in view</p>
            <div className="stat-progress"><div className="bar" style={{width: '100%'}}></div></div>
          </div>
          <div className="stat-card-dark">
            <div className="icon-row"><CheckCircle size={20} color="#00c864" /></div>
            <h2>{publishedCount}</h2>
            <p>Published</p>
            <span className="sub">{((publishedCount / (videosInView || 1)) * 100).toFixed(1)}% publish rate</span>
          </div>
          <div className="stat-card-dark">
            <div className="icon-row"><Users size={20} color="#c084fc" /></div>
            <h2>{uniqueUsers}</h2>
            <p>Users</p>
            <span className="sub">Filtered contributors</span>
          </div>
          <div className="stat-card-dark">
            <div className="icon-row"><Layout size={20} color="#fbbf24" /></div>
            <h2>{uniqueTypes}</h2>
            <p>Output types</p>
            <span className="sub">Unique categories</span>
          </div>
          <div className="stat-card-dark">
            <div className="icon-row"><Share2 size={20} color="#2dd4bf" /></div>
            <h2>{uniquePlatforms}</h2>
            <p>Platforms</p>
            <span className="sub">Active destinations</span>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="explorer-tabs">
          <button 
            className={`tab-link ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            <Layout size={16} /> Explorer
          </button>
          <button 
            className={`tab-link ${activeTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveTab('charts')}
          >
            <BarChart2 size={16} /> Charts
          </button>
          <button 
            className={`tab-link ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <Lightbulb size={16} /> Insights
          </button>
          <button 
            className={`tab-link ${activeTab === 'inspector' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspector')}
          >
            <InspectIcon size={16} /> Record Inspector
          </button>
        </div>

        <div className="explorer-tab-content">
          {activeTab === 'explorer' && (
            <ExplorerTab 
              visibleColumns={visibleColumns} 
              data={filteredData} 
              explorerFilter={explorerFilter}
              onFilterChange={setExplorerFilter}
            />
          )}
          {activeTab === 'charts' && <ChartsTab data={filteredData} />}
          {activeTab === 'insights' && <InsightsTab data={filteredData} />}
          {activeTab === 'inspector' && <RecordInspectorTab data={filteredData} />}
        </div>
      </main>
    </div>
  );
};

export default VideoExplorer;
