# 🎯 Final Instructions: Run Your New Proactive Assistant

## What You Now Have

A **complete transformation** from a cluttered web dashboard to an **intelligent system tray companion** that:
- ✅ Lives in your menu bar (always visible)
- ✅ Proactively interrupts when you're stuck
- ✅ Respects your flow state (won't interrupt deep work)
- ✅ Learns from your feedback
- ✅ Encourages and celebrates achievements

---

## 📋 Prerequisites Check

Before starting, make sure you have:
- [ ] MongoDB installed and running
- [ ] Pieces OS installed and running
- [ ] Node.js 18+ installed
- [ ] Dependencies installed (see below)

---

## 🚀 Step-by-Step Setup

### Step 1: Install Dependencies

Open **3 terminals** and run:

```bash
# Terminal 1: Server dependencies
cd server
npm install

# Terminal 2: Tray dependencies (NEW!)
cd tray
npm install

# Terminal 3: Client dependencies (optional, for web dashboard)
cd client
npm install
```

---

### Step 2: Start MongoDB

```bash
# Terminal 1
mongod
# Should show: "Waiting for connections on port 27017"
```

---

### Step 3: Start Backend Server

```bash
# Terminal 2
cd server
npm start
# Wait for: "Server running on http://localhost:3001"
# Wait for: "✓ Connected to Pieces OS"
```

---

### Step 4: Start Tray App (NEW!)

```bash
# Terminal 3
cd tray
npm start
```

You should see:
- 🤖 Icon appears in your menu bar (macOS) or system tray (Windows/Linux)
- Icon is **blue pulsing** (watching state)
- Right-click icon for menu (Settings, Focus Mode, Quit)

---

### Step 5: Test It

**Click the tray icon** (left click):
- Quick window opens
- Shows current status
- May show suggestions if any

**Right-click the tray icon**:
- Settings
- Focus Mode
- Quit

**Wait for notifications**:
- Work on code for 20+ minutes
- If stuck on error, you'll get a notification
- Or get wellness reminder after 2 hours

---

## 🎮 How to Use

### Daily Workflow

**Morning:**
1. Start tray app (if not auto-starting)
2. Click icon → Check today's focus
3. Work normally

**During Work:**
1. AI watches silently (blue pulse)
2. Get stuck? Icon turns **red**, notification appears
3. Click "Show Fix" → See solution
4. Click outside window → Close, back to work

**Taking Breaks:**
1. Code for 2 hours → Wellness notification
2. Click "5 Min Break"
3. Timer starts, icon turns **purple**
4. No interruptions during break

**Evening:**
1. Click icon → See daily stats
2. Celebrate streaks! 🔥
3. Quit or leave running

---

## 🎨 Understanding the Icon

| Color | State | Meaning |
|-------|-------|---------|
| 🔵 **Blue pulse** | Watching | AI monitoring silently |
| 🟡 **Amber solid** | Suggestion | Has helpful suggestion |
| 🔴 **Red pulse** | Urgent | You're stuck, need help! |
| 🟣 **Purple solid** | Focus Mode | No interruptions |
| 🟢 **Green solid** | Celebration | Achievement! |

---

## 🎯 Key Features

### 1. Smart Interruption
Won't interrupt when:
- Typing fast for 5+ minutes (deep flow)
- Debugging with breakpoints
- Focus mode enabled
- Calendar shows meeting

### 2. Context Recovery
After interruption:
- "Continue where you left off?"
- Shows last file + TODOs
- One click to resume

### 3. Stuck Detection
- Monitors for errors
- Tracks time on same issue
- Offers help after 20 min

### 4. Wellness Checks
- Break reminders after 2 hours
- Eye strain warnings
- Prevents burnout

### 5. Celebrations
- Daily streaks
- Feature shipped
- Productivity milestones

---

## 🔧 Customization

### Enable/Disable Interruptions

**Right-click icon → Focus Mode → 25 minutes**

Or API:
```bash
curl -X POST http://localhost:3001/api/interruption/focus-mode \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "duration": 25}'
```

### Adjust Sensitivity

Edit `server/services/interruptionManager.js`:
```javascript
// More interruptions
const THRESHOLDS = {
  STUCK_MINUTES: 15,        // Was 20
  FRUSTRATED_BACKSPACE: 30, // Was 40%
  MAX_SUGGESTIONS_PER_HOUR: 3 // Was 2
};

// Fewer interruptions
const THRESHOLDS = {
  STUCK_MINUTES: 30,        // Was 20
  FRUSTRATED_BACKSPACE: 50, // Was 40%
  MAX_SUGGESTIONS_PER_HOUR: 1 // Was 2
};
```

Then restart server.

---

## 🐛 Troubleshooting

### Issue: Icon not showing

**macOS:**
- Check menu bar isn't full (look for "...")
- Grant accessibility permissions

**Windows:**
- Check system tray overflow (up arrow)
- Right-click taskbar → Show all icons

**Linux:**
```bash
sudo apt install libappindicator3-1
```

### Issue: No notifications

1. Check OS notification settings
2. Check Do Not Disturb is OFF
3. Grant notification permissions to tray app
4. Check `server/scripts/diagnose-pieces-api.js` output

### Issue: Not getting suggestions

1. Make sure Pieces OS is running
2. Use computer for 30+ minutes (LTM needs data)
3. Check interruption manager isn't in focus mode
4. Run diagnostic: `node server/scripts/diagnose-pieces-api.js`

### Issue: Too many interruptions

1. Enable Focus Mode
2. Adjust thresholds (see Customization)
3. Dismiss suggestions 3x = blacklisted for day

---

## 📊 Monitoring

### Check Stats

```bash
# Interruption stats
curl http://localhost:3001/api/interruption/status

# Dismissal stats
curl http://localhost:3001/api/dismissals/stats

# Notification stats
curl http://localhost:3001/api/notifications/stats
```

### Reset Everything

```bash
# Reset 30-min timer
curl -X POST http://localhost:3001/api/interruption/reset

# Clear all dismissals
curl -X DELETE http://localhost:3001/api/dismissals/clear

# Exit focus mode
curl -X POST http://localhost:3001/api/interruption/focus-mode \
  -d '{"enabled": false}'
```

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `tray/main.js` | Electron app entry |
| `tray/TrayManager.js` | Icon states & animations |
| `server/services/interruptionManager.js` | Smart interruption logic |
| `server/services/notificationService.js` | Rich notifications |
| `client/src/components/tray/QuickWindow.jsx` | UI component |
| `QUICK_START_TRAY.md` | Quick reference |
| `TRAY_APP_INTEGRATION.md` | Full integration guide |
| `NEW_ARCHITECTURE_VISUAL.md` | Architecture diagrams |

---

## 🎉 Success Checklist

- [ ] Tray icon appears in menu bar
- [ ] Icon pulses blue (watching)
- [ ] Click icon → Quick window opens
- [ ] Right-click → Menu works
- [ ] Receive notification (may take 20+ min of work)
- [ ] Dismiss/accept suggestions
- [ ] Focus mode works (no interruptions)

**All checked? You're ready to go! 🤖**

---

## 💡 Tips

1. **Let it learn** - Dismiss suggestions that don't help, accept ones that do
2. **Use Focus Mode** - When you need deep work time
3. **Check daily stats** - Evening review of productivity
4. **Keep it running** - The longer it runs, the smarter it gets
5. **Grant permissions** - Screen recording helps detect stuck states

---

## 🚀 Next Steps (Optional)

1. **Build for production:**
   ```bash
   cd tray
   npm run build:all
   ```

2. **Auto-start on login:**
   - macOS: System Preferences → Login Items
   - Windows: Task Manager → Startup
   - Linux: Depends on DE

3. **Customize icons:** Replace files in `tray/assets/icons/`

4. **Add sounds:** Edit `notificationService.js` for audio cues

---

## 📞 Help

Stuck? Check:
1. `server/scripts/diagnose-pieces-api.js` - Test Pieces connection
2. `server/scripts/quick-test.js` - Quick integration test
3. `TRAY_APP_INTEGRATION.md` - Detailed troubleshooting

---

**Your proactive assistant is now a true companion - always there, always watching, always ready to help! 🤖✨**
