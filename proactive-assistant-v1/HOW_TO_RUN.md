# 🚀 How to Run the Proactive AI Assistant

**Complete Setup & Run Guide**  
Last Updated: January 29, 2026

---

## 📋 Prerequisites

Make sure you have these installed:

1. **Node.js** 18+ 
   ```bash
   node --version  # Should show v18.x or higher
   ```

2. **MongoDB** (running locally)
   ```bash
   # Windows
   mongod
   
   # macOS/Linux
   sudo systemctl start mongod
   ```

3. **Pieces OS** (Pieces for Developers)
   - Download from: https://pieces.app
   - Start the app and let it run in background
   - On macOS: Grant Screen Recording permission in System Preferences

---

## 🏃 Quick Start (5 Minutes)

### Step 1: Start MongoDB

**Windows:**
```powershell
# In a new terminal
mongod
```

**macOS:**
```bash
# In a new terminal
brew services start mongodb-community
# OR
mongod --dbpath /usr/local/var/mongodb
```

**Linux:**
```bash
sudo systemctl start mongod
```

You should see: "Waiting for connections on port 27017"

---

### Step 2: Test Pieces Connection

Open a new terminal:
```bash
cd server
node scripts/diagnose-pieces-api.js
```

**Expected output:**
```
✓ Pieces OS found on port 39300
✓ Application registered successfully
✓ Assets: X items
✓ Workstream Summaries: X found
...
```

If you see errors:
- Make sure Pieces OS is running
- Check that MongoDB is running

---

### Step 3: Start Backend Server

In a new terminal:
```bash
cd server
npm start
```

**Expected output:**
```
🚀 Proactive AI Assistant Server
========================================
🌐 Server running on http://localhost:3001
📋 API Documentation: http://localhost:3001/api
💚 Health Check: http://localhost:3001/health
```

Leave this terminal running.

---

### Step 4: Start Frontend (New Terminal)

```bash
cd client
npm run dev
```

**Expected output:**
```
VITE v5.x
➜  Local:   http://localhost:5173/
➜  press h + enter to show help
```

---

### Step 5: Open in Browser

Go to: http://localhost:5173

You should see the **Proactive AI Assistant Dashboard**!

---

## 🧪 Testing Everything Works

### Test 1: Health Check
```bash
curl http://localhost:3001/health
```
Should return server status.

### Test 2: Context Health (New!)
```bash
curl http://localhost:3001/api/context/health
```
Shows data quality from Pieces OS.

### Test 3: Real-time Context (New!)
```bash
curl http://localhost:3001/api/context/realtime
```
Shows what you're doing right now.

### Test 4: Get Today's Brief
```bash
curl http://localhost:3001/api/briefs/today
```
Returns your personalized daily brief.

### Test 5: Check for Blockers (New!)
```bash
curl http://localhost:3001/api/context/blockers
```
Detects if you're stuck on something.

---

## 🎨 Using the New UI

The redesigned interface has a **"✨ New UI"** tab:

```
┌─────────────────────────────────────────────────────────┐
│  Feed  │  ✨ New UI  │  History  │  Goals  │  Settings  │
└─────────────────────────────────────────────────────────┘
```

Click **"✨ New UI"** to see:

1. **Current Focus** - What you're working on RIGHT NOW
2. **Action Center** - Immediate actions you should take
3. **Smart Brief** - Prioritized daily recommendations
4. **Insights Panel** - Patterns in your work
5. **Data Quality** - How well Pieces OS is tracking you

---

## 📁 Project Structure

```
proactive-assistant/
│
├── server/                          # Backend
│   ├── server.js                    # Main server (updated!)
│   ├── services/
│   │   ├── piecesCopilotService.js  # FIXED Pieces integration
│   │   ├── contextSummarizationService.js  # NEW
│   │   ├── contextHealthService.js  # NEW
│   │   ├── userCenteredAIService.js # NEW
│   │   └── intelligentBriefService.js # NEW
│   ├── routes/
│   │   ├── contextRoutes.js         # NEW endpoints
│   │   └── healthRoutes.js          # NEW health API
│   └── scripts/
│       ├── diagnose-pieces-api.js   # Test Pieces connection
│       └── quick-test.js            # Quick integration test
│
├── client/                          # Frontend (React)
│   └── src/
│       └── components/
│           ├── ActionCenter.jsx     # NEW
│           ├── CurrentFocus.jsx     # NEW
│           ├── InsightsPanel.jsx    # NEW
│           ├── DataQualityIndicator.jsx # NEW
│           └── SmartBrief.jsx       # NEW
│
└── HOW_TO_RUN.md                    # This file!
```

---

## 🔧 Troubleshooting

### Issue: "MongoDB connection failed"
**Fix:**
```bash
# Windows - make sure mongod is running
# In new terminal:
mongod

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

---

### Issue: "Pieces OS not found"
**Fix:**
1. Open Pieces for Developers app
2. Wait 10 seconds for it to fully start
3. Try again: `node scripts/diagnose-pieces-api.js`

---

### Issue: "WPE OCR not available"
**Fix (macOS only):**
1. Open System Preferences
2. Security & Privacy → Privacy → Screen Recording
3. Check the box for "Pieces OS"
4. Restart Pieces OS

**Note:** Windows and Linux users may have limited WPE functionality.

---

### Issue: Frontend shows "Unable to Connect"
**Fix:**
1. Make sure server is running (`npm start` in server/)
2. Check server port: `curl http://localhost:3001/health`
3. Check client `.env` file has correct server URL

---

### Issue: "Workstream summaries empty"
**This is normal if:**
- You just installed Pieces OS
- You haven't used your computer for 30+ minutes with Pieces running

**Fix:** Use your computer normally for 30+ minutes, then check again.

---

## 🔄 Daily Workflow

### Morning:
1. Start MongoDB (if not already running)
2. Make sure Pieces OS is running
3. Start backend: `cd server && npm start`
4. Start frontend: `cd client && npm run dev`
5. Open http://localhost:5173
6. Check your brief in the "✨ New UI" tab

### Throughout the Day:
- The assistant monitors your work automatically
- Check "Current Focus" to see what it thinks you're doing
- "Action Center" shows immediate suggestions
- "Blockers" detects if you're stuck

### Evening:
- View "Insights Panel" to see productivity patterns
- Mark items as done in "Smart Brief"
- Tomorrow morning: fresh brief with new suggestions

---

## 🌟 Key Features to Try

### 1. Get Stuck Detection
Work on a bug for 30+ minutes → Assistant detects and offers help

### 2. Context Recovery
Leave for a meeting → Come back → "Continue where you left off"

### 3. Pattern Insights
Do repetitive tasks → Assistant suggests automation

### 4. Wellness Checks
Code for 2+ hours → Gentle break reminder

### 5. Morning Briefs
Every morning at 8am → Personalized daily plan

---

## 📊 Monitoring Data Quality

Visit: http://localhost:3001/api/context/health

**Green indicators:** Working well
**Yellow indicators:** Working but limited data
**Red indicators:** Not working / needs attention

Common fixes:
- "WPE not available" → Enable screen recording
- "No summaries" → Use computer for 30+ minutes
- "No activities" → Pieces OS just started, wait a bit

---

## 🛠️ Development Commands

### Backend:
```bash
cd server
npm start          # Start server
npm run dev        # Start with nodemon (auto-restart)
```

### Frontend:
```bash
cd client
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

### Test Everything:
```bash
cd server
node scripts/quick-test.js        # Quick check
node scripts/diagnose-pieces-api.js  # Full diagnostic
```

---

## 🐛 Still Having Issues?

Check these files:
- `server/logs/` - Server error logs
- Browser console - Frontend errors
- `TEST_RESULTS.md` - Latest test results

Or run the diagnostic:
```bash
cd server
node scripts/diagnose-pieces-api.js
```

---

## ✅ Success Checklist

- [ ] MongoDB running
- [ ] Pieces OS running
- [ ] Backend server started (port 3001)
- [ ] Frontend started (port 5173)
- [ ] Dashboard loads in browser
- [ ] Health endpoint returns data
- [ ] "✨ New UI" tab shows components
- [ ] Brief generation works

**All checked? You're ready to go! 🎉**

---

**Need more help?** Check:
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `FIXES_APPLIED.md` - What was fixed
- `USER_CENTERED_DESIGN.md` - Design philosophy
