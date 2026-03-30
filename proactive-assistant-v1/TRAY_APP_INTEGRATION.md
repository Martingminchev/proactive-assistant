# 🤖 Tray App Integration Guide

## Overview

We've transformed the Proactive AI Assistant from a **web dashboard** to a **system tray companion** that lives in your menu bar and proactively helps without clutter.

---

## 🎯 What's New

### Old Experience
```
1. Open browser
2. Navigate to localhost:5173
3. See cluttered dashboard
4. Read generic suggestions
5. Forget to check it
```

### New Experience
```
1. Tray icon in menu bar (always visible)
2. AI watches your work silently
3. Detects you're stuck → Icon pulses amber
4. Notification: "Stuck on useEffect? Tap for help"
5. Click → Quick window with solution
6. One click → Back to work
```

---

## 📁 New Project Structure

```
proactive-assistant/
│
├── tray/                          # NEW: Electron tray app
│   ├── main.js                    # Electron main process
│   ├── preload.js                 # Secure IPC bridge
│   ├── TrayManager.js             # Icon state management
│   ├── WindowManager.js           # Quick window positioning
│   ├── package.json               # Electron dependencies
│   └── assets/
│       └── icons/                 # Tray icons for states
│
├── server/
│   ├── services/
│   │   ├── interruptionManager.js # NEW: Smart interruption
│   │   └── notificationService.js # NEW: Rich notifications
│   └── models/
│       └── DismissedSuggestion.js # NEW: Track dismissals
│
├── client/
│   └── src/
│       ├── components/
│       │   └── tray/              # NEW: Tray UI components
│       │       ├── TrayIcon.jsx
│       │       ├── QuickWindow.jsx
│       │       ├── SuggestionCard.jsx
│       │       ├── CurrentStatus.jsx
│       │       ├── FocusToggle.jsx
│       │       └── Celebration.jsx
│       │
│       └── services/
│           └── notificationClient.js  # NEW: Client notifications
│
└── HOW_TO_RUN_TRAY.md             # NEW: Setup instructions
```

---

## 🎨 The Experience

### Tray Icon States

| State | Visual | Meaning |
|-------|--------|---------|
| **Watching** | 🔵 Blue pulse | AI is monitoring silently |
| **Suggestion** | 🟡 Amber solid | Has helpful suggestion |
| **Urgent** | 🔴 Red pulse | You're stuck, need help |
| **Focus** | 🟣 Purple solid | Focus mode active (no interruptions) |
| **Celebration** | 🟢 Green + spark | Achievement unlocked! |

### The Quick Window

Click tray icon → Opens compact window:

```
┌─────────────────────────────┐
│ 🤖 Companion     ─ □ ✕      │
├─────────────────────────────┤
│ 👁 Watching you work on      │
│ auth.ts for 12 minutes      │
├─────────────────────────────┤
│ 📌 Active Suggestions       │
│ ┌─────────────────────────┐ │
│ │ useEffect dependency?  │ │
│ │ [Show Fix]     [✕]     │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 2hr coding streak 🔥   │ │
│ │ Take a break?          │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ [Focus] [Brief] [⚙️]       │
└─────────────────────────────┘
```

### Notifications

**When stuck on error:**
```
┌─────────────────────────────┐
│ 🤖 Companion                │
├─────────────────────────────┤
│ Stuck on useEffect?         │
│                             │
│ You've been debugging for   │
│ 25 minutes. I can help.     │
│                             │
│ [Show Fix]  [Dismiss]       │
└─────────────────────────────┘
```

**When context switching:**
```
┌─────────────────────────────┐
│ 🤖 Companion                │
├─────────────────────────────┤
│ Continue where you left off?│
│                             │
│ You were working on auth.ts │
│ 2 TODOs remaining           │
│                             │
│ [Open File]  [Dismiss]      │
└─────────────────────────────┘
```

---

## 🧠 Smart Interruption System

### How It Decides to Interrupt

The `interruptionManager` analyzes:
- **Typing velocity** - Fast = in flow, don't interrupt
- **Backspace ratio** - >40% = frustrated, offer help
- **Time on task** - 20+ min on error = stuck
- **Tab switching** - Rapid = context switching, good time
- **Idle time** - 5+ min idle = available for suggestions

### Interruption Levels

| Level | Name | Use Case | UI |
|-------|------|----------|-----|
| 1 | Whisper | Low confidence | Tray icon pulse only |
| 2 | Nudge | Good suggestion | OS notification |
| 3 | Tap | Urgent | Quick window popup |
| 4 | Emergency | Critical | Notification + sound |

### Anti-Annoyance Rules

1. **30-Minute Rule**: Max 1 proactive notification per 30 minutes
2. **3-Strike Rule**: Dismissed 3x = blacklisted for today
3. **Focus Mode**: Complete suppression when enabled
4. **Flow Protection**: Never interrupt deep work (>5min steady typing)

---

## 🚀 How to Run (New Tray App)

### Step 1: Install Dependencies

```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install

# Tray app dependencies
cd ../tray
npm install
```

### Step 2: Start Backend

```bash
cd server
npm start
# Wait for "Server running on http://localhost:3001"
```

### Step 3: Start Tray App

```bash
cd tray
npm start
# Tray icon appears in menu bar!
```

### Step 4: Use It!

- Watch tray icon change as you work
- Click icon for quick window
- Right-click for settings/quit
- Receive helpful notifications

---

## 🛠️ Building for Production

### Build Tray App

```bash
cd tray

# Build all platforms
npm run build:all

# Or specific platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Output in `tray/dist/`:
- Windows: `ProactiveAssistant Setup.exe`
- macOS: `ProactiveAssistant.dmg`
- Linux: `proactive-assistant.AppImage`

---

## 🎨 Customization

### Change Tray Icon Appearance

Edit `tray/TrayManager.js`:
```javascript
this.icons = {
  watching: path.join(__dirname, 'assets/icons/blue-dot.png'),
  suggestion: path.join(__dirname, 'assets/icons/amber-dot.png'),
  urgent: path.join(__dirname, 'assets/icons/red-dot.png'),
  // ... etc
};
```

### Adjust Interruption Timing

Edit `server/services/interruptionManager.js`:
```javascript
const THRESHOLDS = {
  STUCK_MINUTES: 20,      // Change from 20 min
  FLOW_TYPING_SECONDS: 5, // Change from 5 sec
  MAX_SUGGESTIONS_PER_HOUR: 2, // Change from 2
  // ... etc
};
```

### Customize Notifications

Edit `server/services/notificationService.js`:
```javascript
const templates = {
  stuck: {
    title: 'Your Custom Title',
    body: 'Your custom message: {{topic}}',
    // ... etc
  }
};
```

---

## 📊 Monitoring

### Check Interruption Stats

```bash
curl http://localhost:3001/api/interruption/status
```

### Check Dismissal Stats

```bash
curl http://localhost:3001/api/dismissals/stats
```

### Reset Everything

```bash
# Reset 30-min timer
curl -X POST http://localhost:3001/api/interruption/reset

# Clear all dismissals
curl -X DELETE http://localhost:3001/api/dismissals/clear

# Toggle focus mode
curl -X POST http://localhost:3001/api/interruption/focus-mode \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

---

## 🔧 Troubleshooting

### Tray Icon Not Showing

**macOS:**
- Check menu bar has space (macOS hides overflow)
- Look in "..." menu if too many icons

**Windows:**
- Check system tray overflow (up arrow)
- Right-click taskbar → Taskbar settings → Show all icons

**Linux:**
- Depends on desktop environment
- May need `libappindicator` installed

### Notifications Not Appearing

1. Check OS notification permissions
2. Check Do Not Disturb is off
3. Check `notificationService` is configured

### Too Many/Few Interruptions

Adjust thresholds in `interruptionManager.js`:
```javascript
// More interruptions = lower thresholds
// Fewer interruptions = higher thresholds
STUCK_MINUTES: 15, // More aggressive
STUCK_MINUTES: 30, // Less aggressive
```

---

## 🎯 Success Metrics

Track these to see if it's working:

1. **Suggestion Acceptance Rate** >70%
2. **Notification Dismissal Rate** <30%
3. **Focus Mode Usage** (are people using it?)
4. **Tray Window Opens** (engagement metric)

View stats:
```bash
curl http://localhost:3001/api/notifications/stats
curl http://localhost:3001/api/dismissals/stats
```

---

## 🔄 Migration from Old System

If you were using the web dashboard:

1. ✅ Backend is compatible (new services added)
2. ✅ Data persists (same MongoDB)
3. 🔄 Stop using browser tab
4. 🔄 Start using tray app
5. 🔄 Enjoy proactive help instead of passive checking!

The old dashboard still works at `http://localhost:5173` if you want both.

---

**The tray app transforms the assistant from something you check into something that actively helps you. It feels like a skilled pair programmer sitting next to you.**
