# Architecture Documentation

Technical architecture and design of the Proactive AI Assistant VS Code extension.

---

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VS CODE EXTENSION HOST                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    EXTENSION ENTRY                          │   │
│  │                   (extension.ts)                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │  Activation │  │   Command   │  │   Configuration     │  │   │
│  │  │   Handler   │  │ Registration│  │     Listener        │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     SERVICES LAYER                          │   │
│  │                                                             │   │
│  │  ┌──────────────────┐  ┌──────────────────┐               │   │
│  │  │ ActivityTracker  │  │ SuggestionEngine │               │   │
│  │  │                  │  │                  │               │   │
│  │  │ - Flow detection │  │ - Templates      │               │   │
│  │  │ - Context capture│  │ - Generation     │               │   │
│  │  │ - Stats          │  │ - Prioritization │               │   │
│  │  └────────┬─────────┘  └────────┬─────────┘               │   │
│  │           │                     │                         │   │
│  │  ┌────────┴─────────────────────┴──────────────────────┐  │   │
│  │  │              InterruptionManager                     │  │   │
│  │  │   (Decides when to show suggestions)                 │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  │  ┌──────────────────┐  ┌──────────────────┐               │   │
│  │  │   PiecesClient   │  │   StorageManager │               │   │
│  │  │                  │  │                  │               │   │
│  │  │ - API connection │  │ - State persistence            │   │
│  │  │ - Context analysis│  │ - Stats storage │               │   │
│  │  └────────┬─────────┘  └──────────────────┘               │   │
│  │           │                                                  │   │
│  └───────────┼──────────────────────────────────────────────────┘   │
│              │                                                      │
│              ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                       UI LAYER                              │   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │   │
│  │  │ PanelProvider│  │ StatusBar    │  │ Command        │    │   │
│  │  │              │  │ Integration  │  │ Handlers       │    │   │
│  │  │ - Webview    │  │              │  │                │    │   │
│  │  │ - Sidebar    │  │ - State icons│  │ - User actions │    │   │
│  │  └──────────────┘  └──────────────┘  └────────────────┘    │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PIECES OS                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PIECES OS API                            │   │
│  │                                                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │  QGPT API   │  │ LTM Engine  │  │   Copilot Engine    │  │   │
│  │  │             │  │             │  │                     │  │   │
│  │  │ - Questions │  │ - Context   │  │ - AI reasoning      │  │   │
│  │  │ - Relevance │  │   retrieval │  │ - Response gen      │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### Extension Entry (`extension.ts`)

**Responsibilities:**
- Extension lifecycle management (activate/deactivate)
- Service initialization and dependency injection
- Command registration
- Configuration change handling
- Error handling and recovery

**Key Functions:**
```typescript
activate(context: vscode.ExtensionContext): Promise<void>
deactivate(): void
handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void
```

---

### Services Layer

#### ActivityTracker

Monitors user activity to detect flow states.

**Responsibilities:**
- Track file changes and editor events
- Detect flow state transitions
- Capture context snapshots
- Calculate activity statistics

**Flow States:**
```typescript
type FlowState = 
  | 'idle'           // No recent activity
  | 'working'        // Normal coding activity
  | 'deep_flow'      // Extended productive period
  | 'stuck'          // Struggling with a problem
  | 'frustrated';    // Rapid changes, errors
```

**Events:**
- `onFlowStateChanged`: Fires when state transitions
- `onActivityRecorded`: Fires on each activity sample

---

#### SuggestionEngine

Generates contextual suggestions based on flow state.

**Responsibilities:**
- Template-based suggestion generation
- Flow-state-aware selection
- Priority assignment
- Action configuration

**Suggestion Types:**
```typescript
type SuggestionType = 
  | 'stuck'           // Help when struggling
  | 'error_fix'       // Fix detected errors
  | 'context_recovery'// Return from break
  | 'wellness'        // Break reminders
  | 'celebration'     // Achievements
  | 'productivity'    // Optimization tips
  | 'learning';       // Educational content
```

**Template Structure:**
```typescript
interface Suggestion {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  actions: SuggestionAction[];
  category: SuggestionType;
  confidence: number;
}
```

---

#### InterruptionManager

Decides when to show suggestions based on context.

**Responsibilities:**
- Evaluate suggestion confidence
- Check quiet hours
- Respect focus mode
- Prevent suggestion fatigue

**Decision Factors:**
- Current flow state
- Time since last suggestion
- User configuration (threshold, quiet hours)
- Focus mode status
- Suggestion priority

---

#### PiecesClient

Interfaces with Pieces OS for AI capabilities.

**Responsibilities:**
- Connect to Pieces OS
- Query context relevance
- Request AI analysis
- Manage connection state

**API Methods:**
```typescript
connect(): Promise<void>
analyzeContext(context: ActivityContext): Promise<ContextAnalysis>
isAvailable(): boolean
```

---

#### StorageManager

Persists extension state and user preferences.

**Responsibilities:**
- Store user preferences
- Save activity statistics
- Track suggestion history
- Manage dismissal reasons

**Storage Keys:**
```typescript
'suggestionPreferences'   // User preferences
'sessionStats'           // Activity statistics
'suggestionHistory'      // Recent suggestions
'flowStateHistory'       // Flow state transitions
```

---

### UI Layer

#### PanelProvider

Manages the webview panel in VS Code sidebar.

**Responsibilities:**
- Create and manage webview
- Handle panel messages
- Update panel content
- Dispose resources

**Webview Communication:**
```typescript
// Extension → Webview
postMessage({ type: 'update', data: suggestion })

// Webview → Extension
postMessage({ type: 'action', actionId: 'apply' })
```

---

#### StatusBar Integration

Shows current state in VS Code status bar.

**States:**
| Icon | State |
|------|-------|
| 💡 | Active |
| 🔕 | Focus Mode |
| 😴 | Snoozed |
| ⚠️ | Error |

**Interactions:**
- Click to toggle Focus Mode
- Hover for details
- Context menu for actions

---

## 🔄 Data Flow

### Suggestion Generation Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   User      │     │  Activity    │     │  Suggestion     │
│  Activity   │────▶│  Tracker     │────▶│   Engine        │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                 │
                                                 ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│    User     │◀────│     UI       │◀────│  Interruption   │
│   Sees      │     │   Display    │     │   Manager       │
│ Suggestion  │     │              │     │ (Decision: Yes) │
└─────────────┘     └──────────────┘     └─────────────────┘
```

### Activity Tracking Flow

```
┌──────────────┐
│   VS Code    │
│   Events     │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Activity   │────▶│   Context    │────▶│    Flow      │
│   Sample     │     │  Summarizer  │     │   State      │
└──────────────┘     └──────────────┘     └──────────────┘
                                                   │
                           ┌───────────────────────┘
                           ▼
                    ┌──────────────┐
                    │   Event      │
                    │   Emitter    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ Suggestion│  │ Storage │  │   UI    │
        │  Engine   │  │ Manager │  │ Update  │
        └─────────┘  └─────────┘  └─────────┘
```

---

## 📋 Extension Lifecycle

### Activation

```typescript
// 1. Extension host loads extension
// 2. activate() called
activate(context) {
  // 3. Initialize logger
  // 4. Create services
  // 5. Initialize services
  // 6. Register commands
  // 7. Set up event listeners
  // 8. Set context values
  // 9. Show welcome (first run)
}
```

### Runtime

```
┌──────────────────────────────────────────┐
│           EVENT LOOP                     │
│                                          │
│  ┌─────────┐    ┌─────────┐    ┌───────┐│
│  │ Editor  │───▶│ Activity│───▶│ State ││
│  │ Events  │    │ Sample  │    │Check  ││
│  └─────────┘    └─────────┘    └───┬───┘│
│         ▲                          │    │
│         │                          ▼    │
│  ┌─────────┐    ┌─────────┐    ┌───────┐│
│  │   UI    │◀───│Suggestion│◀───│Trigger││
│  │ Update  │    │ Generate │    │ Check ││
│  └─────────┘    └─────────┘    └───────┘│
└──────────────────────────────────────────┘
```

### Deactivation

```typescript
// 1. User closes VS Code or disables extension
// 2. deactivate() called
deactivate() {
  // 3. Dispose commands
  // 4. Dispose disposables
  // 5. Dispose services
  // 6. Clean up resources
}
```

---

## 🔌 External Dependencies

### VS Code API

| API | Usage |
|-----|-------|
| `commands` | Register and execute commands |
| `window` | Show messages, manage editor |
| `workspace` | File system events, configuration |
| `extensions` | Extension management |
| `webview` | Custom UI panels |

### Pieces OS API

| Endpoint | Purpose |
|----------|---------|
| `/qgpt/relevance` | Find relevant context |
| `/qgpt/question` | Ask AI questions |
| `/connect` | Connection management |

---

## 📁 File Structure

```
vscode-proactive-assistant/
├── src/
│   ├── extension.ts           # Entry point
│   ├── commands/              # Command implementations
│   │   ├── index.ts
│   │   ├── openPanel.ts
│   │   ├── toggleFocusMode.ts
│   │   └── ...
│   ├── services/              # Core services
│   │   ├── activityMonitor.ts
│   │   ├── suggestionEngine.ts
│   │   ├── interruptionManager.ts
│   │   ├── piecesClient.ts
│   │   ├── storageManager.ts
│   │   └── index.ts
│   ├── ui/                    # UI components
│   │   └── panelProvider.ts
│   ├── types/                 # Type definitions
│   │   └── index.ts
│   └── utils/                 # Utilities
│       ├── logger.ts
│       ├── errors.ts
│       └── index.ts
├── webview/                   # Webview UI
│   ├── src/
│   ├── index.html
│   └── vite.config.ts
├── package.json               # Extension manifest
└── tsconfig.json              # TypeScript config
```

---

## 🔒 Security Considerations

### Data Privacy

- **Local processing only**: No data sent to external servers
- **Pieces OS**: Optional AI processing via local Pieces instance
- **Storage**: All data stored in VS Code's secure storage
- **Network**: Only connects to local Pieces OS

### Extension Security

- **Content Security Policy**: Strict CSP for webviews
- **Input validation**: All user inputs validated
- **Escape sequences**: Proper escaping in rendered content
- **No eval**: No use of eval() or similar functions

---

## 🚀 Performance Considerations

### Optimizations

1. **Sampling**: Configurable activity sampling interval
2. **Debouncing**: Event handlers debounced appropriately
3. **Lazy loading**: Services initialized on demand
4. **Efficient storage**: Local storage used sparingly

### Resource Usage

| Component | CPU Impact | Memory Impact |
|-----------|-----------|---------------|
| ActivityTracker | Low (5s intervals) | ~1MB |
| SuggestionEngine | On-demand | ~500KB |
| PanelProvider | When visible | ~2MB |
| Total | Minimal | ~5-10MB |

---

## 📚 Related Documentation

- [Installation Guide](INSTALLATION.md)
- [Configuration Reference](CONFIGURATION.md)
- [Troubleshooting](TROUBLESHOOTING.md)
