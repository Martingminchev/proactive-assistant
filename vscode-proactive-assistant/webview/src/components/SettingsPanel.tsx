import React, { useCallback } from 'react';
import type { UserSettings, QuietHours, FocusDuration } from '../types';

interface SettingsPanelProps {
  settings: UserSettings | null;
  onUpdate: (settings: UserSettings) => void;
  onExport: () => void;
  onReset: () => void;
}

// Toggle component
const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <label className="setting-toggle">
    <div className="toggle-content">
      <span className="toggle-label">{label}</span>
      {description && <span className="toggle-description">{description}</span>}
    </div>
    <div className="toggle-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="toggle-slider" />
    </div>
  </label>
);

// Slider component
const Slider: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  description?: string;
  valueFormatter?: (value: number) => string;
}> = ({ value, onChange, min, max, step, label, description, valueFormatter }) => (
  <div className="setting-slider">
    <div className="slider-header">
      <span className="slider-label">{label}</span>
      <span className="slider-value">{valueFormatter ? valueFormatter(value) : value}</span>
    </div>
    {description && <span className="slider-description">{description}</span>}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="slider-input"
      aria-label={label}
    />
  </div>
);

// Select component
const Select: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  description?: string;
}> = ({ value, onChange, options, label, description }) => (
  <div className="setting-select">
    <label className="select-label">{label}</label>
    {description && <span className="select-description">{description}</span>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="select-input"
      aria-label={label}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

// Time input component
const TimeInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
}> = ({ value, onChange, label }) => (
  <label className="time-input">
    <span className="time-label">{label}</span>
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="time-field"
      aria-label={label}
    />
  </label>
);

// Section component
const SettingsSection: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <section className="settings-section">
    <h3 className="section-header">
      <span className="section-icon" aria-hidden="true">{icon}</span>
      {title}
    </h3>
    <div className="section-content">
      {children}
    </div>
  </section>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdate,
  onExport,
  onReset
}) => {
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const updateSetting = useCallback(<K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    if (!settings) return;
    onUpdate({ ...settings, [key]: value });
  }, [settings, onUpdate]);

  const updateQuietHours = useCallback((updates: Partial<QuietHours>) => {
    if (!settings) return;
    updateSetting('quietHours', { ...settings.quietHours, ...updates });
  }, [settings, updateSetting]);

  if (!settings) {
    return (
      <div className="settings-panel loading">
        <div className="loading-spinner" />
        <span>Loading settings...</span>
      </div>
    );
  }

  const themeOptions = [
    { value: 'auto', label: 'Auto (follow VS Code)' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' }
  ];

  const focusDurationOptions = [
    { value: '15', label: '15 minutes' },
    { value: '25', label: '25 minutes (Pomodoro)' },
    { value: '45', label: '45 minutes' },
    { value: '60', label: '60 minutes' }
  ];

  return (
    <div className="settings-panel">
      {/* General Settings */}
      <SettingsSection title="General" icon="⚙️">
        <Toggle
          checked={settings.enabled}
          onChange={(checked) => updateSetting('enabled', checked)}
          label="Enable Proactive AI"
          description="Show intelligent suggestions as you code"
        />

        <Toggle
          checked={settings.showCelebrations}
          onChange={(checked) => updateSetting('showCelebrations', checked)}
          label="Show Celebrations"
          description="Celebrate achievements and streaks"
        />

        <Toggle
          checked={settings.trackStats}
          onChange={(checked) => updateSetting('trackStats', checked)}
          label="Track Statistics"
          description="Track your productivity metrics"
        />
      </SettingsSection>

      {/* Suggestion Settings */}
      <SettingsSection title="Suggestions" icon="💡">
        <Slider
          value={settings.suggestionThreshold}
          onChange={(value) => updateSetting('suggestionThreshold', value)}
          min={0.1}
          max={0.9}
          step={0.1}
          label="Confidence Threshold"
          description="Minimum confidence level for suggestions"
          valueFormatter={(v) => `${Math.round(v * 100)}%`}
        />

        <Toggle
          checked={settings.autoApplyLowRisk}
          onChange={(checked) => updateSetting('autoApplyLowRisk', checked)}
          label="Auto-apply Low-risk Changes"
          description="Automatically apply suggestions with 90%+ confidence"
        />
      </SettingsSection>

      {/* Quiet Hours */}
      <SettingsSection title="Quiet Hours" icon="🔕">
        <Toggle
          checked={settings.quietHours.enabled}
          onChange={(checked) => updateQuietHours({ enabled: checked })}
          label="Enable Quiet Hours"
          description="Pause non-urgent suggestions during these hours"
        />

        {settings.quietHours.enabled && (
          <div className="quiet-hours-times">
            <TimeInput
              label="Start"
              value={settings.quietHours.start}
              onChange={(value) => updateQuietHours({ start: value })}
            />
            <span className="time-separator">to</span>
            <TimeInput
              label="End"
              value={settings.quietHours.end}
              onChange={(value) => updateQuietHours({ end: value })}
            />
          </div>
        )}
      </SettingsSection>

      {/* Focus Mode */}
      <SettingsSection title="Focus Mode" icon="🎯">
        <Select
          label="Default Duration"
          description="Default focus session length"
          value={String(settings.focusModeDefault)}
          onChange={(value) => updateSetting('focusModeDefault', parseInt(value, 10) as FocusDuration)}
          options={focusDurationOptions}
        />
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="Appearance" icon="🎨">
        <Select
          label="Theme"
          value={settings.theme}
          onChange={(value) => updateSetting('theme', value as UserSettings['theme'])}
          options={themeOptions}
        />
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection title="Data" icon="💾">
        <div className="data-actions">
          <button
            className="data-button secondary"
            onClick={onExport}
            aria-label="Export your data"
          >
            <span className="button-icon">📤</span>
            Export Data
          </button>

          {!showResetConfirm ? (
            <button
              className="data-button danger"
              onClick={() => setShowResetConfirm(true)}
              aria-label="Reset all data"
            >
              <span className="button-icon">🗑️</span>
              Reset All Data
            </button>
          ) : (
            <div className="reset-confirm">
              <span className="confirm-text">Are you sure?</span>
              <div className="confirm-buttons">
                <button
                  className="confirm-btn cancel"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="confirm-btn confirm"
                  onClick={onReset}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Footer info */}
      <footer className="settings-footer">
        <p>Proactive AI Assistant v1.0.0</p>
        <p>Powered by Pieces OS</p>
      </footer>
    </div>
  );
};

export default SettingsPanel;
