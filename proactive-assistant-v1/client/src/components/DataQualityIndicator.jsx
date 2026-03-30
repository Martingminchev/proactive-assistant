import { useState, useCallback } from 'react';
import './DataQualityIndicator.css';

/**
 * DataQualityIndicator - Shows if Pieces is providing good data
 * 
 * Features:
 * - Green/yellow/red status indicator
 * - "Click to fix" for common issues
 * - Transparency about what the AI knows
 * - Data source breakdown
 */

// Mock data for data quality
const MOCK_DATA_QUALITY = {
  overallStatus: 'good', // 'excellent', 'good', 'fair', 'poor'
  score: 78,
  lastUpdated: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
  sources: {
    pieces: {
      connected: true,
      status: 'active',
      snippetsCount: 247,
      recentActivity: 12, // items in last hour
      quality: 'good',
      issues: [],
    },
    browser: {
      connected: true,
      status: 'active',
      recentSites: 8,
      quality: 'good',
      issues: [],
    },
    files: {
      connected: true,
      status: 'limited',
      recentFiles: 23,
      quality: 'fair',
      issues: ['access_restricted'],
    },
    applications: {
      connected: false,
      status: 'disconnected',
      quality: 'poor',
      issues: ['not_connected'],
    },
  },
  aiKnowledge: {
    userGoals: 3,
    recentTopics: ['React', 'TypeScript', 'Productivity', 'API Design'],
    contextDepth: '7 days',
    confidenceLevel: 82,
  },
  commonIssues: [
    {
      id: 'issue-1',
      type: 'files',
      title: 'Limited file access',
      description: 'Some directories are not accessible. This limits the AI\'s understanding of your projects.',
      severity: 'medium',
      fixable: true,
      fixLabel: 'Grant Access',
      fixAction: 'grantFileAccess',
    },
    {
      id: 'issue-2',
      type: 'applications',
      title: 'Application tracking disabled',
      description: 'App usage tracking helps the AI understand your workflow better.',
      severity: 'low',
      fixable: true,
      fixLabel: 'Enable Tracking',
      fixAction: 'enableAppTracking',
    },
  ],
  recentActivity: [
    { type: 'snippet', description: 'Saved code snippet', time: '2 min ago' },
    { type: 'file', description: 'Indexed 3 new files', time: '5 min ago' },
    { type: 'website', description: 'Visited React docs', time: '12 min ago' },
  ],
};

// Status configuration
const STATUS_CONFIG = {
  excellent: { color: '#10b981', icon: '✨', label: 'Excellent', bgColor: 'rgba(16, 185, 129, 0.1)' },
  good: { color: '#22c55e', icon: '✅', label: 'Good', bgColor: 'rgba(34, 197, 94, 0.1)' },
  fair: { color: '#f59e0b', icon: '⚠️', label: 'Fair', bgColor: 'rgba(245, 158, 11, 0.1)' },
  poor: { color: '#ef4444', icon: '❌', label: 'Poor', bgColor: 'rgba(239, 68, 68, 0.1)' },
};

const SOURCE_ICONS = {
  pieces: '🧩',
  browser: '🌐',
  files: '📁',
  applications: '🖥️',
};

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.fair;
  
  return (
    <div className="status-badge" style={{ backgroundColor: config.bgColor }}>
      <span className="status-icon" style={{ color: config.color }}>
        {config.icon}
      </span>
      <span className="status-text" style={{ color: config.color }}>
        {config.label}
      </span>
    </div>
  );
}

function ScoreRing({ score }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  
  let color = '#ef4444';
  if (score >= 80) color = '#10b981';
  else if (score >= 60) color = '#f59e0b';
  else if (score >= 40) color = '#f97316';
  
  return (
    <div className="score-ring">
      <svg viewBox="0 0 100 100">
        <circle
          className="score-ring-bg"
          cx="50"
          cy="50"
          r="40"
        />
        <circle
          className="score-ring-progress"
          cx="50"
          cy="50"
          r="40"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            stroke: color,
          }}
        />
      </svg>
      <div className="score-value">
        <span className="score-number">{score}</span>
        <span className="score-label">/100</span>
      </div>
    </div>
  );
}

function SourceCard({ source, data, onFix }) {
  const [isFixing, setIsFixing] = useState(false);
  
  const handleFix = async () => {
    setIsFixing(true);
    await onFix?.(source, data.issues[0]);
    setTimeout(() => setIsFixing(false), 1000);
  };
  
  const statusConfig = STATUS_CONFIG[data.quality] || STATUS_CONFIG.fair;
  
  return (
    <div className={`source-card quality-${data.quality}`}>
      <div className="source-header">
        <div className="source-info">
          <span className="source-icon">{SOURCE_ICONS[source]}</span>
          <div className="source-details">
            <span className="source-name">{source.charAt(0).toUpperCase() + source.slice(1)}</span>
            <span className={`source-status ${data.status}`}>
              {data.connected ? (data.status === 'active' ? '● Active' : '● Limited') : '○ Disconnected'}
            </span>
          </div>
        </div>
        <span className="source-quality" style={{ color: statusConfig.color }}>
          {statusConfig.label}
        </span>
      </div>
      
      {data.connected && (
        <div className="source-stats">
          {data.snippetsCount !== undefined && (
            <span className="stat">{data.snippetsCount} snippets</span>
          )}
          {data.recentActivity !== undefined && (
            <span className="stat">{data.recentActivity} recent</span>
          )}
          {data.recentSites !== undefined && (
            <span className="stat">{data.recentSites} sites</span>
          )}
          {data.recentFiles !== undefined && (
            <span className="stat">{data.recentFiles} files</span>
          )}
        </div>
      )}
      
      {data.issues.length > 0 && data.issues[0] && (
        <button 
          className="fix-btn"
          onClick={handleFix}
          disabled={isFixing}
        >
          {isFixing ? (
            <span className="spinner-tiny"></span>
          ) : (
            '🔧 Fix Issue'
          )}
        </button>
      )}
    </div>
  );
}

function AIKnowledgeCard({ knowledge }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={`ai-knowledge-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="knowledge-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="knowledge-title">
          <span className="brain-icon">🧠</span>
          <span>What I Know About You</span>
        </div>
        <button className="expand-btn">
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      
      {!isExpanded && (
        <div className="knowledge-preview">
          <span className="confidence-pill">
            {knowledge.confidenceLevel}% confidence
          </span>
          <span className="context-pill">
            {knowledge.contextDepth} of context
          </span>
        </div>
      )}
      
      {isExpanded && (
        <div className="knowledge-details">
          <div className="knowledge-section">
            <h5>Your Goals</h5>
            <p>{knowledge.userGoals} active goals being tracked</p>
          </div>
          
          <div className="knowledge-section">
            <h5>Recent Topics</h5>
            <div className="topics-list">
              {knowledge.recentTopics.map((topic, index) => (
                <span key={index} className="topic-tag">{topic}</span>
              ))}
            </div>
          </div>
          
          <div className="knowledge-section">
            <h5>Context Window</h5>
            <p>I'm analyzing your activity from the last {knowledge.contextDepth}</p>
          </div>
          
          <div className="knowledge-confidence">
            <div className="confidence-bar">
              <div 
                className="confidence-fill"
                style={{ width: `${knowledge.confidenceLevel}%` }}
              />
            </div>
            <span className="confidence-label">
              {knowledge.confidenceLevel}% confidence in recommendations
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue, onFix }) {
  const [isFixing, setIsFixing] = useState(false);
  
  const handleFix = async () => {
    setIsFixing(true);
    await onFix(issue);
    setTimeout(() => setIsFixing(false), 1000);
  };
  
  const severityColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#3b82f6',
  };
  
  return (
    <div className="issue-card">
      <div className="issue-header">
        <span 
          className="issue-severity"
          style={{ backgroundColor: severityColors[issue.severity] }}
        >
          {issue.severity}
        </span>
        <span className="issue-type">{SOURCE_ICONS[issue.type]}</span>
      </div>
      <h5 className="issue-title">{issue.title}</h5>
      <p className="issue-description">{issue.description}</p>
      {issue.fixable && (
        <button 
          className="issue-fix-btn"
          onClick={handleFix}
          disabled={isFixing}
        >
          {isFixing ? (
            <span className="spinner-tiny"></span>
          ) : (
            <>
              <span className="fix-icon">🔧</span>
              {issue.fixLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
}

function DataQualityIndicator({ qualityData: propData, onFixIssue }) {
  const data = propData || MOCK_DATA_QUALITY;
  const [showDetails, setShowDetails] = useState(false);
  const [fixedIssues, setFixedIssues] = useState(new Set());
  
  const handleFixSource = useCallback(async (source, issue) => {
    console.log('Fixing source:', source, issue);
    onFixIssue?.('source', source, issue);
    
    // Simulate fix
    setTimeout(() => {
      setFixedIssues(prev => new Set(prev).add(`${source}-${issue}`));
    }, 500);
  }, [onFixIssue]);
  
  const handleFixIssue = useCallback(async (issue) => {
    console.log('Fixing issue:', issue);
    onFixIssue?.('issue', issue);
    
    // Simulate fix
    setTimeout(() => {
      setFixedIssues(prev => new Set(prev).add(issue.id));
    }, 500);
  }, [onFixIssue]);
  
  const activeIssues = data.commonIssues.filter(issue => !fixedIssues.has(issue.id));
  
  // Format time since update
  const timeSinceUpdate = Math.floor((Date.now() - data.lastUpdated) / 60000);
  const updateText = timeSinceUpdate < 1 ? 'Just now' : 
                     timeSinceUpdate === 1 ? '1 min ago' : 
                     `${timeSinceUpdate} mins ago`;

  return (
    <div className="data-quality-indicator">
      {/* Header */}
      <div className="quality-header">
        <div className="quality-title">
          <span className="title-icon">📡</span>
          <div>
            <h2>Data Quality</h2>
            <span className="update-time">Last updated: {updateText}</span>
          </div>
        </div>
        <StatusBadge status={data.overallStatus} />
      </div>
      
      {/* Score Section */}
      <div className="quality-score-section">
        <ScoreRing score={data.score} />
        <div className="score-explanation">
          <h4>AI Context Quality</h4>
          <p>
            This score reflects how well the AI understands your work patterns. 
            Higher scores mean better, more relevant recommendations.
          </p>
        </div>
      </div>
      
      {/* Toggle Details Button */}
      <button 
        className="toggle-details-btn"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? '▲ Hide Details' : '▼ Show Data Sources'}
      </button>
      
      {/* Data Sources */}
      {showDetails && (
        <div className="data-sources">
          <h4>Data Sources</h4>
          <div className="sources-grid">
            {Object.entries(data.sources).map(([source, sourceData]) => (
              <SourceCard
                key={source}
                source={source}
                data={sourceData}
                onFix={handleFixSource}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* AI Knowledge */}
      <AIKnowledgeCard knowledge={data.aiKnowledge} />
      
      {/* Issues Section */}
      {activeIssues.length > 0 && (
        <div className="issues-section">
          <div className="issues-header">
            <h4>⚠️ Issues to Fix</h4>
            <span className="issue-count">{activeIssues.length} found</span>
          </div>
          <div className="issues-list">
            {activeIssues.map(issue => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onFix={handleFixIssue}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Recent Activity */}
      <div className="recent-activity">
        <h4>📊 Recent Activity</h4>
        <div className="activity-list">
          {data.recentActivity.map((activity, index) => (
            <div key={index} className="activity-item">
              <span className="activity-icon">
                {activity.type === 'snippet' && '📝'}
                {activity.type === 'file' && '📄'}
                {activity.type === 'website' && '🌐'}
              </span>
              <span className="activity-description">{activity.description}</span>
              <span className="activity-time">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DataQualityIndicator;
