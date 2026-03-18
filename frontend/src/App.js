import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Briefcase, BarChart2, Users, Settings, ArrowLeft } from 'lucide-react';
import AnalyticsOverview from './AnalyticsOverview';
import ExecutiveSummary from './ExecutiveSummary';
import VideoExplorer from './VideoExplorer';
import ProjectsDashboard from './ProjectsDashboard';
import AnalyticsDashboard from './AnalyticsDashboard';
import ChatbotWidget from './ChatbotWidget';

// Placeholder for other pages
const Page = ({ title, icon: Icon }) => (
  <div className="page-content" style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto' }}>
    <Link to="/" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#ff4d6d', textDecoration: 'none', marginBottom: '40px', fontWeight: '600' }}>
      <ArrowLeft size={20} />
      Back to Home
    </Link>
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <Icon size={48} color="#ff4d6d" />
      <h1 style={{ fontSize: '48px', margin: '0' }}>{title}</h1>
    </div>
    <p style={{ color: '#888', fontSize: '20px', marginTop: '24px' }}>
      Welcome to the {title} section of Frammer AI.
    </p>
  </div>
);

// Home Component
const Home = () => {
  const topRow = [
    { name: 'Dashboard', path: '/dashboard', icon: Layout },
    { name: 'Projects', path: '/projects', icon: Briefcase },
    { name: 'Analytics', path: '/analytics', icon: BarChart2 },
  ];
  const bottomRow = [
    { name: 'Team', path: '/team', icon: Users },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="home-container">
      <div className="logo-header">
        <div className="logo-box">F</div>
        <h1 className="app-title">
          Frammer <span>AI</span>
        </h1>
      </div>

      <div className="buttons-container">
        <div className="row">
          {topRow.map((btn) => (
            <Link key={btn.name} to={btn.path} className="big-button">
              <btn.icon size={48} />
              {btn.name}
            </Link>
          ))}
        </div>
        <div className="row">
          {bottomRow.map((btn) => (
            <Link key={btn.name} to={btn.path} className="big-button">
              <btn.icon size={48} />
              {btn.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<AnalyticsOverview />} />
          <Route path="/projects" element={<ProjectsDashboard />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/team" element={<ExecutiveSummary />} />
          <Route path="/settings" element={<VideoExplorer />} />
        </Routes>
        <ChatbotWidget />
      </>
    </Router>
  );
}

export default App;
