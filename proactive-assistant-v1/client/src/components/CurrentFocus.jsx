import { useState, useEffect } from 'react';
import './CurrentFocus.css';

/**
 * CurrentFocus - Shows what user is doing RIGHT NOW
 * 
 * Features:
 * - Current app, file, inferred task
 * - Time spent on current task
 * - "Continue where you left off" button
 * - Recent files/activities
 */

// Mock data for current focus
const MOCK_FOCUS_DATA = {
  activeApp: {
    name: 'Visual Studio Code',
    icon: '📝',
    windowTitle: 'CurrentFocus.jsx - proactive-assistant',
  },
  currentFile: {
    name: 'CurrentFocus.jsx',
    path: 'client/src/components/CurrentFocus.jsx',
    type: 'javascript',
    lastModified: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
  },
  inferredTask: {
    name: 'Building React Components',
    confidence: 0.87,
    category: 'frontend-development',
    description: 'Creating new UI components for the Proactive Assistant dashboard',
  },
  sessionDuration: 47 * 60 * 1000, // 47 minutes
  isInFlow: true,
  flowScore: 78,
  recentFiles: [
    { name: 'ActionCenter.jsx', path: 'client/src/components/ActionCenter.jsx', type: 'javascript', timeAgo: '12 min ago' },
    { name: 'ActionCenter.css', path: 'client/src/components/ActionCenter.css', type: 'css', timeAgo: '15 min ago' },
    { name: 'App.jsx', path: 'client/src/App.jsx', type: 'javascript', timeAgo: '32 min ago' },
    { name: 'Dashboard.jsx', path: 'client/src/components/Dashboard.jsx', type: 'javascript', timeAgo: '45 min ago' },
  ],
  recentWebsites: [
    { name: 'React Documentation', url: 'react.dev', favicon: '⚛️', timeAgo: '8 min ago' },
    { name: 'Stack Overflow', url: 'stackoverflow.com', favicon: '💬', timeAgo: '25 min ago' },
  ],
  suggestedContinuation: {
    title: 'Continue working on components',
    action: 'open-last-file',
    description: 'You were making good progress. Want to jump back in?',
  },
  productivityMetrics: {
    contextSwitches: 3,
    productiveTime: 42, // minutes
    idleTime: 5, // minutes
    focusScore: 85,
  },
};

// File type icons
const FILE_ICONS = {
  javascript: '📜',
  typescript: '📘',
  css: '🎨',
  scss: '🎨',
  html: '🌐',
  json: '📋',
  md: '📝',
  default: '📄',
};

function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

function FocusIndicator({ score, isInFlow }) {
  let status = 'distracted';
  let label = 'Distracted';
  let color = '#ef4444';
  
  if (score >= 80) {
    status = 'focused';
    label = 'Deep Focus';
    color = '#10b981';
  } else if (score >= 50) {
    status = 'moderate';
    label = 'Getting There';
    color = '#f59e0b';
  }
  
  return (
    <div className="focus-indicator">
      <div className={`focus-ring ${status}`} style={{ borderColor: color }}>
        <div className="focus-pulse" style={{ backgroundColor: color }} />
      </div>
      <div className="focus-status">
        <span className="status-label" style={{ color }}>{label}</span>
        <span className="status-score">{score}% focus</span>
      </div>
      {isInFlow && (
        <div className="flow-badge">
          <span className="flow-icon">🌊</span>
          <span>In Flow</span>
        </div>
      )}
    </div>
  );
}

function FileItem({ file, onClick }) {
  const icon = FILE_ICONS[file.type] || FILE_ICONS.default;
  
  return (
    <button className="file-item" onClick={onClick}>
      <span className="file-icon">{icon}</span>
      <div className="file-info">
        <span className="file-name">{file.name}</span>
        <span className="file-path">{file.path || file.timeAgo}</span>
      </div>
    </button>
  );
}

function WebsiteItem({ site }) {
  return (
    <a 
      className="website-item" 
      href={`https://${site.url}`} 
      target="_blank" 
      rel="noopener noreferrer"
    >
      <span className="site-favicon">{site.favicon}</span>
      <div className="site-info">
        <span className="site-name">{site.name}</span>
        <span className="site-url">{site.url} • {site.timeAgo}</span>
      </div>
    </a>
  );
}

function TaskCard({ task, duration }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const confidenceLevel = task.confidence >= 0.8 ? 'high' : 
                         task.confidence >= 0.5 ? 'medium' : 'low';
  
  return (
    <div className={`task-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="task-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="task-main">
          <span className="task-icon">🎯</span>
          <div className="task-details">
            <h4 className="task-name">{task.name}</h4>
            <div className="task-meta">
              <span className={`confidence-badge ${confidenceLevel}`}>
                {Math.round(task.confidence * 100)}% confidence
              </span>
              <span className="duration-badge">
                ⏱ {formatDuration(duration)}
              </span>
            </div>
          </div>
        </div>
        <button className="expand-btn">
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="task-expanded">
          <p className="task-description">{task.description}</p>
          <div className="task-category">
            <span className="category-label">Category:</span>
            <span className="category-value">{task.category.replace(/-/g, ' ')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductivityMetrics({ metrics }) {
  return (
    <div className="productivity-metrics">
      <h5>Session Stats</h5>
      <div className="metrics-grid">
        <div className="metric">
          <span className="metric-value" style={{ color: '#10b981' }}>
            {metrics.productiveTime}m
          </span>
          <span className="metric-label">Productive</span>
        </div>
        <div className="metric">
          <span className="metric-value" style={{ color: '#f59e0b' }}>
            {metrics.idleTime}m
          </span>
          <span className="metric-label">Idle</span>
        </div>
        <div className="metric">
          <span className="metric-value" style={{ color: metrics.contextSwitches > 5 ? '#ef4444' : '#3b82f6' }}>
            {metrics.contextSwitches}
          </span>
          <span className="metric-label">Switches</span>
        </div>
        <div className="metric highlight">
          <span className="metric-value" style={{ color: '#8b5cf6' }}>
            {metrics.focusScore}
          </span>
          <span className="metric-label">Focus Score</span>
        </div>
      </div>
    </div>
  );
}

function CurrentFocus({ focusData: propData }) {
  const [focusData, setFocusData] = useState(propData || MOCK_FOCUS_DATA);
  const [elapsedTime, setElapsedTime] = useState(focusData.sessionDuration);
  const [showAllFiles, setShowAllFiles] = useState(false);
  
  // Update elapsed time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 60000);
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Simulate real-time data updates (for demo)
  useEffect(() => {
    // In a real app, this would fetch from the Pieces API
    const interval = setInterval(() => {
      // Update mock data with slight variations
      setFocusData(prev => ({
        ...prev,
        productivityMetrics: {
          ...prev.productivityMetrics,
          focusScore: Math.min(100, Math.max(0, prev.productivityMetrics.focusScore + (Math.random() - 0.5) * 5)),
        },
      }));
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleContinue = () => {
    // In a real app, this would open the last file via Pieces SDK
    console.log('Continuing where left off...');
    alert(`Opening: ${focusData.currentFile.path}`);
  };
  
  const handleOpenFile = (file) => {
    console.log('Opening file:', file.path);
    alert(`Opening: ${file.path}`);
  };
  
  const displayedFiles = showAllFiles 
    ? focusData.recentFiles 
    : focusData.recentFiles.slice(0, 3);

  return (
    <div className="current-focus">
      {/* Header with Focus Indicator */}
      <div className="focus-header">
        <div className="focus-title">
          <span className="title-icon">👁️</span>
          <h2>Current Focus</h2>
        </div>
        <FocusIndicator 
          score={Math.round(focusData.productivityMetrics.focusScore)} 
          isInFlow={focusData.isInFlow}
        />
      </div>
      
      {/* Active App Section */}
      <div className="active-app-section">
        <div className="app-card">
          <span className="app-icon">{focusData.activeApp.icon}</span>
          <div className="app-info">
            <span className="app-name">{focusData.activeApp.name}</span>
            <span className="app-window" title={focusData.activeApp.windowTitle}>
              {focusData.activeApp.windowTitle}
            </span>
          </div>
          <div className="session-timer">
            <span className="timer-icon">⏱</span>
            <span className="timer-value">{formatDuration(elapsedTime)}</span>
          </div>
        </div>
      </div>
      
      {/* Inferred Task */}
      <div className="task-section">
        <TaskCard 
          task={focusData.inferredTask} 
          duration={elapsedTime}
        />
      </div>
      
      {/* Continue Where You Left Off */}
      <div className="continuation-section">
        <button className="continue-btn" onClick={handleContinue}>
          <span className="continue-icon">▶️</span>
          <div className="continue-text">
            <span className="continue-title">{focusData.suggestedContinuation.title}</span>
            <span className="continue-description">
              {focusData.suggestedContinuation.description}
            </span>
          </div>
        </button>
      </div>
      
      {/* Recent Files */}
      <div className="recent-files-section">
        <div className="section-header">
          <h4>📁 Recent Files</h4>
          {focusData.recentFiles.length > 3 && (
            <button 
              className="show-more-btn"
              onClick={() => setShowAllFiles(!showAllFiles)}
            >
              {showAllFiles ? 'Show less' : `+${focusData.recentFiles.length - 3} more`}
            </button>
          )}
        </div>
        <div className="files-list">
          {displayedFiles.map((file, index) => (
            <FileItem 
              key={index} 
              file={file} 
              onClick={() => handleOpenFile(file)}
            />
          ))}
        </div>
      </div>
      
      {/* Recent Websites */}
      <div className="recent-websites-section">
        <h4>🌐 Recent Websites</h4>
        <div className="websites-list">
          {focusData.recentWebsites.map((site, index) => (
            <WebsiteItem key={index} site={site} />
          ))}
        </div>
      </div>
      
      {/* Productivity Metrics */}
      <ProductivityMetrics metrics={focusData.productivityMetrics} />
    </div>
  );
}

export default CurrentFocus;
