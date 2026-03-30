# Usage Guide

Learn how to get the most out of the Proactive AI Assistant.

---

## 📊 Understanding Status Bar States

The status bar indicator (bottom-right of VS Code) shows the current state:

| Icon | State | Description |
|------|-------|-------------|
| 💡 | Active | Assistant is monitoring and ready |
| 🔕 | Focus Mode | Non-critical suggestions suppressed |
| 😴 | Snoozed | All suggestions paused temporarily |
| ⏸️ | Paused | Quiet hours or disabled |
| ⚠️ | Error | Connection or configuration issue |

### Status Bar Interactions

- **Click** the status bar icon to toggle Focus Mode
- **Hover** for current status details

---

## 🖥️ Opening the Assistant Panel

### Methods

| Method | Action |
|--------|--------|
| Keyboard Shortcut | `Ctrl+Shift+A` (Win/Linux) / `Cmd+Shift+A` (Mac) |
| Command Palette | Type "Open Assistant Panel" |
| Activity Bar | Click the 💡 icon |
| Status Bar | Click the status indicator |

### Panel Layout

```
┌─────────────────────────────────────────┐
│ Proactive Assistant         [⚙️] [📊]  │  ← Header with actions
├─────────────────────────────────────────┤
│                                         │
│  Current Status                         │  ← Connection & flow state
│  ├─ Pieces OS: Connected ✅             │
│  ├─ Flow State: Working                 │
│  └─ Suggestions Today: 3                │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Recent Suggestions                     │  ← History of recent items
│  ├─ ⚠️ Fix: Type error...              │
│  ├─ 🎉 Error resolved!                  │
│  └─ ☕ Time for a break?                │
│                                         │
└─────────────────────────────────────────┘
```

---

## 💡 Working with Suggestions

### Suggestion Types

| Type | Icon | When Shown | Priority |
|------|------|------------|----------|
| Error Fix | ⚠️ | Errors detected | Urgent |
| Stuck Help | 🔍 | Prolonged struggle | High |
| Wellness | ☕ | Extended work periods | Low |
| Celebration | 🎉 | Achievements | Medium |
| Context Recovery | 📝 | Return from break | Low |
| Productivity | 💡 | Optimization chances | Medium |
| Learning | 📚 | Educational moments | Low |

### Responding to Suggestions

When a suggestion appears:

```
┌─────────────────────────────────────────┐
│ ⚠️ Fix: Type error on line 42           │  ← Title
│                                         │
│ I found a type mismatch. Apply fix?     │  ← Description
│                                         │
│ [Apply Fix] [Explain] [Dismiss]        │  ← Actions
└─────────────────────────────────────────┘
```

#### Action Types

| Action | What It Does |
|--------|--------------|
| **Apply Fix** | Automatically fixes the code issue |
| **Explain** | Shows detailed explanation |
| **Dismiss** | Closes the suggestion |
| **Snooze** | Pauses suggestions for a duration |
| **Open File** | Opens a related file |
| **Run** | Executes a command or workflow |

### Keyboard Shortcuts During Suggestions

| Key | Action |
|-----|--------|
| `Escape` | Dismiss current suggestion |
| `Ctrl+Shift+Enter` | Apply fix / primary action |

---

## 🎯 Focus Mode Usage

### When to Use Focus Mode

Enable Focus Mode when you:
- Need uninterrupted deep work
- Are in a flow state
- Have deadlines approaching
- Are debugging complex issues

### How to Toggle

| Method | Action |
|--------|--------|
| Keyboard | `Ctrl+Shift+F` / `Cmd+Shift+F` |
| Command Palette | "Toggle Focus Mode" |
| Status Bar | Click the 💡/🔕 icon |
| Panel | Click the 🚫 button in header |

### Focus Mode Behavior

```
Normal Mode              Focus Mode
─────────────────────────────────────────
All suggestions    →     Urgent only
Wellness tips      →     Hidden
Productivity tips  →     Hidden
Error fixes        →     Still shown
Celebrations       →     Hidden
```

### Automatic Focus Mode (Coming Soon)

The extension can automatically enter Focus Mode when it detects:
- Extended typing without pauses
- Complex refactoring patterns
- Multiple file edits in succession

---

## 📈 Statistics and Insights

### Viewing Your Stats

Open statistics via:
- Command Palette: "Show Activity Statistics"
- Panel: Click 📊 icon in header
- Status bar context menu

### Available Metrics

```
┌─────────────────────────────────────────┐
│         Your Coding Activity            │
├─────────────────────────────────────────┤
│                                         │
│  Session Time        2h 34m            │
│  Flow State Time                        │
│  ├─ Deep Flow        45m               │
│  ├─ Working          1h 20m            │
│  ├─ Idle             15m               │
│  └─ Stuck            14m               │
│                                         │
│  Suggestions           8                │
│  ├─ Accepted           5 (62%)          │
│  ├─ Dismissed          2 (25%)          │
│  └─ Snoozed            1 (13%)          │
│                                         │
│  Files Worked On      12                │
│  Top Language       TypeScript          │
│                                         │
└─────────────────────────────────────────┘
```

### Understanding Flow States

| State | Description | Typical Duration |
|-------|-------------|------------------|
| **Deep Flow** | Highly focused, productive coding | 30-90 min |
| **Working** | Active development | Variable |
| **Idle** | No activity detected | >5 min |
| **Stuck** | Struggling with a problem | >10 min |
| **Frustrated** | Repeated errors, rapid changes | >5 min |

### Using Insights to Improve

1. **Track patterns**: Notice when you get stuck most often
2. **Optimize flow**: Identify what triggers deep flow
3. **Take breaks**: Use wellness suggestions as reminders
4. **Review dismissals**: See which suggestions aren't helpful

---

## 🎨 Tips and Tricks

### Power User Shortcuts

```jsonc
// keybindings.json
{
  "key": "ctrl+shift+a",
  "command": "proactiveAssistant.openPanel",
  "when": "proactiveAssistant.enabled"
},
{
  "key": "ctrl+shift+f",
  "command": "proactiveAssistant.toggleFocusMode",
  "when": "proactiveAssistant.enabled"
}
```

### Customizing Suggestion Frequency

Too many suggestions?
```json
{
  "proactiveAssistant.interruptionThreshold": 0.85
}
```

Not enough suggestions?
```json
{
  "proactiveAssistant.interruptionThreshold": 0.5
}
```

### Quick Snooze

Need a quick break from suggestions?

1. Click status bar icon
2. Select snooze duration
3. Or use: `Ctrl+Shift+P` → "Snooze Suggestions"

### Dismissal Feedback

Help improve suggestions by providing dismissal reasons:

```json
{
  "proactiveAssistant.askDismissalReason": true
}
```

When you dismiss, you'll see:
- "Not relevant"
- "Bad timing"
- "Already know this"
- "Other"

### Context Recovery Workflow

When returning from a break:
1. Check the panel for "Continue where you left off?"
2. Click **Open File** to jump back
3. Review your last position

### Error Fix Workflow

When stuck on an error:
1. Wait for the ⚠️ suggestion
2. Click **Explain** to understand the issue
3. Click **Apply Fix** if the solution looks good
4. Or use **Dismiss** if you prefer to fix manually

### Wellness Integration

Make the most of wellness suggestions:
- Set up Quiet Hours for your sleep schedule
- Accept break reminders to prevent burnout
- Use the 20-20-20 rule for eye health

---

## 🔍 Advanced Features

### Command Palette Reference

| Command | Purpose |
|---------|---------|
| Open Assistant Panel | Show the main panel |
| Toggle Focus Mode | Enable/disable focus mode |
| Show Activity Statistics | View your metrics |
| Dismiss Current Suggestion | Close active suggestion |
| Apply Suggested Fix | Execute the fix |
| Snooze Suggestions | Pause temporarily |
| Configure Settings | Open settings |
| Show Welcome | Reopen welcome page |
| Show Extension Logs | View output channel |
| Accept Suggestion | Confirm action |
| Reset Flow State | Clear current state |

### Settings Sync

Your preferences sync across VS Code installations:
- Settings are stored in VS Code's global state
- Sync via VS Code Settings Sync feature
- Or manually backup `settings.json`

---

## 📚 Related Documentation

- [Configuration Reference](CONFIGURATION.md) — All settings explained
- [Troubleshooting](TROUBLESHOOTING.md) — Common issues and solutions
- [FAQ](FAQ.md) — Frequently asked questions
