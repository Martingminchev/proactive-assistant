/**
 * TrayApp Example - Example composition of tray components
 * 
 * This file demonstrates how to use the tray components together
 * to build a complete tray-based UI experience.
 */

import { useState, useCallback } from 'react';
import {
  TrayIcon,
  QuickWindow,
  SuggestionCard,
  CurrentStatus,
  FocusToggle,
  Celebration
} from './index';
import './TrayApp.example.css';

/**
 * Complete tray application example
 */
function TrayAppExample() {
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [suggestions, setSuggestions] = useState([
    {
      id: '1',
      title: 'Take a break',
      description: 'You\'ve been working for 2 hours. Consider a 5-minute walk.',
      timeEstimate: '5 min',
      confidence: 85,
      category: 'break',
      icon: '🧘'
    },
    {
      id: '2',
      title: 'Review PR #234',
      description: 'Pull request waiting for your review in GitHub.',
      timeEstimate: '10 min',
      confidence: 72,
      category: 'task',
      icon: '🔍'
    },
    {
      id: '3',
      title: 'Clear inbox',
      description: '15 unread emails, 3 marked important.',
      timeEstimate: '15 min',
      confidence: 60,
      category: 'email',
      icon: '📧'
    }
  ]);

  // Current status mock data
  const currentStatus = {
    appName: 'VS Code',
    fileName: 'tray-components.jsx',
    timeSpent: '2h 15m',
    flowState: 'flow',
    productivityScore: 87,
    dailyProgressMinutes: 195,
    dailyGoalMinutes: 240
  };

  // Achievements mock data
  const achievements = [
    { id: '1', title: 'Early Bird', description: 'Started work before 8am', icon: '🌅' },
    { id: '2', title: 'Deep Work', description: '4 hours of focused time', icon: '🎯', isNew: true },
    { id: '3', title: 'Streak', description: '7 day productivity streak', icon: '🔥' }
  ];

  // Handle dismiss suggestion
  const handleDismiss = useCallback((id) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  // Handle action on suggestion
  const handleAction = useCallback((id) => {
    console.log('Action on suggestion:', id);
    handleDismiss(id);
  }, [handleDismiss]);

  // Get tray status based on state
  const getTrayStatus = () => {
    if (focusMode) return 'focus';
    if (suggestions.length > 0) return 'suggestion';
    return 'watching';
  };

  return (
    <div className="tray-app-example">
      {/* Tray Icon */}
      <div className="tray-app-example__icon-container">
        <TrayIcon
          status={getTrayStatus()}
          suggestionCount={suggestions.length}
          isOpen={isWindowOpen}
          onClick={() => setIsWindowOpen(!isWindowOpen)}
        />
      </div>

      {/* Quick Window */}
      <QuickWindow
        isOpen={isWindowOpen}
        onClose={() => setIsWindowOpen(false)}
        status={currentStatus}
        suggestions={suggestions.map(s => ({
          ...s,
          onAction: () => handleAction(s.id),
          onDismiss: () => handleDismiss(s.id)
        }))}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode(!focusMode)}
      />

      {/* Example: Full Suggestion Card (shown in expanded view) */}
      {isWindowOpen && (
        <div className="tray-app-example__expanded">
          <h3>Expanded Cards</h3>
          {suggestions.map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              {...suggestion}
              onAction={() => handleAction(suggestion.id)}
              onDismiss={() => handleDismiss(suggestion.id)}
              onSnooze={() => console.log('Snoozed:', suggestion.id)}
            />
          ))}
        </div>
      )}

      {/* Example: Current Status (compact and full) */}
      {isWindowOpen && (
        <div className="tray-app-example__status">
          <h3>Status Variants</h3>
          <div className="tray-app-example__status-row">
            <CurrentStatus
              appName={currentStatus.appName}
              fileName={currentStatus.fileName}
              timeSpentMinutes={135}
              flowState={currentStatus.flowState}
              compact
            />
            <CurrentStatus
              appName={currentStatus.appName}
              fileName={currentStatus.fileName}
              timeSpentMinutes={135}
              flowState={currentStatus.flowState}
              productivityScore={currentStatus.productivityScore}
              dailyProgressMinutes={currentStatus.dailyProgressMinutes}
              dailyGoalMinutes={currentStatus.dailyGoalMinutes}
            />
          </div>
        </div>
      )}

      {/* Example: Focus Toggle */}
      {isWindowOpen && (
        <div className="tray-app-example__focus">
          <h3>Focus Toggle</h3>
          <FocusToggle
            isActive={focusMode}
            onToggle={setFocusMode}
          />
          <div style={{ marginTop: '12px' }}>
            <FocusToggle
              isActive={focusMode}
              onToggle={setFocusMode}
              variant="compact"
            />
          </div>
        </div>
      )}

      {/* Example: Celebrations */}
      {isWindowOpen && (
        <div className="tray-app-example__celebration">
          <h3>Celebrations</h3>
          <Celebration
            streakDays={7}
            streakType={2}
            achievements={achievements}
          />
        </div>
      )}
    </div>
  );
}

export default TrayAppExample;
