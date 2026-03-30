import { useState, useEffect } from 'react';
import './Settings.css';

const API_BASE = 'http://localhost:3001/api';

function Settings({ settings: initialSettings, onBack, onSave }) {
  const [settings, setSettings] = useState(initialSettings || {});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [scheduleOptions, setScheduleOptions] = useState(null);
  const [piecesStatus, setPiecesStatus] = useState(null);
  const [showApiKeys, setShowApiKeys] = useState({});
  const [tempApiKeys, setTempApiKeys] = useState({});
  const [validatingKey, setValidatingKey] = useState(null);

  useEffect(() => {
    fetchScheduleOptions();
    testPiecesConnection();
  }, []);

  const fetchScheduleOptions = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings/schedule-options`);
      const data = await response.json();
      setScheduleOptions(data);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const testPiecesConnection = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings/test-pieces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: settings.piecesPort || 39300 })
      });
      const data = await response.json();
      setPiecesStatus(data);
    } catch (error) {
      setPiecesStatus({ connected: false, message: 'Failed to test connection' });
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaveMessage(null);
  };

  const handleApiKeyChange = (key, value) => {
    setTempApiKeys(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Merge temp API keys into settings if they were changed
      const updatedSettings = { ...settings };
      if (tempApiKeys.zaiApiKey) updatedSettings.zaiApiKey = tempApiKeys.zaiApiKey;
      if (tempApiKeys.geminiApiKey) updatedSettings.geminiApiKey = tempApiKeys.geminiApiKey;
      if (tempApiKeys.newsApiKey) updatedSettings.newsApiKey = tempApiKeys.newsApiKey;

      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });

      const data = await response.json();
      setSettings(data);
      setTempApiKeys({});
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      if (onSave) onSave();
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const validateApiKey = async (provider, keyField) => {
    const key = tempApiKeys[keyField] || settings[keyField];
    if (!key || key.includes('••••')) {
      setSaveMessage({ type: 'error', text: 'Enter a valid API key first' });
      return;
    }

    setValidatingKey(provider);
    try {
      const response = await fetch(`${API_BASE}/settings/validate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key })
      });
      const data = await response.json();
      setSaveMessage({
        type: data.valid ? 'success' : 'error',
        text: data.message
      });
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to validate key' });
    } finally {
      setValidatingKey(null);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/settings/reset`, { method: 'POST' });
      const data = await response.json();
      setSettings(data);
      setTempApiKeys({});
      setSaveMessage({ type: 'success', text: 'Settings reset to defaults' });
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to reset settings' });
    }
  };

  const getProviderLabel = (value) => {
    const provider = scheduleOptions?.providers?.find(p => p.value === value);
    return provider?.label || value;
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>Settings</h1>
        <button 
          className="save-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {saveMessage && (
        <div className={`save-message ${saveMessage.type}`}>
          {saveMessage.text}
        </div>
      )}

      <div className="settings-content">
        {/* AI Provider Section */}
        <section className="settings-section">
          <h2>AI Provider</h2>
          <p className="section-description">Choose which AI service generates your recommendations.</p>

          <div className="setting-group">
            <label>Provider</label>
            <div className="provider-options">
              {scheduleOptions?.providers?.map(provider => (
                <button
                  key={provider.value}
                  className={`provider-option ${settings.aiProvider === provider.value ? 'active' : ''}`}
                  onClick={() => handleChange('aiProvider', provider.value)}
                >
                  <strong>{provider.label}</strong>
                  <span>{provider.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* z.ai Settings */}
          {settings.aiProvider === 'zai' && (
            <div className="provider-settings">
              <div className="setting-group">
                <label>z.ai API Key</label>
                <div className="api-key-input">
                  <input
                    type={showApiKeys.zai ? 'text' : 'password'}
                    value={tempApiKeys.zaiApiKey ?? settings.zaiApiKey ?? ''}
                    onChange={(e) => handleApiKeyChange('zaiApiKey', e.target.value)}
                    placeholder="Enter your z.ai API key"
                  />
                  <button 
                    className="toggle-visibility"
                    onClick={() => setShowApiKeys(prev => ({ ...prev, zai: !prev.zai }))}
                  >
                    {showApiKeys.zai ? '🙈' : '👁️'}
                  </button>
                  <button 
                    className="validate-btn"
                    onClick={() => validateApiKey('zai', 'zaiApiKey')}
                    disabled={validatingKey === 'zai'}
                  >
                    {validatingKey === 'zai' ? '...' : 'Test'}
                  </button>
                </div>
                <span className="setting-hint">Get your key at <a href="https://z.ai/manage-apikey/apikey-list" target="_blank" rel="noopener noreferrer">z.ai</a></span>
              </div>
              <div className="setting-group">
                <label>Model</label>
                <select 
                  value={settings.zaiModel || 'glm-4.7'}
                  onChange={(e) => handleChange('zaiModel', e.target.value)}
                >
                  <option value="glm-4.7">GLM-4.7 (Recommended)</option>
                  <option value="glm-4">GLM-4</option>
                </select>
              </div>
            </div>
          )}

          {/* Gemini Settings */}
          {settings.aiProvider === 'gemini' && (
            <div className="provider-settings">
              <div className="setting-group">
                <label>Gemini API Key</label>
                <div className="api-key-input">
                  <input
                    type={showApiKeys.gemini ? 'text' : 'password'}
                    value={tempApiKeys.geminiApiKey ?? settings.geminiApiKey ?? ''}
                    onChange={(e) => handleApiKeyChange('geminiApiKey', e.target.value)}
                    placeholder="Enter your Gemini API key"
                  />
                  <button 
                    className="toggle-visibility"
                    onClick={() => setShowApiKeys(prev => ({ ...prev, gemini: !prev.gemini }))}
                  >
                    {showApiKeys.gemini ? '🙈' : '👁️'}
                  </button>
                  <button 
                    className="validate-btn"
                    onClick={() => validateApiKey('gemini', 'geminiApiKey')}
                    disabled={validatingKey === 'gemini'}
                  >
                    {validatingKey === 'gemini' ? '...' : 'Test'}
                  </button>
                </div>
                <span className="setting-hint">Get your key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></span>
              </div>
              <div className="setting-group">
                <label>Model</label>
                <select 
                  value={settings.geminiModel || 'gemini-2.5-flash'}
                  onChange={(e) => handleChange('geminiModel', e.target.value)}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {/* Generation Settings */}
        <section className="settings-section">
          <h2>Generation Settings</h2>
          <p className="section-description">Configure when and how briefs are generated.</p>

          <div className="setting-group">
            <label>Schedule</label>
            <select 
              value={settings.briefSchedule || '0 8 * * *'}
              onChange={(e) => handleChange('briefSchedule', e.target.value)}
            >
              {scheduleOptions?.schedules?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="setting-group">
            <label>Auto-generate</label>
            <div className="toggle-setting">
              <span>Automatically generate briefs on schedule</span>
              <button
                className={`toggle-btn ${settings.autoGenerate ? 'active' : ''}`}
                onClick={() => handleChange('autoGenerate', !settings.autoGenerate)}
              >
                {settings.autoGenerate ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label>History Depth</label>
            <select 
              value={settings.historyDepth || '7days'}
              onChange={(e) => handleChange('historyDepth', e.target.value)}
            >
              {scheduleOptions?.historyDepths?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="setting-hint">How far back to analyze your activity</span>
          </div>

          <div className="setting-group">
            <label>Max Recommendations</label>
            <input
              type="number"
              min="3"
              max="15"
              value={settings.maxRecommendations || 7}
              onChange={(e) => handleChange('maxRecommendations', parseInt(e.target.value))}
            />
            <span className="setting-hint">Number of recommendations per brief (3-15)</span>
          </div>
        </section>

        {/* Pieces OS Section */}
        <section className="settings-section">
          <h2>Pieces OS</h2>
          <p className="section-description">Configure connection to Pieces for Developers.</p>

          <div className="setting-group">
            <label>Status</label>
            <div className={`pieces-status ${piecesStatus?.connected ? 'connected' : 'disconnected'}`}>
              <span className="status-indicator"></span>
              <span>{piecesStatus?.message || 'Checking...'}</span>
              <button className="refresh-btn" onClick={testPiecesConnection}>
                Refresh
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label>Port</label>
            <input
              type="number"
              value={settings.piecesPort || 39300}
              onChange={(e) => handleChange('piecesPort', parseInt(e.target.value))}
            />
            <span className="setting-hint">Default: 39300 (Windows/Mac), 5323 (Linux)</span>
          </div>

          <div className="setting-group">
            <label>Use Pieces Summary</label>
            <div className="toggle-setting">
              <span>Use Pieces to pre-summarize context before AI</span>
              <button
                className={`toggle-btn ${settings.usePiecesSummary ? 'active' : ''}`}
                onClick={() => handleChange('usePiecesSummary', !settings.usePiecesSummary)}
              >
                {settings.usePiecesSummary ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </section>

        {/* Proactive Assistant */}
        <section className="settings-section">
          <h2>Proactive Assistant</h2>
          <p className="section-description">Configure real-time suggestion behavior.</p>

          <div className="setting-group">
            <label>Enable Proactive Suggestions</label>
            <div className="toggle-setting">
              <span>Show real-time suggestions based on your activity</span>
              <button
                className={`toggle-btn ${settings.proactiveEnabled ? 'active' : ''}`}
                onClick={() => handleChange('proactiveEnabled', !settings.proactiveEnabled)}
              >
                {settings.proactiveEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label>Check Interval (minutes)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.proactiveInterval || 5}
              onChange={(e) => handleChange('proactiveInterval', parseInt(e.target.value))}
            />
            <span className="setting-hint">How often to check for new suggestions (1-60 min)</span>
          </div>
        </section>

        {/* Appearance */}
        <section className="settings-section">
          <h2>Appearance</h2>
          <div className="setting-group">
            <label>Theme</label>
            <div className="theme-options">
              {scheduleOptions?.themes?.map(theme => (
                <button
                  key={theme.value}
                  className={`theme-option ${settings.theme === theme.value ? 'active' : ''}`}
                  onClick={() => handleChange('theme', theme.value)}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="settings-section danger">
          <h2>Danger Zone</h2>
          <button className="reset-btn" onClick={handleReset}>
            Reset All Settings
          </button>
        </section>
      </div>
    </div>
  );
}

export default Settings;
