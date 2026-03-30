import React, { useState } from 'react';

interface SettingsPanelProps {
  onOpenVscodeSettings: () => void;
}

type NotificationSetting = 'all' | 'suggestions' | 'urgent' | 'none';
type AnalysisDepth = 'minimal' | 'standard' | 'deep';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onOpenVscodeSettings,
}) => {
  // These would ideally come from the extension state
  const [_isDark, _setIsDark] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSetting>('all');
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>('standard');
  const [autoApply, setAutoApply] = useState(false);
  const [showInlineHints, setShowInlineHints] = useState(true);
  const [minConfidence, setMinConfidence] = useState(70);
  const [focusModeSounds, setFocusModeSounds] = useState(true);
  const [celebrations, setCelebrations] = useState(true);

  const handleResetStats = () => {
    if (confirm('Are you sure you want to reset all your statistics?')) {
      // Send message to extension
      window.parent.postMessage(
        { type: 'resetStats' },
        '*'
      );
    }
  };

  const handleExportData = () => {
    window.parent.postMessage(
      { type: 'exportData' },
      '*'
    );
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>
          <i className="codicon codicon-gear" aria-hidden="true" />
          Settings
        </h2>
      </div>

      <div className="settings-content">
        {/* Notifications Section */}
        <section className="settings-section">
          <h3>Notifications</h3>
          <div className="setting-item">
            <label htmlFor="notification-level">Notification Level</label>
            <select
              id="notification-level"
              value={notifications}
              onChange={(e) => setNotifications(e.target.value as NotificationSetting)}
            >
              <option value="all">All notifications</option>
              <option value="suggestions">Suggestions only</option>
              <option value="urgent">Urgent only</option>
              <option value="none">None (silent mode)</option>
            </select>
          </div>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={celebrations}
                onChange={(e) => setCelebrations(e.target.checked)}
              />
              <span>Show celebration animations</span>
            </label>
          </div>
        </section>

        {/* Analysis Section */}
        <section className="settings-section">
          <h3>Analysis</h3>
          <div className="setting-item">
            <label htmlFor="analysis-depth">Analysis Depth</label>
            <select
              id="analysis-depth"
              value={analysisDepth}
              onChange={(e) => setAnalysisDepth(e.target.value as AnalysisDepth)}
            >
              <option value="minimal">Minimal (faster)</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep (thorough)</option>
            </select>
          </div>
          <div className="setting-item">
            <label htmlFor="min-confidence">
              Minimum Confidence ({minConfidence}%)
            </label>
            <input
              id="min-confidence"
              type="range"
              min="50"
              max="95"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
            />
            <span className="setting-hint">
              Only show suggestions with at least this confidence level
            </span>
          </div>
        </section>

        {/* Display Section */}
        <section className="settings-section">
          <h3>Display</h3>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={showInlineHints}
                onChange={(e) => setShowInlineHints(e.target.checked)}
              />
              <span>Show inline code hints</span>
            </label>
          </div>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.target.checked)}
              />
              <span>Auto-apply high-confidence suggestions</span>
            </label>
            <span className="setting-hint warning">
              Only applies to suggestions with 95%+ confidence
            </span>
          </div>
        </section>

        {/* Focus Mode Section */}
        <section className="settings-section">
          <h3>Focus Mode</h3>
          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={focusModeSounds}
                onChange={(e) => setFocusModeSounds(e.target.checked)}
              />
              <span>Play sounds when focus mode starts/ends</span>
            </label>
          </div>
        </section>

        {/* Data Management Section */}
        <section className="settings-section">
          <h3>Data Management</h3>
          <div className="setting-actions">
            <button
              className="action-button secondary"
              onClick={handleExportData}
              title="Export your data"
            >
              <i className="codicon codicon-export" aria-hidden="true" />
              <span>Export Data</span>
            </button>
            <button
              className="action-button danger"
              onClick={handleResetStats}
              title="Reset all statistics"
            >
              <i className="codicon codicon-trash" aria-hidden="true" />
              <span>Reset Stats</span>
            </button>
          </div>
        </section>

        {/* VS Code Settings Link */}
        <section className="settings-section">
          <h3>Advanced</h3>
          <button
            className="action-button secondary full-width"
            onClick={onOpenVscodeSettings}
          >
            <i className="codicon codicon-settings-gear" aria-hidden="true" />
            <span>Open VS Code Settings</span>
          </button>
        </section>
      </div>

      {/* Footer */}
      <div className="settings-footer">
        <p>Proactive AI Assistant v1.0.0</p>
      </div>
    </div>
  );
};

export default SettingsPanel;
