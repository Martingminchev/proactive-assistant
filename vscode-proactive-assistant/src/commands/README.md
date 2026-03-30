# Proactive AI Assistant - Commands Module

This module contains all VS Code commands for the Proactive AI Assistant extension.

## Commands

### 1. Open Panel (`openPanel.ts`)
**Command ID:** `proactiveAssistant.openPanel`

Opens/closes the assistant side panel. Can toggle visibility or simply show the panel.

**Keybinding:** `Ctrl+Shift+A` (Mac: `Cmd+Shift+A`)

**Features:**
- Creates webview panel if not exists
- Toggles panel visibility
- Multiple view states (welcome, suggestions, stats, settings, focus)

---

### 2. Toggle Focus Mode (`toggleFocusMode.ts`)
**Command ID:** `proactiveAssistant.toggleFocusMode`

Enables/disables focus mode with countdown timer and purple status bar.

**Keybinding:** `Ctrl+Shift+F` (Mac: `Cmd+Shift+F`)

**Features:**
- Quick pick for duration (15, 25, 45, 60 min, or custom)
- Purple status bar indicator with countdown
- Auto-disable after duration expires
- Can extend or end early

---

### 3. Show Stats (`showStats.ts`)
**Command ID:** `proactiveAssistant.showStats`

Displays activity statistics and productivity insights.

**Features:**
- Today's Activity
- Weekly Summary
- Suggestion History
- Productivity Insights
- View in panel or information messages

---

### 4. Dismiss Suggestion (`dismissSuggestion.ts`)
**Command ID:** `proactiveAssistant.dismissSuggestion`

Dismisses the current active suggestion with optional reason collection.

**Keybinding:** `Escape`

**Features:**
- Records dismissal reason (not helpful, wrong time, incorrect, etc.)
- 3-strike rule for category-based suggestions
- Undo capability (restores dismissed suggestion)
- Dismissal history tracking

---

### 5. Apply Fix (`applyFix.ts`)
**Command ID:** `proactiveAssistant.applyFix`

Applies code fixes from suggestions with progress indication.

**Keybinding:** `Ctrl+Shift+Enter` (Mac: `Cmd+Shift+Enter`)

**Features:**
- Supports insert, delete, replace, edit, and create_file operations
- Progress notification during application
- Single undo operation support
- JSON payload parsing for complex fixes

---

### 6. Snooze Suggestion (`snoozeSuggestion.ts`)
**Command ID:** `proactiveAssistant.snoozeSuggestion`

Snoozes suggestions for a selected duration.

**Features:**
- Duration options: 15 min, 30 min, 1 hour, until tomorrow, custom
- Category-specific snoozing
- Status bar indicator with remaining time
- Can end snooze early

---

### 7. Open Settings (`openSettings.ts`)
**Command ID:** `proactiveAssistant.configure`

Opens VS Code settings or custom settings webview panel.

**Features:**
- VS Code settings filtered to extension
- Custom webview settings panel with interactive controls
- Category-specific settings (Focus, Suggestions, Pieces OS)
- Direct settings.json editing option

---

### 8. Show Welcome (`showWelcome.ts`)
**Command ID:** `proactiveAssistant.showWelcome`

Shows welcome wizard on first install and feature tour.

**Features:**
- First-run detection
- Multi-step welcome wizard
- Pieces OS setup wizard
- Feature tour in webview panel
- Can be re-run via command palette

---

## Usage

### Registering Commands

Commands are automatically registered during extension activation:

```typescript
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
  const services = initializeServices(context);
  const disposables = registerCommands(context, services);
  context.subscriptions.push(...disposables);
}
```

### Accessing Command Functions

Import specific command functions:

```typescript
import { openPanel, toggleFocusMode } from './commands';

// Use command functions directly
await openPanel(services);
await toggleFocusMode(services);
```

### Command IDs Reference

```typescript
import { CommandIds } from './commands';

// Use command IDs for programmatic execution
await vscode.commands.executeCommand(CommandIds.OPEN_PANEL);
```

## Error Handling

All commands use the `withErrorHandling` wrapper which:
- Logs errors with context
- Shows user-friendly error messages
- Provides "View Logs" action on errors

## State Management

Commands maintain their state through:
- VS Code context keys (for menu visibility)
- Module-level variables (for runtime state)
- Extension storage (for persistence)

### Context Keys

| Key | Description |
|-----|-------------|
| `proactiveAssistant.enabled` | Extension enabled state |
| `proactiveAssistant.hasActiveSuggestion` | Active suggestion exists |
| `proactiveAssistant.focusModeEnabled` | Focus mode is active |
| `proactiveAssistant.snoozed` | Suggestions are snoozed |
| `proactiveAssistant.panelVisible` | Panel is visible |

## Adding New Commands

1. Create a new file in `src/commands/`
2. Export `COMMAND_ID` constant
3. Implement command function with `Services` parameter
4. Create `registerXxxCommand` function using `withErrorHandling`
5. Add export to `index.ts`
6. Update `package.json` with command contribution
7. Add to `CommandIds` and `CommandMetadata` in `index.ts`

## Testing

Each command can be tested by:
1. Running the extension in debug mode
2. Using the Command Palette (`Ctrl+Shift+P`)
3. Using keyboard shortcuts
4. Using context menus

## Architecture

```
src/commands/
├── openPanel.ts          # Panel management
├── toggleFocusMode.ts    # Focus mode with timer
├── showStats.ts          # Statistics display
├── dismissSuggestion.ts  # Dismissal with 3-strike rule
├── applyFix.ts           # Code fix application
├── snoozeSuggestion.ts   # Snooze functionality
├── openSettings.ts       # Settings management
├── showWelcome.ts        # Welcome wizard
├── index.ts              # Barrel exports & registration
└── README.md             # This file
```
