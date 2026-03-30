# Proactive AI Assistant

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=proactive-assistant.proactive-ai-assistant)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.74%2B-blue.svg)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

> 🤖 An intelligent VS Code companion that watches your workflow and delivers contextual suggestions at exactly the right moment—powered by Pieces OS.

---

## ✨ Features

- **🎯 Smart Interruptions** — Suggestions appear only when you're stuck, idle, or need them most
- **🧠 Context-Aware** — Leverages your coding activity and Pieces assets for personalized insights
- **🌊 Flow State Detection** — Automatically detects when you're in deep flow vs. struggling
- **🔕 Focus Mode** — Suppress non-critical suggestions during deep work sessions
- **🌙 Quiet Hours** — Configure times when you don't want to be interrupted
- **⚡ Quick Actions** — Apply fixes, open files, or snooze suggestions with one click
- **📊 Activity Insights** — Track your coding patterns and productivity metrics
- **🔒 Privacy-First** — All processing happens locally via Pieces OS

---

## 🚀 Quick Start

### 1. Install Pieces OS

Download and install [Pieces OS](https://pieces.app) — the local AI engine that powers this extension.

### 2. Install the Extension

```bash
code --install-extension proactive-ai-assistant-0.1.0.vsix
```

Or search for "Proactive AI Assistant" in the VS Code Marketplace.

### 3. Start Coding

The assistant automatically activates and begins monitoring your workflow. You'll see suggestions appear contextually as you work!

---

## 📦 Installation

### Prerequisites

- VS Code 1.74 or higher
- Pieces OS installed and running
- Windows, macOS, or Linux

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Proactive AI Assistant"
4. Click **Install**

### From VSIX

```bash
# Download the .vsix file from releases
# In VS Code:
# 1. Go to Extensions view
# 2. Click "..." → "Install from VSIX"
# 3. Select the downloaded file
```

### From Source

```bash
git clone https://github.com/example/proactive-ai-assistant.git
cd proactive-ai-assistant/vscode-proactive-assistant
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

---

## 🎮 Usage

### Opening the Assistant Panel

- **Keyboard**: `Ctrl+Shift+A` (Windows/Linux) / `Cmd+Shift+A` (Mac)
- **Command Palette**: `Proactive Assistant: Open Assistant Panel`
- **Activity Bar**: Click the 💡 icon in the left sidebar

### Working with Suggestions

When the assistant detects you might need help, it shows a suggestion with action buttons:

| Action | Description |
|--------|-------------|
| **Apply Fix** | Automatically fix errors or apply code changes |
| **Explain** | Get detailed explanation of the suggestion |
| **Dismiss** | Close the suggestion without action |
| **Snooze** | Temporarily pause suggestions (configurable duration) |

### Focus Mode

Enable Focus Mode when you need uninterrupted deep work:

- **Keyboard**: `Ctrl+Shift+F` / `Cmd+Shift+F`
- **Command**: `Proactive Assistant: Toggle Focus Mode`
- **Status Bar**: Click the 🔔/🔕 icon

In Focus Mode, only urgent suggestions (like critical errors) will interrupt you.

### Viewing Statistics

Track your productivity patterns:

- **Command**: `Proactive Assistant: Show Activity Statistics`
- **Panel**: Click the 📊 icon in the Assistant panel header

---

## ⚙️ Configuration

All settings are available in VS Code settings under `Proactive AI Assistant`.

### Core Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proactiveAssistant.enabled` | boolean | `true` | Enable/disable the assistant |
| `proactiveAssistant.focusMode` | boolean | `false` | Suppress non-critical suggestions |
| `proactiveAssistant.interruptionThreshold` | number | `0.7` | Confidence threshold for showing suggestions (0-1) |
| `proactiveAssistant.snoozeDuration` | number | `30` | Default snooze duration in minutes (5-240) |
| `proactiveAssistant.askDismissalReason` | boolean | `true` | Ask for reason when dismissing suggestions |

### Quiet Hours

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proactiveAssistant.quietHours.enabled` | boolean | `false` | Enable quiet hours |
| `proactiveAssistant.quietHours.start` | string | `"22:00"` | Start time (HH:MM format) |
| `proactiveAssistant.quietHours.end` | string | `"08:00"` | End time (HH:MM format) |

### Pieces OS Integration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proactiveAssistant.piecesOs.enabled` | boolean | `true` | Enable Pieces OS integration |
| `proactiveAssistant.piecesOs.host` | string | `"localhost"` | Pieces OS server host |
| `proactiveAssistant.piecesOs.port` | number | `5323` | Pieces OS server port |

### Activity Tracking

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proactiveAssistant.activityTracking.enabled` | boolean | `true` | Enable activity tracking |
| `proactiveAssistant.activityTracking.sampleInterval` | number | `5000` | Sampling interval in milliseconds (1000-60000) |

### Logging

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proactiveAssistant.logging.level` | enum | `"info"` | Log level: `debug`, `info`, `warn`, `error` |

### Example settings.json

```json
{
  "proactiveAssistant.enabled": true,
  "proactiveAssistant.focusMode": false,
  "proactiveAssistant.interruptionThreshold": 0.8,
  "proactiveAssistant.snoozeDuration": 60,
  "proactiveAssistant.quietHours.enabled": true,
  "proactiveAssistant.quietHours.start": "22:00",
  "proactiveAssistant.quietHours.end": "07:00",
  "proactiveAssistant.piecesOs.port": 5323,
  "proactiveAssistant.logging.level": "info"
}
```

---

## ⌨️ Keyboard Shortcuts

| Command | Windows/Linux | Mac |
|---------|---------------|-----|
| Open Assistant Panel | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Toggle Focus Mode | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Dismiss Suggestion | `Esc` | `Esc` |
| Apply Fix | `Ctrl+Shift+Enter` | `Cmd+Shift+Enter` |

Customize these in **File** → **Preferences** → **Keyboard Shortcuts**.

---

## 🔧 Troubleshooting

### Extension not activating

1. Check that Pieces OS is running
2. Verify VS Code version is 1.74 or higher
3. Check the Output panel → "Proactive AI Assistant" for errors

### No suggestions appearing

1. Ensure `proactiveAssistant.enabled` is `true`
2. Check if you're in Focus Mode or Quiet Hours
3. Lower the `interruptionThreshold` setting
4. Verify Pieces OS connection status

### High CPU usage

1. Increase `activityTracking.sampleInterval` (try 10000ms)
2. Disable activity tracking temporarily
3. Check logs for error loops

### Pieces OS connection failed

1. Ensure Pieces OS is running on the configured host/port
2. Check firewall settings
3. Verify default port 5323 is available

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for detailed troubleshooting.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  VS Code Extension                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │   Commands  │  │   Services   │  │  Panel Provider│ │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘ │
│         └─────────────────┴──────────────────┘          │
│                           │                             │
│                    ┌──────┴──────┐                     │
│                    │ Activity    │                     │
│                    │ Monitor     │                     │
│                    └──────┬──────┘                     │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│                  Pieces OS│Local)                       │
│              ┌────────────┴────────────┐                │
│              │    QGPT API / LTM       │                │
│              │    Copilot Engine       │                │
│              └─────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full technical details.

---

## 📚 Documentation

- [📖 Installation Guide](docs/INSTALLATION.md)
- [🎮 Usage Guide](docs/USAGE.md)
- [⚙️ Configuration Reference](docs/CONFIGURATION.md)
- [🏗️ Architecture](docs/ARCHITECTURE.md)
- [🔧 Troubleshooting](docs/TROUBLESHOOTING.md)
- [❓ FAQ](docs/FAQ.md)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- 🐛 [Report bugs](https://github.com/example/proactive-ai-assistant/issues)
- 💡 [Suggest features](https://github.com/example/proactive-ai-assistant/issues)
- 🔧 [Submit pull requests](https://github.com/example/proactive-ai-assistant/pulls)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Powered by [Pieces for Developers](https://pieces.app)
- Built with ❤️ for the VS Code community

---

<div align="center">

**[⬆ Back to Top](#proactive-ai-assistant)**

Made with 💡 and ☕

</div>
