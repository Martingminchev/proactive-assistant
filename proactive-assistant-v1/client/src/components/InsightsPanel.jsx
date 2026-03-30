import { useState, useMemo } from 'react';
import './InsightsPanel.css';

/**
 * InsightsPanel - Pattern recognition insights and time tracking visualizations
 * 
 * Features:
 * - Pattern recognition insights
 * - "You keep doing X - here's a better way"
 * - Time tracking visualizations
 * - Weekly/monthly trends
 */

// Mock data for insights
const MOCK_INSIGHTS = {
  patterns: [
    {
      id: 'pattern-1',
      type: 'repetitive_action',
      title: 'Manual file organization detected',
      description: 'You spent 45 minutes organizing files by hand this week. Consider using a script to automate this.',
      impact: 'high',
      estimatedSavings: '2 hours/week',
      suggestion: 'Set up a folder watcher with Node.js to auto-sort files by extension.',
      actionLabel: 'View Script Template',
      actionUrl: '#script-template',
    },
    {
      id: 'pattern-2',
      type: 'context_switching',
      title: 'Frequent context switching',
      description: 'You switched contexts 23 times yesterday. Your most productive sessions were 90+ minutes uninterrupted.',
      impact: 'medium',
      estimatedSavings: '30 min/day',
      suggestion: 'Try time-blocking. Schedule deep work for 90-minute blocks.',
      actionLabel: 'Set Up Focus Mode',
      actionCallback: 'focusMode',
    },
    {
      id: 'pattern-3',
      type: 'tool_optimization',
      title: 'You keep searching for the same snippets',
      description: 'You\'ve looked up "React useEffect cleanup" 5 times this week. Save it to your snippets library.',
      impact: 'low',
      estimatedSavings: '10 min/week',
      suggestion: 'Add this to your code snippets or use a tool like Pieces to save it.',
      actionLabel: 'Save to Pieces',
      actionCallback: 'saveSnippet',
    },
  ],
  weeklyTrends: {
    totalHours: 42.5,
    productiveHours: 35.2,
    focusScore: 78,
    comparison: {
      vsLastWeek: +5.2,
      vsAverage: +2.1,
    },
    dailyBreakdown: [
      { day: 'Mon', hours: 7.5, productive: 6.2, focus: 82 },
      { day: 'Tue', hours: 8.0, productive: 6.8, focus: 85 },
      { day: 'Wed', hours: 6.5, productive: 5.0, focus: 70 },
      { day: 'Thu', hours: 9.0, productive: 8.2, focus: 91 },
      { day: 'Fri', hours: 7.5, productive: 5.5, focus: 73 },
      { day: 'Sat', hours: 2.0, productive: 1.5, focus: 75 },
      { day: 'Sun', hours: 2.0, productive: 2.0, focus: 88 },
    ],
  },
  topProjects: [
    { name: 'Proactive Assistant', hours: 18.5, percentage: 43, trend: 'up' },
    { name: 'API Integration', hours: 12.0, percentage: 28, trend: 'stable' },
    { name: 'Documentation', hours: 8.5, percentage: 20, trend: 'down' },
    { name: 'Code Review', hours: 3.5, percentage: 9, trend: 'up' },
  ],
  productivityPeaks: [
    { time: '9:00-11:00 AM', productivity: 92, label: 'Peak Focus' },
    { time: '2:00-4:00 PM', productivity: 78, label: 'Good' },
    { time: '4:00-6:00 PM', productivity: 65, label: 'Declining' },
  ],
  recommendations: [
    {
      id: 'rec-1',
      title: 'Schedule important work for 9-11 AM',
      reason: 'Your data shows 92% productivity during this window',
      type: 'scheduling',
    },
    {
      id: 'rec-2',
      title: 'Take a break around 3 PM',
      reason: 'Your focus consistently drops after 2.5 hours of continuous work',
      type: 'wellness',
    },
  ],
};

// Helper functions
const formatHours = (hours) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const getImpactConfig = (impact) => {
  switch (impact) {
    case 'high':
      return { color: '#ef4444', icon: '🔴', label: 'High Impact' };
    case 'medium':
      return { color: '#f59e0b', icon: '🟡', label: 'Medium Impact' };
    case 'low':
      return { color: '#10b981', icon: '🟢', label: 'Low Impact' };
    default:
      return { color: '#6b7280', icon: '⚪', label: 'Info' };
  }
};

// Components
function PatternCard({ pattern, onAction }) {
  const impact = getImpactConfig(pattern.impact);
  
  const handleAction = () => {
    if (pattern.actionUrl) {
      window.open(pattern.actionUrl, '_blank');
    }
    if (pattern.actionCallback) {
      onAction(pattern.actionCallback, pattern);
    }
  };

  return (
    <div className="pattern-card">
      <div className="pattern-header">
        <div className="pattern-type-icon">
          {pattern.type === 'repetitive_action' && '🔁'}
          {pattern.type === 'context_switching' && '🔄'}
          {pattern.type === 'tool_optimization' && '🛠️'}
        </div>
        <div className="pattern-impact" style={{ color: impact.color }}>
          {impact.icon} {impact.label}
        </div>
      </div>
      
      <h4 className="pattern-title">{pattern.title}</h4>
      <p className="pattern-description">{pattern.description}</p>
      
      <div className="pattern-savings">
        <span className="savings-label">💡 Potential savings:</span>
        <span className="savings-value">{pattern.estimatedSavings}</span>
      </div>
      
      <div className="pattern-suggestion">
        <strong>Suggestion:</strong> {pattern.suggestion}
      </div>
      
      <button className="pattern-action-btn" onClick={handleAction}>
        {pattern.actionLabel} →
      </button>
    </div>
  );
}

function WeeklyChart({ data }) {
  const maxHours = Math.max(...data.map(d => d.hours));
  
  return (
    <div className="weekly-chart">
      <div className="chart-header">
        <h4>Weekly Activity</h4>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot productive"></span>
            Productive
          </span>
          <span className="legend-item">
            <span className="legend-dot total"></span>
            Total
          </span>
        </div>
      </div>
      
      <div className="chart-bars">
        {data.map((day, index) => (
          <div key={day.day} className="chart-bar-group">
            <div className="bar-container">
              <div 
                className="bar total-bar"
                style={{ height: `${(day.hours / maxHours) * 100}%` }}
              >
                <div 
                  className="bar productive-bar"
                  style={{ height: `${(day.productive / day.hours) * 100}%` }}
                />
              </div>
              {day.focus >= 85 && <span className="star-badge">⭐</span>}
            </div>
            <span className="bar-label">{day.day}</span>
            <span className="bar-value">{day.hours}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectBreakdown({ projects }) {
  return (
    <div className="project-breakdown">
      <h4>Time by Project</h4>
      <div className="project-list">
        {projects.map((project, index) => (
          <div key={index} className="project-item">
            <div className="project-info">
              <span className="project-name">{project.name}</span>
              <div className="project-meta">
                <span className="project-hours">{formatHours(project.hours)}</span>
                <span className={`project-trend ${project.trend}`}>
                  {project.trend === 'up' && '📈'}
                  {project.trend === 'down' && '📉'}
                  {project.trend === 'stable' && '➡️'}
                </span>
              </div>
            </div>
            <div className="project-bar-container">
              <div 
                className="project-bar"
                style={{ width: `${project.percentage}%` }}
              />
              <span className="project-percentage">{project.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductivityPeaks({ peaks }) {
  return (
    <div className="productivity-peaks">
      <h4>⏰ Your Peak Hours</h4>
      <div className="peaks-list">
        {peaks.map((peak, index) => (
          <div key={index} className="peak-item">
            <div className="peak-time">{peak.time}</div>
            <div className="peak-bar-container">
              <div 
                className="peak-bar"
                style={{ width: `${peak.productivity}%` }}
              />
              <span className="peak-percentage">{peak.productivity}%</span>
            </div>
            <span className={`peak-label ${peak.productivity >= 80 ? 'excellent' : peak.productivity >= 70 ? 'good' : 'average'}`}>
              {peak.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ rec }) {
  const icons = {
    scheduling: '📅',
    wellness: '🧘',
    productivity: '⚡',
    tools: '🛠️',
  };
  
  return (
    <div className="recommendation-card">
      <span className="rec-icon">{icons[rec.type] || '💡'}</span>
      <div className="rec-content">
        <h5>{rec.title}</h5>
        <p>{rec.reason}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, change, changeLabel }) {
  const isPositive = change >= 0;
  
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {change !== undefined && (
        <span className={`stat-change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(change)}% {changeLabel}
        </span>
      )}
    </div>
  );
}

function InsightsPanel({ insightsData: propData, onAction }) {
  const data = propData || MOCK_INSIGHTS;
  const [activeTab, setActiveTab] = useState('patterns'); // patterns, trends, recommendations
  
  const handlePatternAction = (callback, pattern) => {
    onAction?.('pattern', callback, pattern);
    
    // Simulate action
    switch (callback) {
      case 'focusMode':
        alert('Focus mode scheduled for your next work session!');
        break;
      case 'saveSnippet':
        alert('Snippet saved to your library!');
        break;
      default:
        console.log('Action:', callback);
    }
  };

  return (
    <div className="insights-panel">
      {/* Header */}
      <div className="insights-header">
        <div className="insights-title">
          <span className="title-icon">📊</span>
          <h2>Insights</h2>
        </div>
        <span className="insights-subtitle">Based on your last 7 days</span>
      </div>
      
      {/* Stats Row */}
      <div className="insights-stats">
        <StatCard 
          label="Total Hours"
          value={formatHours(data.weeklyTrends.totalHours)}
          change={data.weeklyTrends.comparison.vsLastWeek}
          changeLabel="vs last week"
        />
        <StatCard 
          label="Productive Time"
          value={formatHours(data.weeklyTrends.productiveHours)}
          change={data.weeklyTrends.comparison.vsAverage}
          changeLabel="vs average"
        />
        <StatCard 
          label="Focus Score"
          value={`${data.weeklyTrends.focusScore}%`}
        />
      </div>
      
      {/* Tabs */}
      <div className="insights-tabs">
        <button 
          className={activeTab === 'patterns' ? 'active' : ''}
          onClick={() => setActiveTab('patterns')}
        >
          🔍 Patterns ({data.patterns.length})
        </button>
        <button 
          className={activeTab === 'trends' ? 'active' : ''}
          onClick={() => setActiveTab('trends')}
        >
          📈 Trends
        </button>
        <button 
          className={activeTab === 'recommendations' ? 'active' : ''}
          onClick={() => setActiveTab('recommendations')}
        >
          💡 Tips ({data.recommendations.length})
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="insights-content">
        {activeTab === 'patterns' && (
          <div className="patterns-section">
            <p className="section-intro">
              I noticed these patterns in your work. Addressing them could save you time!
            </p>
            <div className="patterns-grid">
              {data.patterns.map(pattern => (
                <PatternCard 
                  key={pattern.id} 
                  pattern={pattern}
                  onAction={handlePatternAction}
                />
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'trends' && (
          <div className="trends-section">
            <WeeklyChart data={data.weeklyTrends.dailyBreakdown} />
            <div className="trends-split">
              <ProjectBreakdown projects={data.topProjects} />
              <ProductivityPeaks peaks={data.productivityPeaks} />
            </div>
          </div>
        )}
        
        {activeTab === 'recommendations' && (
          <div className="recommendations-section">
            <p className="section-intro">
              Personalized suggestions based on your work patterns
            </p>
            <div className="recommendations-list">
              {data.recommendations.map(rec => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InsightsPanel;
