# User-Centered AI Assistant

A redesigned AI assistant system that focuses on **actually helping developers** rather than generating generic suggestions.

## 🎯 What's Different?

| Traditional AI Assistants | User-Centered AI |
|---------------------------|------------------|
| Random "tips" | Context-aware interventions |
| Daily briefs | Real-time assistance |
| Generic advice | Specific to your current work |
| Interrupts with news | Helps when you're stuck |
| Passive suggestions | Action-oriented recommendations |

## 🚀 Quick Start

### 1. The Assistant is Always Watching (In a Good Way)

The system tracks your activity to provide contextual help:

```javascript
// Record when you open a file
POST /api/assistant/activity
{
  "type": "file_open",
  "filePath": "/project/src/services/auth.ts",
  "fileName": "auth.ts",
  "language": "typescript"
}

// Record errors to detect stuck states
POST /api/assistant/activity
{
  "type": "error",
  "message": "Cannot read property 'map' of undefined",
  "file": "auth.ts",
  "line": 42
}

// Record searches to detect research loops
POST /api/assistant/activity
{
  "type": "search",
  "query": "react hooks useEffect cleanup",
  "source": "google"
}
```

### 2. Get Personalized Assistance

```javascript
// Get contextual help based on your current state
GET /api/assistant/assistance

{
  "success": true,
  "suppressed": false,
  "suggestions": [
    {
      "id": "stuck-123456",
      "type": "stuck_help",
      "priority": 10,
      "title": "Stuck on an error?",
      "description": "You've been working on auth.ts for 47 minutes with 5 recent errors.",
      "actions": [
        { "label": "Explain this error", "type": "explain_error" },
        { "label": "Take a 5-min break", "type": "suggest_break" },
        { "label": "Dismiss", "type": "dismiss" }
      ]
    },
    {
      "id": "pattern-123456",
      "type": "pattern_abstraction",
      "priority": 7,
      "title": "Pattern detected: Multiple API hooks",
      "description": "You've created 4 similar useEffect hooks for API calls today. Create a useApi hook?",
      "actions": [
        { "label": "Generate hook", "type": "suggest_abstraction" },
        { "label": "Not now", "type": "dismiss" }
      ]
    }
  ],
  "session": {
    "duration": "2h 15m",
    "currentFile": "auth.ts"
  }
}
```

### 3. Context Recovery After Interruptions

```javascript
// When you return after being away
GET /api/assistant/context-recovery?awayDuration=3600000

{
  "needsRecovery": true,
  "awayDuration": 3600000,
  "awayDurationText": "1h 0m",
  "contextSummary": "You were working on auth.ts 1h 0m ago. Last commit was 2h 15m ago. You have 3 TODOs in your recent files.",
  "todos": [
    { "text": "Extract validation logic", "file": "auth.ts" },
    { "text": "Add error handling", "file": "userService.ts" },
    { "text": "Write tests", "file": "auth.test.ts" }
  ],
  "suggestedFirstAction": {
    "label": "Continue with auth.ts",
    "type": "open_file",
    "payload": "/project/src/services/auth.ts"
  }
}
```

## 📊 Core Features

### 1. Stuck State Detection 🔴

Detects when you're struggling:
- **Debugging Loop**: 30+ min on same error with multiple error events
- **Research Rabbit Hole**: Searching the same thing 3+ times
- **Implementation Paralysis**: 45+ min no commits or significant saves

```javascript
GET /api/assistant/stuck-check

{
  "isStuck": true,
  "stuckType": "debugging_loop",
  "confidence": 8,
  "indicators": {
    "longTimeOnTask": true,
    "errorSpike": true,
    "repeatedSearches": false,
    "noProgress": true
  },
  "suggestedIntervention": {
    "type": "offer_help",
    "title": "Stuck on an error?",
    "message": "You've been working on auth.ts for 47 minutes with 5 recent errors.",
    "actions": [...]
  }
}
```

### 2. Pattern Recognition 💡

Identifies repetitive work:

```javascript
GET /api/assistant/patterns

{
  "patterns": [
    {
      "type": "repeated_file_type",
      "description": "You've worked on 5 TypeScript files recently",
      "confidence": 8,
      "data": { "extension": "ts", "count": 5 }
    },
    {
      "type": "long_session",
      "description": "You've been coding for 3 hours",
      "confidence": 8,
      "data": { "duration": 10800000 }
    },
    {
      "type": "todo_accumulation",
      "description": "You have 4 TODOs in recent files",
      "confidence": 8,
      "shouldSuggest": true,
      "data": { "count": 4 }
    }
  ]
}
```

### 3. Wellness Monitoring 🌱

Prevents burnout:

```javascript
GET /api/assistant/wellness

{
  "shouldNudge": true,
  "nudgeType": "break_needed",  // or "frustration_spike", "hourly_check"
  "message": "You've been coding for 2 hours without a break.",
  "actions": [
    { "label": "5-min walk", "type": "suggest_break", "payload": "5" },
    { "label": "Stretch break", "type": "suggest_break", "payload": "10" },
    { "label": "I'm fine", "type": "dismiss" }
  ]
}
```

### 4. Smart Suggestions Ranking 🧠

Suggestions are prioritized:
1. **Priority 10**: Stuck state (immediate help needed)
2. **Priority 9**: Context recovery (returning after absence)
3. **Priority 7-8**: Pattern-based (detected inefficiency)
4. **Priority 4**: Wellness check (break reminder)

Max 3 suggestions shown at once to avoid overwhelm.

## 🎛️ Configuration

### Quiet Hours

Don't get interrupted during focus time:

```javascript
POST /api/assistant/quiet-hours
{
  "start": 22,  // 10 PM
  "end": 8      // 8 AM
}
```

### Do Not Disturb

Temporarily disable all suggestions:

```javascript
POST /api/assistant/do-not-disturb
{
  "enabled": true
}
```

### Preferences

```javascript
POST /api/assistant/preferences
{
  "suggestionFrequency": "low",  // low, normal, high
  "quietHours": { "start": 22, "end": 8 },
  "doNotDisturb": false
}
```

## 📈 Feedback Loop

Every suggestion learns from your feedback:

```javascript
// Accept a suggestion
POST /api/assistant/suggestions/stuck-123456/action
{
  "action": "accepted"
}

// Dismiss with reason
POST /api/assistant/suggestions/pattern-123456/action
{
  "action": "dismissed",
  "reason": "not_relevant"  // not_relevant, too_busy, already_done, bad_timing
}

// Snooze for later
POST /api/assistant/suggestions/wellness-123456/action
{
  "action": "snoozed",
  "payload": "30"  // minutes
}
```

The system tracks:
- Acceptance rate by suggestion type
- Dismissal reasons to avoid similar suggestions
- User preferences over time

View stats:
```javascript
GET /api/assistant/stats

{
  "total": 45,
  "accepted": 18,
  "dismissed": 20,
  "snoozed": 7,
  "acceptanceRate": 40,
  "byType": {
    "stuck_help": { "total": 5, "accepted": 4, "acceptanceRate": 80 },
    "pattern_abstraction": { "total": 12, "accepted": 3, "acceptanceRate": 25 },
    "wellness": { "total": 20, "accepted": 8, "acceptanceRate": 40 }
  }
}
```

## 📋 Session Report

Get a full summary of your session:

```javascript
GET /api/assistant/session-report

{
  "session": {
    "id": "default",
    "duration": "4h 30m",
    "lastActivity": "2m ago"
  },
  "activity": {
    "filesWorkedOn": 8,
    "currentFile": { "name": "auth.ts", "language": "typescript" },
    "totalErrors": 12,
    "totalSearches": 15,
    "gitCommits": 3
  },
  "wellness": {
    "timeSinceLastBreak": "2h 15m",
    "wellnessChecks": 2
  },
  "suggestions": {
    "shown": 6,
    "stats": { "total": 45, "accepted": 18, "acceptanceRate": 40 }
  }
}
```

## 🔧 Integration Example

Here's how to integrate with a VS Code extension:

```javascript
const axios = require('axios');
const API_URL = 'http://localhost:3001/api/assistant';

class UserCenteredAssistant {
  constructor() {
    this.sessionId = 'vscode-' + Date.now();
    this.checkInterval = null;
  }

  start() {
    // Listen to VS Code events
    vscode.workspace.onDidOpenTextDocument(doc => {
      this.recordActivity('file_open', {
        filePath: doc.fileName,
        fileName: path.basename(doc.fileName),
        language: doc.languageId
      });
    });

    vscode.workspace.onDidSaveTextDocument(doc => {
      this.recordActivity('save', {
        filePath: doc.fileName
      });
    });

    // Check for assistance every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkForAssistance();
    }, 5 * 60 * 1000);
  }

  async recordActivity(type, data) {
    try {
      await axios.post(`${API_URL}/activity`, {
        sessionId: this.sessionId,
        type,
        ...data
      });
    } catch (e) {
      console.error('Failed to record activity:', e);
    }
  }

  async checkForAssistance() {
    try {
      const { data } = await axios.get(`${API_URL}/assistance`, {
        params: { sessionId: this.sessionId }
      });

      if (data.suggestions.length > 0) {
        this.showSuggestion(data.suggestions[0]);
      }
    } catch (e) {
      console.error('Failed to check assistance:', e);
    }
  }

  showSuggestion(suggestion) {
    const actions = suggestion.actions.map(a => a.label);
    
    vscode.window
      .showInformationMessage(
        `${suggestion.title}: ${suggestion.description}`,
        ...actions
      )
      .then(selected => {
        const action = suggestion.actions.find(a => a.label === selected);
        if (action) {
          this.handleAction(suggestion.id, action);
        }
      });
  }

  async handleAction(suggestionId, action) {
    await axios.post(`${API_URL}/suggestions/${suggestionId}/action`, {
      action: action.type,
      payload: action.payload
    });

    // Handle specific action types
    switch (action.type) {
      case 'suggest_break':
        vscode.window.showInformationMessage(
          `Great! Take a ${action.payload}-minute break. You've earned it!`
        );
        break;
      case 'explain_error':
        // Open AI chat with error context
        break;
      case 'open_file':
        vscode.workspace.openTextDocument(action.payload)
          .then(doc => vscode.window.showTextDocument(doc));
        break;
    }
  }

  async onFocusGained() {
    // User returned to VS Code
    const { data } = await axios.get(`${API_URL}/context-recovery`, {
      params: { sessionId: this.sessionId }
    });

    if (data.needsRecovery) {
      const action = await vscode.window.showInformationMessage(
        `Welcome back! ${data.contextSummary}`,
        data.suggestedFirstAction?.label || 'Continue',
        'Dismiss'
      );
      // Handle recovery action...
    }
  }
}
```

## 🧪 Testing

Test the endpoints with curl:

```bash
# Record an activity
curl -X POST http://localhost:3001/api/assistant/activity \
  -H "Content-Type: application/json" \
  -d '{
    "type": "file_open",
    "filePath": "/project/src/app.ts",
    "fileName": "app.ts",
    "language": "typescript"
  }'

# Get assistance
curl http://localhost:3001/api/assistant/assistance

# Check stuck state
curl http://localhost:3001/api/assistant/stuck-check

# Get session report
curl http://localhost:3001/api/assistant/session-report
```

## 📚 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/assistant/assistance` | GET | Get personalized suggestions |
| `/api/assistant/activity` | POST | Record user activity |
| `/api/assistant/stuck-check` | GET | Check if user appears stuck |
| `/api/assistant/context-recovery` | GET | Get recovery info after absence |
| `/api/assistant/patterns` | GET | Detect work patterns |
| `/api/assistant/wellness` | GET | Check wellness status |
| `/api/assistant/session-report` | GET | Get full session report |
| `/api/assistant/stats` | GET | Get suggestion statistics |
| `/api/assistant/preferences` | POST | Update preferences |
| `/api/assistant/quiet-hours` | POST | Set quiet hours |
| `/api/assistant/do-not-disturb` | POST | Enable/disable DND |
| `/api/assistant/reset-session` | POST | Reset session data |
| `/api/assistant/suggestions/:id/action` | POST | Handle suggestion action |

## 🎨 Design Principles

1. **Action First**: Every suggestion must have a clear action, not just information
2. **Context Aware**: Suggestions reference actual files, errors, and work patterns
3. **Respectful**: Quiet hours, DND mode, and learning from dismissals
4. **Proactive**: Detect stuck states before user asks for help
5. **Measurable**: Track acceptance rates to improve over time
