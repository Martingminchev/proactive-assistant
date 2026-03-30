# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Open Pieces OS (1 minute)
1. Open "Pieces for Developers" desktop application
2. Ensure it's running in background
3. **Important**: Pieces OS must be open for this to work

### Step 2: Start MongoDB (1 minute)
```bash
# Windows
mongod

# Mac/Linux
mongod
```

**Alternative**: Use MongoDB Atlas (cloud) and update `MONGODB_URI` in `server/.env`

### Step 3: Install Dependencies (2 minutes)
```bash
# Option A: Run setup script (Windows)
setup.bat

# Option B: Manual installation
cd server && npm install
cd ../client && npm install
```

### Step 4: Configure Environment (30 seconds)
Edit `server/.env`:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/proactive-assistant
NEWS_API_KEY=               # Optional: Get free key from newsapi.org
```

### Step 5: Start Backend (10 seconds)
```bash
cd server
npm start
```

Expected output:
```
========================================
🚀 Proactive AI Assistant Server
========================================
🌐 Server running on http://localhost:3001
📋 API Documentation: http://localhost:3001/api
💚 Health Check: http://localhost:3001/health
========================================
⏰ Scheduling Daily Brief Job for 8:00 AM...
✓ Daily Brief Job scheduled successfully
```

### Step 6: Start Frontend (10 seconds)
**Open new terminal window**, then:
```bash
cd client
npm run dev
```

Expected output:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Step 7: Open Dashboard (5 seconds)
Open browser: **http://localhost:5173**

You should see:
- ✅ Dashboard with stats bar
- ✅ "Generate Brief Now" button
- ✅ API status: "✓ Connected"
- ✅ Today's Brief / History tabs

---

## 🎯 Generate Your First Brief

1. Click **"🚀 Generate Brief Now"** button
2. Wait 20-45 seconds (loading spinner shows)
3. Brief appears with:
   - 💡 Code Improvements
   - 📰 News For You
   - 🚀 MVP Idea of the Day
4. Brief is saved to MongoDB automatically

---

## 📅 Scheduled Daily Briefs

The job runs automatically at **8:00 AM daily**.

**To test scheduled functionality:**
1. Change system time to 7:59 AM (temporary)
2. Watch server logs
3. Brief will generate at 8:00 AM automatically
4. Reset system time when done

---

## 🔧 Troubleshooting

### "✗ Disconnected" in API Status
**Problem**: Can't connect to Pieces OS

**Solution**:
1. Verify Pieces for Developers is open
2. Check Pieces OS is running on port 1000 (Windows/Mac) or 5323 (Linux)
3. Restart server: Ctrl+C, then `npm start`

### "MongoServerError: Authentication failed"
**Problem**: Can't connect to MongoDB

**Solution**:
1. Ensure MongoDB is running: `mongod`
2. Check `MONGODB_URI` in `server/.env`
3. Verify MongoDB is listening: Check terminal where `mongod` is running

### Port Already in Use
**Problem**: `EADDRINUSE: address already in use :::3001`

**Solution**:
```bash
# Find and kill process on port 3001
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3001 | xargs kill -9
```

### Brief Generation Never Completes
**Problem**: Button clicked but nothing happens

**Solution**:
1. Check server terminal for errors
2. Verify Pieces Copilot has a model selected (in Pieces desktop app settings)
3. Ensure you have some code/assets saved in Pieces
4. Try clicking button again after 30 seconds

---

## 📊 Verify It's Working

### Test API (curl or browser)
```bash
# Health check
http://localhost:3001/health

# Expected response:
{
  "status": "ok",
  "piecesConnected": true,
  "jobScheduled": "0 8 * * *",
  "jobRunning": false
}
```

### Check Database
```bash
# Connect to MongoDB
mongosh

# Use database
use proactive-assistant

# List briefs
db.briefs.find().pretty()

# You should see your generated briefs
```

### Check UI
1. Open http://localhost:5173
2. API status should show "✓ Connected"
3. Stats bar should show brief count
4. Click "Generate Brief Now"
5. Brief appears with all sections

---

## 🎓 Learn More

- **README.md**: Full project documentation
- **ARCHITECTURE.md**: Why we built it this way
- **TESTING.md**: Comprehensive testing guide
- **PROJECT_SUMMARY.md**: Complete project overview

---

## 🆘 Need Help?

**Common Issues**:
1. Pieces OS not connected → Open Pieces desktop app
2. MongoDB not connected → Run `mongod`
3. Port in use → Kill process on port 3001
4. Brief fails → Check server logs, ensure Pieces has content

**Get More Help**:
- Check `TESTING.md` for detailed troubleshooting
- Review server terminal logs
- Check browser console (F12) for errors

---

## ✅ Success Checklist

- [ ] Pieces OS is running
- [ ] MongoDB is running
- [ ] Server started on port 3001
- [ ] Client started on port 5173
- [ ] Dashboard loads in browser
- [ ] API status shows "Connected"
- [ ] First brief generated successfully
- [ ] Brief displays with all sections
- [ ] History tab shows past briefs
- [ ] Responsive design works on mobile

**All checked? You're ready to go! 🚀**

---

**Generated**: January 27, 2026  
**Version**: 1.0.0
