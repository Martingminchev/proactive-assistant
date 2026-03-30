# 🚀 Quick Start Guide

Get the Proactive AI Assistant running in under 5 minutes!

## Prerequisites

- [VS Code](https://code.visualstudio.com/) v1.74.0 or higher
- [Node.js](https://nodejs.org/) v18 or higher
- [Pieces OS](https://pieces.app/) installed and running

## Installation

### Option 1: Install from VS Code Marketplace (Recommended)

1. Open VS Code
2. Press `Ctrl+P` (or `Cmd+P` on Mac)
3. Type: `ext install proactive-ai-assistant`
4. Press Enter
5. Click **Install**

### Option 2: Install from VSIX (Latest Development Build)

1. Download the latest `.vsix` file from [Releases](../../releases)
2. Open VS Code
3. Go to Extensions view (`Ctrl+Shift+X`)
4. Click `...` (More Actions) → **Install from VSIX...**
5. Select the downloaded file

### Option 3: Build from Source (For Developers)

```bash
# Clone the repository
git clone https://github.com/yourusername/proactive-ai-assistant.git
cd proactive-ai-assistant

# Install dependencies
npm install
cd webview && npm install && cd ..

# Compile TypeScript
npm run compile

# Build webview
npm run build:webview

# Run in development mode
# Press F5 in VS Code to open a new Extension Development Host window
```

## First Run Setup

### 1. Verify Pieces OS Connection

The extension automatically detects Pieces OS. Check the status bar:

| Icon | Status | Meaning |
|------|--------|---------|
| 🤖● Blue | Watching | Connected and monitoring |
| 🤖○ Gray | Idle | Connected, no activity |
| 🤖🔴 Red | Urgent | Stuck detected |
| 🤖🚫 Purple | Focus | Focus mode active |

### 2. Open the Assistant Panel

- **Keyboard**: Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
- **Command Palette**: Press `Ctrl+Shift+P` → Type "Open Assistant Panel"
- **Status Bar**: Click the robot icon

### 3. Configure Settings (Optional)

Open settings (`Ctrl+,`) and search for "Proactive Assistant":

```json
{
  "proactiveAssistant.enabled": true,
  "proactiveAssistant.interruptionThreshold": 20,
  "proactiveAssistant.quietHoursStart": 22,
  "proactiveAssistant.quietHoursEnd": 8,
  "proactiveAssistant.maxSuggestionsPerHour": 2,
  "proactiveAssistant.focusModeDuration": 25
}
```

## Usage

### Daily Workflow

1. **Start coding** - Extension watches silently (blue icon)
2. **Get suggestions** - Icon changes color when suggestions available
3. **Click icon** - Open panel to see suggestions
4. **Apply fixes** - Click "Apply" to insert code
5. **Enable Focus Mode** - `Ctrl+Shift+F` when you need uninterrupted time

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+A` | Open/Close Assistant Panel |
| `Ctrl+Shift+F` | Toggle Focus Mode |
| `Ctrl+Shift+Enter` | Apply Current Suggestion |
| `Escape` | Dismiss Suggestion |

### Status Bar States

![Status Bar States](./docs/assets/status-bar-states.png)

- **Blue pulse** - Watching your activity
- **Amber solid** - Has suggestion for you
- **Red pulse** - You're stuck! Click for help
- **Purple solid** - Focus mode active

## Troubleshooting

### Extension doesn't activate

1. Check VS Code version (needs 1.74+)
2. Check Output panel → "Log (Extension Host)" for errors
3. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"

### No suggestions appearing

1. Ensure Pieces OS is running (check system tray)
2. Code for at least 20 minutes - suggestions need context
3. Check if Focus Mode is enabled
4. View logs: `Ctrl+Shift+P` → "Proactive Assistant: Show Logs"

### Too many/few interruptions

Adjust in settings:
- `proactiveAssistant.interruptionThreshold` - Minutes before "stuck" detection
- `proactiveAssistant.maxSuggestionsPerHour` - Limit suggestions
- `proactiveAssistant.focusModeDuration` - Default focus mode length

## Next Steps

- 📖 [Full Documentation](./docs/USAGE.md)
- ⚙️ [Configuration Guide](./docs/CONFIGURATION.md)
- 🏗️ [Architecture Overview](./docs/ARCHITECTURE.md)
- 🐛 [Troubleshooting](./docs/TROUBLESHOOTING.md)

## Getting Help

- 💬 [Discussions](../../discussions) - Ask questions
- 🐛 [Issues](../../issues) - Report bugs
- 📧 Email: support@proactive-assistant.dev

---

**Enjoy your intelligent coding companion! 🤖✨**
