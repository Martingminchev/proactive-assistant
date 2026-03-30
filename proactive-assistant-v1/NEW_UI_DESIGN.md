# 🎯 Proactive AI Assistant - New Minimalist UI Design

> **Vision**: An ambient, intelligent companion that lives in the background and surfaces only when needed - like a thoughtful colleague, not a demanding dashboard.

---

## 📋 Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Visual Design System](#2-visual-design-system)
3. [Component Specifications](#3-component-specifications)
4. [Interaction Flows](#4-interaction-flows)
5. [React Component Architecture](#5-react-component-architecture)
6. [Electron/Tray App Architecture](#6-electrontray-app-architecture)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Design Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Invisible until needed** | Lives in system tray, doesn't steal focus |
| **Context-aware** | Shows relevant help based on what user is doing |
| **Non-intrusive** | Notifications are gentle, dismissible |
| **Fast actions** | One-click to act, no navigation |
| **Delightful micro-moments** | Celebrate wins without interruption |

### From Dashboard to Ambient

```
OLD WAY                          NEW WAY
─────────────────────────────────────────────────────
┌─────────────────────────┐      💤 (tray icon)
│  📊 Dashboard           │         ↓
│  ┌─────────────────┐   │      User stuck for 5min
│  │ Today's Brief   │   │         ↓
│  │ ┌───┐ ┌───┐    │   │      🔔 "Need help with auth?"
│  │ │ A │ │ B │    │   │         ↓
│  │ └───┘ └───┘    │   │      [Show Solution] [Dismiss]
│  └─────────────────┘   │
│  Tabs: Today | History │
└─────────────────────────┘
  ↑ Must actively check      ↑ Contextually surfaces
```

---

## 2. Visual Design System

### 2.1 Color Palette

#### State Colors

```css
/* Tray Icon States */
--state-watching:    #64748b;    /* Slate 500 - subtle gray */
--state-active:      #3b82f6;    /* Blue 500 - has suggestion */
--state-urgent:      #f59e0b;    /* Amber 500 - needs attention */
--state-critical:    #ef4444;    /* Red 500 - stuck for long */
--state-success:     #10b981;    /* Emerald 500 - task complete */
--state-celebration: #8b5cf6;    /* Violet 500 - achievement */

/* Notification Types */
--notif-help:        #3b82f6;    /* Blue - help offered */
--notif-recovery:    #f59e0b;    /* Amber - context recovery */
--notif-wellness:    #10b981;    /* Green - break reminder */
--notif-achievement: #8b5cf6;    /* Purple - celebration */
--notif-info:        #64748b;    /* Gray - general info */

/* UI Colors */
--bg-primary:        #0f172a;    /* Slate 900 - quick window bg */
--bg-secondary:      #1e293b;    /* Slate 800 - cards */
--bg-hover:          #334155;    /* Slate 700 - hover state */
--text-primary:      #f8fafc;    /* Slate 50 */
--text-secondary:    #94a3b8;    /* Slate 400 */
--text-muted:        #64748b;    /* Slate 500 */
--border-subtle:     #334155;    /* Slate 700 */
--accent-glow:       rgba(59, 130, 246, 0.3);  /* Blue glow */
```

#### Progress Ring Colors

```css
/* Progress indicators around tray icon */
--progress-low:      #ef4444;    /* 0-33% */
--progress-medium:   #f59e0b;    /* 34-66% */
--progress-high:     #10b981;    /* 67-100% */
--progress-glow:     rgba(16, 185, 129, 0.5);
```

### 2.2 Typography

```css
/* Font Stack */
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;

/* Type Scale */
--text-xs:   11px;  /* Labels, timestamps */
--text-sm:   12px;  /* Secondary text */
--text-base: 13px;  /* Body text */
--text-lg:   14px;  /* Emphasis */
--text-xl:   16px;  /* Headlines */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
```

### 2.3 Iconography

#### System Tray Icons (16x16 template)

```
STATES:
┌─────────────┬─────────────────────────────────────┐
│ State       │ Visual                              │
├─────────────┼─────────────────────────────────────┤
│ Watching    │ ◉  Subtle pulse animation           │
│             │    Color: --state-watching          │
├─────────────┼─────────────────────────────────────┤
│ Active      │ ◉  Solid, no pulse                  │
│             │    Color: --state-active            │
├─────────────┼─────────────────────────────────────┤
│ Urgent      │ ◉  Faster pulse                     │
│             │    Color: --state-urgent            │
├─────────────┼─────────────────────────────────────┤
│ Critical    │ ◉  Fast pulse + subtle bounce       │
│             │    Color: --state-critical          │
├─────────────┼─────────────────────────────────────┤
│ Success     │ ✓  Checkmark overlay                │
│             │    Color: --state-success           │
├─────────────┼─────────────────────────────────────┤
│ Achievement │ ★  Star overlay                     │
│             │    Color: --state-celebration       │
└─────────────┴─────────────────────────────────────┘
```

#### Quick Window Icons

```
UI Icons (16px):
├── 📍 focus-mode     - Focus/target icon
├── 📋 generate       - Document/sparkles
├── ⚙️  settings      - Gear
├── ✕  dismiss       - X mark
├── →  arrow         - Chevron right
├── 🔥 streak         - Fire
├── ⏱️  time           - Clock
├── 💡 suggestion     - Lightbulb
└── 🎯 goal           - Target
```

### 2.4 Animations & Micro-interactions

#### Tray Icon Animations

```css
/* Watching - Subtle Breath */
@keyframes breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
.tray-watching { animation: breathe 3s ease-in-out infinite; }

/* Active - Gentle Pulse */
@keyframes pulse-gentle {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0); }
}
.tray-active { animation: pulse-gentle 2s ease-in-out infinite; }

/* Urgent - Faster Pulse */
@keyframes pulse-urgent {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
}
.tray-urgent { animation: pulse-urgent 1s ease-in-out infinite; }

/* Critical - Bounce + Pulse */
@keyframes bounce-pulse {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-2px); }
  50% { transform: translateY(0); }
  75% { transform: translateY(-1px); }
}
.tray-critical { animation: bounce-pulse 0.8s ease-in-out infinite; }

/* Success - Pop */
@keyframes pop {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
.tray-success { animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
```

#### Progress Ring Animation

```css
/* Progress ring around tray icon */
.progress-ring {
  transition: stroke-dashoffset 0.5s ease-out;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}

.progress-ring.complete {
  animation: progress-glow 1s ease-out;
}

@keyframes progress-glow {
  0% { filter: drop-shadow(0 0 0 transparent); }
  50% { filter: drop-shadow(0 0 8px var(--progress-glow)); }
  100% { filter: drop-shadow(0 0 0 transparent); }
}
```

#### Window Transitions

```css
/* Quick window open/close */
.quick-window {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
  transform-origin: top center;
}

.quick-window.enter {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.quick-window.enter-active {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.quick-window.exit {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.quick-window.exit-active {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}
```

---

## 3. Component Specifications

### 3.1 System Tray Icon

```javascript
// Tray Icon Component Props
interface TrayIconProps {
  state: 'watching' | 'active' | 'urgent' | 'critical' | 'success' | 'achievement';
  progress?: number;        // 0-100 for task progress
  streak?: number;          // Current streak count
  hasNotification?: boolean;
}
```

**Visual States:**

```
Normal (16x16px macOS, varies on Windows/Linux):
┌────────────┐
│  ┌──────┐  │
│  │  ◉   │  │  ← Solid circle with state color
│  └──────┘  │
└────────────┘

With Progress Ring:
┌────────────┐
│  ╭──────╮  │
│  │ ╭──╮ │  │  ← Ring shows progress
│  │ │◉ │ │  │  ← Fill color based on progress %
│  │ ╰──╯ │  │
│  ╰──────╯  │
└────────────┘

With Streak:
┌────────────┐
│  ┌──────┐  │
│  │  ◉   │  │
│  │ 🔥12  │  │  ← Small fire icon + count
│  └──────┘  │
└────────────┘
```

### 3.2 Notification Templates

#### Stuck Detection Notification

```javascript
{
  id: 'stuck-help-001',
  type: 'help',
  title: 'Stuck on auth.ts?',
  body: 'I noticed you\'ve been on this file for 15 minutes. Need help?',
  actions: [
    { id: 'show-solution', title: '💡 Show Solution' },
    { id: 'dismiss', title: 'Dismiss' }
  ],
  silent: false,
  timeout: 30000  // Auto-dismiss after 30s
}
```

**Visual:**
```
┌─────────────────────────────────────────┐
│ 🔔 Proactive Assistant          [✕]    │
├─────────────────────────────────────────┤
│                                         │
│  Stuck on auth.ts?                      │
│                                         │
│  I noticed you've been on this file     │
│  for 15 minutes. Need help?             │
│                                         │
│  [💡 Show Solution]    [Dismiss]        │
│                                         │
└─────────────────────────────────────────┘
```

#### Context Recovery Notification

```javascript
{
  id: 'recovery-001',
  type: 'recovery',
  title: 'Continue where you left off?',
  body: 'Yesterday you were working on the API integration. Pick up there?',
  actions: [
    { id: 'open-files', title: '📂 Open Files' },
    { id: 'show-summary', title: 'Show Summary' },
    { id: 'dismiss', title: 'Dismiss' }
  ],
  silent: true
}
```

#### Wellness Notification

```javascript
{
  id: 'wellness-001',
  type: 'wellness',
  title: 'Time for a break?',
  body: 'You\'ve been coding for 2 hours straight. A 5-min walk could help!',
  actions: [
    { id: 'remind-later', title: 'Remind in 15min' },
    { id: 'snooze', title: 'Snooze' }
  ],
  silent: true
}
```

#### Achievement Notification

```javascript
{
  id: 'achievement-001',
  type: 'achievement',
  title: '🎉 You shipped 3 features today!',
  body: 'That\'s a new personal record. You\'re on fire! 🔥',
  actions: [
    { id: 'view-stats', title: 'View Stats' },
    { id: 'dismiss', title: 'Nice!' }
  ],
  silent: false  // Play celebration sound
}
```

### 3.3 Quick Action Window

**Dimensions:**
- Width: 320px
- Height: Auto (max 400px, scrollable)
- Border radius: 12px
- Shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5)

**Layout:**
```
┌─────────────────────────────────────┐  ← 320px
│  Status Bar                         │
│  👁  Watching you work on auth.ts   │
├─────────────────────────────────────┤
│  Recent Suggestions                 │
│  ┌───────────────────────────────┐ │
│  │ 💡 Add error handling...   ✕  │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 📰 New React patterns...   ✕  │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 🎯 Try using useReducer... ✕  │ │
│  └───────────────────────────────┘ │
├─────────────────────────────────────┤
│  Quick Actions                      │
│  [🔒 Focus] [📋 Brief] [⚙️ Settings] │
├─────────────────────────────────────┤
│  Stats (subtle)                     │
│  🔥 5-day streak    ⚡ 12 insights  │
└─────────────────────────────────────┘
```

**Component Structure:**
```jsx
<QuickWindow>
  <StatusBar 
    currentFile="auth.ts"
    state="watching"
    timeSpent="15min"
  />
  
  <SuggestionsList>
    {suggestions.map(s => (
      <SuggestionCard 
        key={s.id}
        type={s.type}
        title={s.title}
        onDismiss={() => dismiss(s.id)}
        onClick={() => showDetail(s)}
      />
    ))}
  </SuggestionsList>
  
  <QuickActions>
    <ActionButton icon="🔒" label="Focus Mode" onClick={enableFocus} />
    <ActionButton icon="📋" label="Generate Brief" onClick={generateBrief} />
    <ActionButton icon="⚙️" label="Settings" onClick={openSettings} />
  </QuickActions>
  
  <MiniStats streak={5} insights={12} />
</QuickWindow>
```

### 3.4 Inline Suggestion Style

For VS Code extension or overlay:

```
Editor View:
┌─────────────────────────────────────────────────┐
│ 1  │ function authenticateUser(token) {         │
│ 2  │   const decoded = jwt.decode(token);       │
│ 3  │   ┌────────────────────────────────────┐   │
│ 4  │   │ 💡 Add validation?               │   │
│ 5  │   │ if (!decoded) throw new Error()  │   │
│ 6  │   │ [Accept] [View More] [Dismiss]   │   │
│ 7  │   └────────────────────────────────────┘   │
│ 8  │   return decoded;                          │
│ 9  │ }                                          │
└─────────────────────────────────────────────────┘
```

**Styling:**
```css
.inline-suggestion {
  background: rgba(59, 130, 246, 0.1);
  border-left: 3px solid var(--state-active);
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 0 6px 6px 0;
  font-size: 12px;
  font-family: var(--font-mono);
}

.inline-suggestion::before {
  content: '💡';
  margin-right: 8px;
}
```

### 3.5 Celebration Micro-interaction

**Task Complete Animation:**
```
Tray icon transforms:
1. Progress ring fills to 100%
2. Ring glows with success color
3. Icon morphs to checkmark
4. Small confetti burst (subtle)
5. Returns to watching state after 3s
```

```css
.celebration {
  animation: celebrate 3s ease-out forwards;
}

@keyframes celebrate {
  0% { 
    transform: scale(1);
    filter: drop-shadow(0 0 0 transparent);
  }
  20% { 
    transform: scale(1.3);
    filter: drop-shadow(0 0 20px var(--state-success));
  }
  40% { 
    transform: scale(1.1);
  }
  60% { 
    transform: scale(1.2);
    filter: drop-shadow(0 0 10px var(--state-success));
  }
  100% { 
    transform: scale(1);
    filter: drop-shadow(0 0 0 transparent);
  }
}
```

---

## 4. Interaction Flows

### 4.1 User Clicks Tray Icon

```
User Action                    System Response
─────────────────────────────────────────────────────────────
Click tray icon        →       Check if window is open
                                     ↓
                         ┌───────────────────────────┐
                         │ Window Open?              │
                         └─────────────┬─────────────┘
                               YES │     │ NO
                                   ↓     ↓
                              Close   Open
                              Window  Window
                                        ↓
                                   Fetch latest
                                   suggestions
                                        ↓
                                   Position window
                                   near tray icon
                                        ↓
                                   Fade in with
                                   scale animation
```

**Edge Cases:**
- If screen edge would clip window, reposition to fit
- If user clicks outside window, auto-close after 300ms
- If notification is showing, don't auto-close window

### 4.2 AI Detects User Stuck

```
Detection Flow:
─────────────────────────────────────────────────────────────
Pieces OS Activity Stream
         ↓
┌─────────────────┐
│ Monitor: Track  │  ← Every 30s
│ file changes    │
│ focus time      │
│ cursor activity │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Detect: No file │
│ change for 5min │
│ on same file    │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Analyze: Check  │
│ if file has     │
│ errors, git     │
│ state, etc.     │
└────────┬────────┘
         ↓
┌─────────────────┐     ┌─────────────────────────────┐
│ Decision:       │────→│ Send notification           │
│ Stuck detected! │     │ - Gentle tone               │
└─────────────────┘     │ - Offer help, don't demand  │
                        │ - 30s auto-dismiss          │
                        └─────────────────────────────┘
                                    ↓
                        User clicks "Show Solution"
                                    ↓
                        ┌─────────────────────────────┐
                        │ Generate contextual help    │
                        │ using Pieces Copilot        │
                        └─────────────────────────────┘
                                    ↓
                        Show in:
                        • Inline (if editor focused)
                        • Quick window (if tray clicked)
                        • Notification expansion
```

### 4.3 User Dismisses Suggestion

```
Dismiss Flow:
─────────────────────────────────────────────────────────────
User clicks ✕ on suggestion
         ↓
┌──────────────────────────┐
│ 1. Animate card out      │  ← Slide right + fade
│    (200ms)               │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│ 2. Remove from state     │
│    Update localStorage   │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│ 3. Track: "dismissed"    │  ← Learn preferences
│    suggestion_id         │
│    timestamp             │
│    context               │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│ 4. If all dismissed:     │
│    Show "All caught up!" │
│    micro-message         │
└──────────────────────────┘
```

### 4.4 Context Recovery Flow

```
Startup Detection:
─────────────────────────────────────────────────────────────
App Starts
    ↓
┌─────────────────────────┐
│ Check: Is this first    │
│ launch today?           │
└───────────┬─────────────┘
        YES │    │ NO
            ↓    ↓
    ┌───────────┐  ┌────────────────┐
    │ Fetch     │  │ Resume normal  │
    │ yesterday's│  │ watching       │
    │ activity   │  └────────────────┘
    └─────┬─────┘
          ↓
┌─────────────────────────┐
│ Identify: Last files    │
│ worked on, commit       │
│ messages, time spent    │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Generate recovery       │
│ suggestion              │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Show gentle notification│
│ "Continue where you     │
│  left off?"             │
└─────────────────────────┘
```

### 4.5 Daily Brief Generation

```
Scheduled Flow:
─────────────────────────────────────────────────────────────
8:00 AM trigger
       ↓
┌─────────────────────────┐
│ Generate brief via      │
│ Pieces Copilot          │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Store in database       │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Show notification:      │
│ "Your daily brief is    │
│  ready"                 │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Update tray icon:       │
│ Brief ready badge       │
└───────────┬─────────────┘
            ↓
User clicks tray
       ↓
┌─────────────────────────┐
│ Show brief summary in   │
│ quick window            │
│ [Read Full Brief] btn   │
└─────────────────────────┘
```

---

## 5. React Component Architecture

### 5.1 Component Hierarchy

```
App (Electron main)
│
├── TrayManager
│   ├── TrayIcon (with progress ring)
│   └── TrayMenu
│
├── QuickWindow
│   ├── StatusBar
│   │   ├── CurrentActivity
│   │   └── ConnectionStatus
│   ├── SuggestionsList
│   │   └── SuggestionCard (×3)
│   ├── QuickActions
│   │   ├── FocusModeButton
│   │   ├── GenerateBriefButton
│   │   └── SettingsButton
│   └── MiniStats
│       ├── StreakIndicator
│       └── InsightsCounter
│
├── NotificationManager
│   └── NativeNotification
│
├── BriefWindow (separate, for full brief)
│   ├── BriefHeader
│   ├── RecommendationsList
│   └── BriefFooter
│
└── SettingsWindow
    ├── GeneralSettings
    ├── NotificationPreferences
    └── AdvancedSettings
```

### 5.2 State Management

```javascript
// Global App State (using React Context + useReducer)
const initialState = {
  // Tray State
  tray: {
    state: 'watching',        // watching | active | urgent | critical | success
    progress: 0,              // 0-100 task progress
    streak: 0,                // Current streak days
    hasUnreadBrief: false,    // Daily brief ready
  },
  
  // Activity State
  activity: {
    currentFile: null,
    currentProject: null,
    timeSpent: 0,             // seconds on current file
    lastActivity: null,       // timestamp
    isStuck: false,
  },
  
  // Suggestions State
  suggestions: {
    items: [],                // Last 3 suggestions
    dismissed: [],            // IDs of dismissed
    unreadCount: 0,
  },
  
  // Brief State
  brief: {
    today: null,              // Today's brief data
    history: [],              // Last 7 days
    loading: false,
  },
  
  // UI State
  ui: {
    quickWindowOpen: false,
    briefWindowOpen: false,
    settingsOpen: false,
    focusMode: false,
  },
  
  // Settings
  settings: {
    notifications: {
      stuckDetection: true,
      wellness: true,
      achievements: true,
      dailyBrief: true,
    },
    thresholds: {
      stuckMinutes: 5,
      wellnessInterval: 120,  // minutes
    },
    focusMode: {
      enabled: false,
      allowUrgent: true,
    }
  }
};
```

### 5.3 Key Components

#### TrayIcon Component

```jsx
// components/TrayIcon.jsx
import React from 'react';
import './TrayIcon.css';

const TrayIcon = ({ state, progress, streak, hasNotification }) => {
  const getStateColor = () => {
    const colors = {
      watching: '#64748b',
      active: '#3b82f6',
      urgent: '#f59e0b',
      critical: '#ef4444',
      success: '#10b981',
      achievement: '#8b5cf6',
    };
    return colors[state] || colors.watching;
  };

  const circumference = 2 * Math.PI * 12; // r=12
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className={`tray-icon tray-${state}`}>
      {/* Progress ring background */}
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="#334155"
        strokeWidth="2"
      />
      
      {/* Progress ring */}
      {progress > 0 && (
        <circle
          cx="16"
          cy="16"
          r="12"
          fill="none"
          stroke={getProgressColor(progress)}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="progress-ring"
        />
      )}
      
      {/* Main icon */}
      <circle
        cx="16"
        cy="16"
        r="8"
        fill={getStateColor()}
        className="tray-main-icon"
      />
      
      {/* Streak badge */}
      {streak > 0 && (
        <g transform="translate(18, 18)">
          <circle cx="0" cy="0" r="6" fill="#ef4444" />
          <text x="0" y="2" textAnchor="middle" fill="white" fontSize="8">
            🔥
          </text>
        </g>
      )}
      
      {/* Notification dot */}
      {hasNotification && (
        <circle cx="26" cy="6" r="4" fill="#ef4444" />
      )}
    </svg>
  );
};

export default TrayIcon;
```

#### QuickWindow Component

```jsx
// components/QuickWindow.jsx
import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import StatusBar from './StatusBar';
import SuggestionsList from './SuggestionsList';
import QuickActions from './QuickActions';
import MiniStats from './MiniStats';
import './QuickWindow.css';

const QuickWindow = () => {
  const { state, actions } = useApp();
  const windowRef = useRef(null);
  
  // Position window near tray icon
  useEffect(() => {
    if (state.ui.quickWindowOpen && windowRef.current) {
      const trayBounds = window.electronAPI.getTrayBounds();
      const windowBounds = windowRef.current.getBoundingClientRect();
      
      // Position above tray on macOS, below on Windows
      const isMac = navigator.platform.includes('Mac');
      const x = trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2);
      const y = isMac 
        ? trayBounds.y - windowBounds.height - 8
        : trayBounds.y + trayBounds.height + 8;
      
      // Ensure window stays on screen
      const screenBounds = window.electronAPI.getScreenBounds();
      const finalX = Math.max(8, Math.min(x, screenBounds.width - windowBounds.width - 8));
      const finalY = Math.max(8, Math.min(y, screenBounds.height - windowBounds.height - 8));
      
      window.electronAPI.setWindowPosition(finalX, finalY);
    }
  }, [state.ui.quickWindowOpen]);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (windowRef.current && !windowRef.current.contains(e.target)) {
        actions.closeQuickWindow();
      }
    };
    
    if (state.ui.quickWindowOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [state.ui.quickWindowOpen]);
  
  if (!state.ui.quickWindowOpen) return null;
  
  return (
    <div 
      ref={windowRef}
      className={`quick-window ${state.ui.quickWindowOpen ? 'enter-active' : 'exit-active'}`}
    >
      <StatusBar 
        currentFile={state.activity.currentFile}
        timeSpent={state.activity.timeSpent}
        state={state.tray.state}
      />
      
      <SuggestionsList 
        suggestions={state.suggestions.items}
        onDismiss={actions.dismissSuggestion}
        onClick={actions.showSuggestionDetail}
      />
      
      <QuickActions 
        onFocusMode={actions.toggleFocusMode}
        onGenerateBrief={actions.generateBrief}
        onSettings={actions.openSettings}
        focusModeActive={state.ui.focusMode}
      />
      
      <MiniStats 
        streak={state.tray.streak}
        insights={state.suggestions.items.length}
      />
    </div>
  );
};

export default QuickWindow;
```

#### Notification Manager

```jsx
// components/NotificationManager.jsx
import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

const NotificationManager = () => {
  const { state, actions } = useApp();
  
  useEffect(() => {
    // Listen for native notification clicks
    window.electronAPI.onNotificationAction((event, { notificationId, actionId }) => {
      switch (actionId) {
        case 'show-solution':
          actions.showSolution(notificationId);
          break;
        case 'open-files':
          actions.openContextFiles(notificationId);
          break;
        case 'view-stats':
          actions.openStats();
          break;
        case 'dismiss':
          actions.dismissNotification(notificationId);
          break;
        default:
          break;
      }
    });
    
    // Listen for stuck detection from main process
    window.electronAPI.onStuckDetected((event, data) => {
      actions.showNotification({
        type: 'help',
        title: `Stuck on ${data.file}?`,
        body: `You've been on this file for ${data.duration} minutes. Need help?`,
        actions: [
          { id: 'show-solution', title: '💡 Show Solution' },
          { id: 'dismiss', title: 'Dismiss' }
        ]
      });
    });
    
    // Listen for wellness reminders
    window.electronAPI.onWellnessReminder(() => {
      if (state.settings.notifications.wellness) {
        actions.showNotification({
          type: 'wellness',
          title: 'Time for a break?',
          body: "You've been coding for a while. A short break could help!",
          actions: [
            { id: 'remind-later', title: 'Remind in 15min' },
            { id: 'snooze', title: 'Snooze' }
          ],
          silent: true
        });
      }
    });
    
  }, []);
  
  // Track achievements
  useEffect(() => {
    if (state.activity.achievements?.length > 0) {
      const latest = state.activity.achievements[0];
      actions.showNotification({
        type: 'achievement',
        title: latest.title,
        body: latest.description,
        actions: [
          { id: 'view-stats', title: 'View Stats' },
          { id: 'dismiss', title: 'Nice!' }
        ]
      });
    }
  }, [state.activity.achievements]);
  
  return null; // This is a logic-only component
};

export default NotificationManager;
```

### 5.4 Custom Hooks

```javascript
// hooks/useActivityMonitor.js
import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export const useActivityMonitor = () => {
  const { state, actions } = useApp();
  const lastFileRef = useRef(null);
  const stuckTimerRef = useRef(null);
  
  useEffect(() => {
    // Poll Pieces OS for activity every 30 seconds
    const interval = setInterval(async () => {
      const activity = await window.electronAPI.getActivitySnapshot();
      
      // Update current activity
      actions.updateActivity({
        currentFile: activity.currentFile,
        currentProject: activity.currentProject,
        timeSpent: activity.timeSpent,
        lastActivity: Date.now(),
      });
      
      // Detect stuck state
      if (activity.currentFile === lastFileRef.current) {
        const stuckThreshold = state.settings.thresholds.stuckMinutes * 60 * 1000;
        
        if (activity.timeSpent > stuckThreshold && !state.activity.isStuck) {
          actions.setStuck(true);
          
          // Notify main process to show notification
          window.electronAPI.notifyStuckDetected({
            file: activity.currentFile,
            duration: Math.floor(activity.timeSpent / 60000),
          });
        }
      } else {
        // File changed, reset stuck state
        actions.setStuck(false);
        lastFileRef.current = activity.currentFile;
      }
      
    }, 30000);
    
    return () => clearInterval(interval);
  }, [state.settings.thresholds.stuckMinutes]);
  
  return state.activity;
};

// hooks/useFocusMode.js
export const useFocusMode = () => {
  const { state, actions } = useApp();
  
  useEffect(() => {
    if (state.ui.focusMode) {
      // Pause non-urgent notifications
      window.electronAPI.setFocusMode(true);
      
      // Set a timer to auto-disable after 1 hour
      const timer = setTimeout(() => {
        actions.toggleFocusMode();
      }, 60 * 60 * 1000);
      
      return () => {
        clearTimeout(timer);
        window.electronAPI.setFocusMode(false);
      };
    }
  }, [state.ui.focusMode]);
  
  return {
    isActive: state.ui.focusMode,
    toggle: actions.toggleFocusMode,
  };
};
```

---

## 6. Electron/Tray App Architecture

### 6.1 Project Structure

```
desktop-app/
├── package.json
├── electron.vite.config.js
├── src/
│   ├── main/                    # Main process
│   │   ├── index.js             # Entry point
│   │   ├── tray-manager.js      # Tray icon & menu
│   │   ├── window-manager.js    # Window management
│   │   ├── notification-service.js  # OS notifications
│   │   ├── pieces-bridge.js     # Pieces OS integration
│   │   └── ipc-handlers.js      # IPC event handlers
│   │
│   ├── preload/                 # Preload scripts
│   │   └── index.js             # Exposed APIs
│   │
│   └── renderer/                # React app
│       ├── index.html
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       ├── hooks/
│       ├── context/
│       └── styles/
│
├── resources/
│   ├── icons/
│   │   ├── tray/
│   │   │   ├── watching.png
│   │   │   ├── active.png
│   │   │   ├── urgent.png
│   │   │   ├── critical.png
│   │   │   ├── success.png
│   │   │   └── achievement.png
│   │   └── app-icon.png
│   └── sounds/
│       └── celebration.mp3
│
└── build/
    └── ...
```

### 6.2 Main Process Architecture

```javascript
// src/main/index.js
import { app, BrowserWindow, ipcMain } from 'electron';
import TrayManager from './tray-manager';
import WindowManager from './window-manager';
import NotificationService from './notification-service';
import PiecesBridge from './pieces-bridge';

class ProactiveAssistantApp {
  constructor() {
    this.trayManager = null;
    this.windowManager = null;
    this.notificationService = null;
    this.piecesBridge = null;
  }
  
  async initialize() {
    await app.whenReady();
    
    // Initialize services
    this.piecesBridge = new PiecesBridge();
    await this.piecesBridge.connect();
    
    this.notificationService = new NotificationService();
    this.windowManager = new WindowManager();
    this.trayManager = new TrayManager({
      onClick: () => this.windowManager.toggleQuickWindow(),
    });
    
    // Setup IPC handlers
    this.setupIpcHandlers();
    
    // Start monitoring
    this.startActivityMonitoring();
    
    // Check for context recovery on startup
    this.checkContextRecovery();
  }
  
  setupIpcHandlers() {
    // Window management
    ipcMain.handle('window:position', (event, bounds) => {
      return this.windowManager.setPosition(bounds);
    });
    
    ipcMain.handle('window:close', (event, windowName) => {
      return this.windowManager.close(windowName);
    });
    
    // Activity
    ipcMain.handle('activity:snapshot', async () => {
      return this.piecesBridge.getCurrentActivity();
    });
    
    // Notifications
    ipcMain.handle('notification:show', (event, options) => {
      return this.notificationService.show(options);
    });
    
    // Brief generation
    ipcMain.handle('brief:generate', async () => {
      return this.piecesBridge.generateBrief();
    });
    
    // Settings
    ipcMain.handle('settings:get', () => {
      return this.getSettings();
    });
    
    ipcMain.handle('settings:set', (event, settings) => {
      return this.saveSettings(settings);
    });
  }
  
  startActivityMonitoring() {
    // Check every 30 seconds
    setInterval(async () => {
      const activity = await this.piecesBridge.getCurrentActivity();
      
      // Detect stuck state
      if (activity.timeOnFile > 5 * 60 * 1000) { // 5 minutes
        this.notificationService.show({
          type: 'help',
          title: `Stuck on ${activity.fileName}?`,
          body: 'Need some help?',
          actions: ['Show Solution', 'Dismiss']
        });
      }
      
      // Update tray icon
      this.trayManager.updateState({
        state: this.determineState(activity),
        progress: activity.taskProgress,
      });
      
    }, 30000);
  }
  
  determineState(activity) {
    if (activity.isStuck) return 'critical';
    if (activity.hasSuggestion) return 'active';
    if (activity.needsAttention) return 'urgent';
    return 'watching';
  }
  
  async checkContextRecovery() {
    const lastSession = await this.piecesBridge.getLastSession();
    const today = new Date().toDateString();
    
    if (lastSession.date !== today) {
      // New day - offer context recovery
      this.notificationService.show({
        type: 'recovery',
        title: 'Continue where you left off?',
        body: `Yesterday you were working on ${lastSession.project}`,
        actions: ['Open Files', 'Show Summary', 'Dismiss']
      });
    }
  }
}

// Start app
const assistantApp = new ProactiveAssistantApp();
assistantApp.initialize();

app.on('window-all-closed', () => {
  // Keep running in tray
});

app.on('before-quit', () => {
  assistantApp.piecesBridge?.disconnect();
});
```

### 6.3 Tray Manager

```javascript
// src/main/tray-manager.js
import { Tray, nativeImage, ipcMain } from 'electron';
import path from 'path';

class TrayManager {
  constructor({ onClick }) {
    this.tray = null;
    this.onClick = onClick;
    this.currentState = 'watching';
    this.progress = 0;
    
    this.createTray();
  }
  
  createTray() {
    // Create initial tray icon
    const icon = this.createIcon('watching');
    this.tray = new Tray(icon);
    
    // Set tooltip
    this.tray.setToolTip('Proactive Assistant - Watching');
    
    // Handle click
    this.tray.on('click', this.onClick);
    this.tray.on('right-click', this.showContextMenu);
  }
  
  createIcon(state, progress = 0) {
    // For macOS, use template images
    // For Windows/Linux, use PNGs with different colors
    
    const iconPath = path.join(
      __dirname, 
      '../../resources/icons/tray',
      process.platform === 'darwin' 
        ? `${state}Template.png`
        : `${state}.png`
    );
    
    let image = nativeImage.createFromPath(iconPath);
    
    // Add progress ring overlay if needed
    if (progress > 0) {
      image = this.addProgressRing(image, progress);
    }
    
    if (process.platform === 'darwin') {
      image = image.resize({ width: 16, height: 16 });
      image.setTemplateImage(true);
    }
    
    return image;
  }
  
  addProgressRing(image, progress) {
    // Create canvas overlay for progress ring
    // This is simplified - actual implementation would use native-image manipulation
    return image;
  }
  
  updateState({ state, progress }) {
    if (state !== this.currentState || progress !== this.progress) {
      this.currentState = state;
      this.progress = progress;
      
      const icon = this.createIcon(state, progress);
      this.tray.setImage(icon);
      
      // Update tooltip
      const tooltips = {
        watching: 'Proactive Assistant - Watching',
        active: 'Proactive Assistant - Has suggestion',
        urgent: 'Proactive Assistant - Needs attention',
        critical: 'Proactive Assistant - You seem stuck',
        success: 'Proactive Assistant - Task complete!',
      };
      this.tray.setToolTip(tooltips[state] || tooltips.watching);
    }
  }
  
  showContextMenu() {
    // Show context menu on right-click
    const { Menu } = require('electron');
    const menu = Menu.buildFromTemplate([
      { label: 'Open Quick Window', click: this.onClick },
      { type: 'separator' },
      { label: 'Focus Mode', type: 'checkbox', click: () => {} },
      { label: 'Generate Brief', click: () => {} },
      { type: 'separator' },
      { label: 'Settings', click: () => {} },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ]);
    
    this.tray.popUpContextMenu(menu);
  }
}

export default TrayManager;
```

### 6.4 Window Manager

```javascript
// src/main/window-manager.js
import { BrowserWindow, screen } from 'electron';
import path from 'path';

class WindowManager {
  constructor() {
    this.windows = {
      quick: null,
      brief: null,
      settings: null,
    };
  }
  
  createQuickWindow() {
    if (this.windows.quick) {
      return this.windows.quick;
    }
    
    this.windows.quick = new BrowserWindow({
      width: 320,
      height: 400,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      type: 'panel', // macOS floating window
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    
    // Load React app
    if (process.env.VITE_DEV_SERVER_URL) {
      this.windows.quick.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/quick`);
    } else {
      this.windows.quick.loadFile(path.join(__dirname, '../renderer/index.html'), {
        hash: 'quick'
      });
    }
    
    // Hide when losing focus
    this.windows.quick.on('blur', () => {
      this.hideQuickWindow();
    });
    
    return this.windows.quick;
  }
  
  toggleQuickWindow() {
    if (this.windows.quick?.isVisible()) {
      this.hideQuickWindow();
    } else {
      this.showQuickWindow();
    }
  }
  
  showQuickWindow() {
    const win = this.createQuickWindow();
    
    // Position near tray icon
    const trayBounds = this.getTrayBounds();
    const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
    
    let x = trayBounds.x - 160 + (trayBounds.width / 2); // Center on tray
    let y = process.platform === 'darwin' 
      ? trayBounds.y - 408  // Above tray on macOS
      : trayBounds.y + trayBounds.height + 8; // Below on Windows
    
    // Ensure window stays on screen
    x = Math.max(display.bounds.x + 8, Math.min(x, display.bounds.x + display.bounds.width - 328));
    y = Math.max(display.bounds.y + 8, Math.min(y, display.bounds.y + display.bounds.height - 408));
    
    win.setPosition(Math.round(x), Math.round(y));
    win.show();
    win.focus();
  }
  
  hideQuickWindow() {
    if (this.windows.quick) {
      this.windows.quick.hide();
    }
  }
  
  createBriefWindow() {
    if (this.windows.brief) {
      this.windows.brief.focus();
      return this.windows.brief;
    }
    
    this.windows.brief = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 600,
      minHeight: 400,
      title: 'Daily Brief',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
      },
    });
    
    // Load brief view
    if (process.env.VITE_DEV_SERVER_URL) {
      this.windows.brief.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/brief`);
    } else {
      this.windows.brief.loadFile(path.join(__dirname, '../renderer/index.html'), {
        hash: 'brief'
      });
    }
    
    this.windows.brief.on('closed', () => {
      this.windows.brief = null;
    });
    
    return this.windows.brief;
  }
  
  getTrayBounds() {
    // This would need to be passed from TrayManager
    // For now, return approximate position
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    return {
      x: primaryDisplay.bounds.width - 100,
      y: 10,
      width: 16,
      height: 16,
    };
  }
}

export default WindowManager;
```

### 6.5 Preload Script (Security Bridge)

```javascript
// src/preload/index.js
import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  getTrayBounds: () => ipcRenderer.invoke('tray:bounds'),
  getScreenBounds: () => ipcRenderer.invoke('screen:bounds'),
  setWindowPosition: (x, y) => ipcRenderer.invoke('window:position', { x, y }),
  closeWindow: (name) => ipcRenderer.invoke('window:close', name),
  
  // Activity
  getActivitySnapshot: () => ipcRenderer.invoke('activity:snapshot'),
  onActivityUpdate: (callback) => {
    ipcRenderer.on('activity:update', (event, data) => callback(data));
  },
  
  // Notifications
  showNotification: (options) => ipcRenderer.invoke('notification:show', options),
  onNotificationAction: (callback) => {
    ipcRenderer.on('notification:action', (event, data) => callback(data));
  },
  onStuckDetected: (callback) => {
    ipcRenderer.on('stuck:detected', (event, data) => callback(data));
  },
  onWellnessReminder: (callback) => {
    ipcRenderer.on('wellness:reminder', () => callback());
  },
  
  // Brief
  generateBrief: () => ipcRenderer.invoke('brief:generate'),
  getTodayBrief: () => ipcRenderer.invoke('brief:today'),
  getBriefHistory: () => ipcRenderer.invoke('brief:history'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  
  // Focus mode
  setFocusMode: (enabled) => ipcRenderer.invoke('focus-mode:set', enabled),
  
  // Context recovery
  openContextFiles: (contextId) => ipcRenderer.invoke('context:open', contextId),
});
```

### 6.6 Package.json Scripts

```json
{
  "name": "proactive-assistant-desktop",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "dist": "electron-builder",
    "dist:mac": "electron-builder --mac",
    "dist:win": "electron-builder --win",
    "dist:linux": "electron-builder --linux"
  },
  "dependencies": {
    "@electron-toolkit/preload": "^3.0.0",
    "@electron-toolkit/utils": "^3.0.0",
    "@pieces.app/pieces-os-client": "^4.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "electron-vite": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "build": {
    "appId": "com.yourcompany.proactive-assistant",
    "productName": "Proactive Assistant",
    "directories": {
      "output": "dist"
    },
    "files": [
      "out/**/*",
      "resources/**/*"
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ]
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goals:**
- [ ] Set up Electron + Vite + React project structure
- [ ] Create system tray with basic icon states
- [ ] Implement quick action window
- [ ] Basic IPC communication

**Deliverables:**
- Tray icon appears on startup
- Click opens basic floating window
- Window closes on blur

### Phase 2: Core Features (Week 2)

**Goals:**
- [ ] Integrate with Pieces OS for activity monitoring
- [ ] Implement stuck detection algorithm
- [ ] Add OS notification system
- [ ] Create notification templates

**Deliverables:**
- Detects when user is stuck on same file
- Shows native notification with actions
- Clicking notification opens solution

### Phase 3: Intelligence (Week 3)

**Goals:**
- [ ] Context recovery on startup
- [ ] Wellness reminders
- [ ] Brief generation integration
- [ ] Settings panel

**Deliverables:**
- "Continue where you left off?" notification
- Break reminders after extended coding
- Daily brief generation at scheduled time

### Phase 4: Polish (Week 4)

**Goals:**
- [ ] Progress rings and animations
- [ ] Achievement system
- [ ] Focus mode
- [ ] Cross-platform testing

**Deliverables:**
- Smooth animations on all state transitions
- Celebration effects on task completion
- Focus mode pauses non-urgent notifications
- Works on macOS, Windows, Linux

### Phase 5: Advanced Features (Week 5-6)

**Goals:**
- [ ] VS Code extension for inline suggestions
- [ ] Advanced analytics
- [ ] Customizable thresholds
- [ ] Export/sharing features

**Deliverables:**
- Inline code suggestions in VS Code
- Weekly productivity reports
- User can customize all timing thresholds

---

## Appendix: File Structure Comparison

### Old (Web Dashboard)
```
client/
├── src/
│   ├── components/
│   │   └── Dashboard.jsx      ← Complex, many sections
│   ├── App.jsx                 ← Router, global state
│   └── main.jsx
```

### New (System Tray App)
```
desktop-app/src/
├── main/                       ← NEW: Electron main process
│   ├── index.js               ← App lifecycle
│   ├── tray-manager.js        ← System tray logic
│   ├── window-manager.js      ← Window positioning
│   ├── notification-service.js ← OS notifications
│   └── pieces-bridge.js       ← Pieces OS integration
│
├── preload/                    ← NEW: Secure bridge
│   └── index.js
│
└── renderer/                   ← React app (simplified)
    ├── components/
    │   ├── TrayIcon.jsx       ← SVG with animations
    │   ├── QuickWindow.jsx    ← Main interaction
    │   ├── StatusBar.jsx      ← Current activity
    │   ├── SuggestionsList.jsx
    │   └── NotificationManager.jsx
    ├── hooks/
    │   ├── useActivityMonitor.js
    │   ├── useFocusMode.js
    │   └── useSuggestions.js
    └── context/
        └── AppContext.jsx     ← Global state
```

---

## Summary

This design transforms the Proactive AI Assistant from a **web dashboard** into an **ambient system tray companion**:

| Aspect | Old | New |
|--------|-----|-----|
| **Location** | Browser tab | System tray |
| **Interaction** | User must check | Surfaces when needed |
| **Notifications** | None | Rich, actionable |
| **Window** | Full page | Floating, minimal |
| **Focus** | Dashboard-centric | Context-aware |
| **Workflow** | Interruptive | Ambient |

The new design prioritizes:
1. **Non-intrusion** - Only appears when helpful
2. **Context-awareness** - Understands what user is doing
3. **Speed** - One-click actions
4. **Delight** - Celebrates wins without interruption

---

*Document Version: 1.0*  
*Created: January 29, 2026*  
*Status: Design Complete - Ready for Implementation*
