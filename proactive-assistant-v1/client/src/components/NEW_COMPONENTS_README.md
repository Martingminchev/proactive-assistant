# New User-Friendly Components

This directory contains 5 new React components designed to make the Proactive Assistant frontend more **user-friendly**, **actionable**, and **transparent**.

## Components Overview

### 1. ActionCenter (`ActionCenter.jsx`)
**Purpose:** Shows immediate actions that need attention

**Features:**
- Big, clickable action buttons
- One-click dismiss/snooze functionality
- Progress indicators for ongoing tasks
- Prioritized by urgency (High/Medium/Low)
- Time estimates for each action
- Filter tabs (All/Urgent/Suggestions)

**Props:**
```jsx
<ActionCenter 
  actions={array}        // Array of action items
  onActionComplete={fn}  // Callback when action is completed/dismissed
/>
```

---

### 2. CurrentFocus (`CurrentFocus.jsx`)
**Purpose:** Shows what the user is doing RIGHT NOW

**Features:**
- Active app and window title display
- Current file being worked on
- Inferred task with confidence score
- Session timer showing time spent
- "Continue where you left off" button
- Recent files list with quick access
- Recent websites visited
- Productivity metrics (productive time, context switches, focus score)

**Props:**
```jsx
<CurrentFocus 
  focusData={object}  // Current focus data from Pieces API
/>
```

---

### 3. InsightsPanel (`InsightsPanel.jsx`)
**Purpose:** Pattern recognition and time tracking visualizations

**Features:**
- Pattern cards showing repetitive actions and inefficiencies
- Weekly activity bar chart
- Time breakdown by project
- Productivity peak hours identification
- Personalized recommendations
- Stats comparison (vs last week, vs average)

**Props:**
```jsx
<InsightsPanel 
  insightsData={object}  // Insights data from analytics
  onAction={fn}          // Callback for pattern actions
/>
```

---

### 4. DataQualityIndicator (`DataQualityIndicator.jsx`)
**Purpose:** Shows if Pieces is providing good data and transparency about AI knowledge

**Features:**
- Overall quality score with visual ring indicator
- Green/yellow/red status indicator
- Data source breakdown (Pieces, Browser, Files, Applications)
- "Click to fix" buttons for common issues
- AI knowledge transparency panel:
  - What the AI knows about user goals
  - Recent topics of interest
  - Context window size
  - Confidence level in recommendations
- Recent activity feed

**Props:**
```jsx
<DataQualityIndicator 
  qualityData={object}  // Data quality metrics
  onFixIssue={fn}       // Callback when user fixes an issue
/>
```

---

### 5. SmartBrief (`SmartBrief.jsx`)
**Purpose:** Redesigned brief display with better UX

**Features:**
- Items prioritized by urgency (not category)
- Action buttons for each item
- Collapsible sections with "More info"
- "Mark as done" functionality with visual feedback
- Progress bar showing completion
- Filter tabs (All/Urgent/Soon/Later)
- Empty state with celebration animation
- Clear completed items functionality
- Regenerate brief button

**Props:**
```jsx
<SmartBrief 
  briefData={object}      // Brief data with items array
  onItemComplete={fn}     // Callback when item is marked complete
  onItemAction={fn}       // Callback when action button is clicked
/>
```

---

## Integration

All components are integrated into the main Assistant view under a new "New UI" tab:

```
Feed | ✨ New UI | History | Goals | Settings
```

The new dashboard uses a two-column layout:
- **Left Column:** CurrentFocus, SmartBrief
- **Right Column:** ActionCenter, InsightsPanel, DataQualityIndicator

## Mock Data

Each component includes realistic mock data for demonstration. To connect to real APIs:

1. Replace the `MOCK_*` constants with API calls
2. Update the component props to accept real data
3. Implement the callback handlers for user actions

## Design Principles Applied

1. **Every item needs an ACTION** - Every brief item, insight, and pattern has a clear action button
2. **Show data quality/transparency** - Users can see exactly what the AI knows and how confident it is
3. **Prioritize by importance, not category** - Items are sorted by urgency, not grouped by type
4. **Feel like a helpful assistant, not a dashboard** - Conversational tone, actionable suggestions
5. **Use colors to indicate urgency** - Red for urgent, yellow for soon, green for later

## Styling

All components use the existing CSS variables from `App.css`:
- `--color-primary`, `--color-success`, `--color-warning`, `--color-error`
- `--color-bg`, `--color-bg-elevated`, `--color-bg-card`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- `--radius-sm`, `--radius-md`, `--radius-lg`
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`

Components are fully responsive and work on mobile devices.
