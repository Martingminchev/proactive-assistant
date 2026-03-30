# 🚀 Quick Start: Tray-Based Proactive Assistant

## The 30-Second Version

```bash
# 1. Start MongoDB (if not running)
mongod

# 2. Start backend
cd server && npm start

# 3. Start tray app (new!)
cd tray && npm start

# 4. Look for 🤖 in your menu bar!
```

---

## What You'll See

### 1. Tray Icon Appears
```
macOS:    Top-right menu bar
Windows:  Bottom-right system tray
Linux:    Top panel (varies by DE)
```

### 2. Icon Changes Based on Activity
- 🔵 **Blue pulse** = Watching silently
- 🟡 **Amber** = Has suggestion
- 🔴 **Red pulse** = You're stuck!
- 🟣 **Purple** = Focus mode

### 3. Click Icon → Quick Window Opens
Shows:
- What you're working on
- Active suggestions (1-3 max)
- Quick actions

### 4. Receive Notifications
When:
- Stuck on error (20+ min)
- Been coding 2+ hours (break reminder)
- Context to recover (after interruption)
- Achievement unlocked (streaks!)

---

## First Time Setup

### 1. Install All Dependencies

```bash
# Terminal 1: Server
cd server
npm install

# Terminal 2: Tray (NEW!)
cd tray
npm install
```

### 2. Start Everything

```bash
# Terminal 1: MongoDB
mongod

# Terminal 2: Server
cd server
npm start

# Terminal 3: Tray App
cd tray
npm start
```

### 3. Grant Permissions (macOS)

When first running, macOS may ask for:
- **Accessibility** (for keyboard/mouse monitoring)
- **Screen Recording** (for WPE vision data)
- **Notifications** (for proactive alerts)

Grant all for best experience.

---

## Using the Assistant

### Daily Workflow

**Morning:**
1. Start tray app
2. Click icon → See today's focus
3. Receive morning brief notification

**During Work:**
1. AI watches silently (blue pulse)
2. Get stuck on bug for 20min
3. Icon turns red, notification appears
4. Click "Show Fix" → See solution
5. Back to work!

**Breaks:**
1. Code for 2 hours
2. Notification: "Time for a break?"
3. Click "5 Min Break"
4. Timer starts, icon purple (focus mode)

**Evening:**
1. Click tray icon
2. See daily stats: "You shipped 3 features!"
3. Celebrate streak! 🔥

---

## Controls

### Click Tray Icon
- **Left click** = Open quick window
- **Right click** = Context menu (Settings, Focus Mode, Quit)

### Quick Window
- **Suggestion cards** = Click primary action
- **Swipe left** = Dismiss (mobile)
- **Click X** = Dismiss (desktop)
- **Focus button** = Enable focus mode
- **Esc key** = Close window

### Notifications
- **Click notification** = Open quick window
- **Click action button** = Do action directly
- **Dismiss** = Goes away, remembered for learning

---

## Smart Features

### It Knows When NOT to Interrupt
- Typing fast for 5+ min → Deep flow, won't interrupt
- Debugging (breakpoints) → Thinking mode, won't interrupt
- Meeting on calendar → Won't interrupt
- Focus mode enabled → Won't interrupt

### It Learns
- Dismissed 3x → Won't suggest again today
- Accepted often → Will suggest similar things
- 30-min rule → Max 1 suggestion per 30 minutes

### It Encourages
- 3-day streak → "🔥 You're on fire!"
- Shipped feature → "🎉 Nice work!"
- Back from break → "Ready to continue?"

---

## Troubleshooting

### "Icon not showing"
**macOS:** Look in menu bar overflow (...)
**Windows:** Click up arrow in system tray
**Linux:** May need `sudo apt install libappindicator3-1`

### "Not getting notifications"
1. Check OS notification settings
2. Check Do Not Disturb is OFF
3. Check tray app has notification permission

### "Too many interruptions"
Enable **Focus Mode** (right-click tray icon)
Or adjust sensitivity in Settings

### "Not getting suggestions"
1. Check Pieces OS is running
2. Check server is running
3. Use computer for 30+ minutes (LTM needs data)
4. Run diagnostic: `node server/scripts/diagnose-pieces-api.js`

---

## Configuration

### Focus Mode (Do Not Disturb)
**Right-click tray icon → Focus Mode → 25 minutes**

No interruptions for set time. Icon turns purple.

### Settings
**Right-click tray icon → Settings**
- Interruption sensitivity
- Notification preferences
- Quiet hours (no notifications 10pm-8am)
- Theme (dark/light)

### Keyboard Shortcuts
- `Cmd/Ctrl + Shift + A` = Open quick window
- `Cmd/Ctrl + Shift + F` = Toggle focus mode
- `Esc` = Close quick window

---

## What's Different from Dashboard?

| Before | After |
|--------|-------|
| Open browser | Icon always visible |
| Check dashboard | Notifications come to you |
| Read generic tips | Get contextual help |
| Passive | Proactive |
| Cluttered UI | Minimal, focused |
| Forget to check | Always watching |

---

## Key Files

| File | What It Does |
|------|--------------|
| `tray/main.js` | Electron app entry point |
| `tray/TrayManager.js` | Icon states & animations |
| `server/services/interruptionManager.js` | Smart interruption logic |
| `server/services/notificationService.js` | Rich notifications |
| `client/src/components/tray/QuickWindow.jsx` | UI component |

---

## Next Steps

1. ✅ Start tray app
2. ✅ Work normally for a day
3. ✅ Notice icon changing
4. ✅ Click suggestions that help
5. ✅ Dismiss ones that don't
6. ✅ Let it learn your preferences

**The more you use it, the smarter it gets!**

---

## Help

Stuck? Run diagnostics:
```bash
cd server
node scripts/diagnose-pieces-api.js
```

Or check:
- `TRAY_APP_INTEGRATION.md` - Full integration guide
- `DESIGN_SYNTHESIS.md` - Design philosophy
- `RESEARCH_PROACTIVE_UX.md` - UX research findings

---

**Ready? Start the tray app and let the companion watch over your work! 🤖**
