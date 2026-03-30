# Testing Guide

## Pre-requisites

Before testing, ensure the following are running:

1. **MongoDB**: Local instance or MongoDB Atlas connection string in `.env`
2. **Pieces OS**: Pieces for Developers desktop app must be running
3. **Node.js**: Version 18+ installed

## Quick Test

### 1. Install Dependencies

Run the setup script (Windows):
```bash
setup.bat
```

Or manually install:
```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Configure Environment

Edit `server/.env`:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/proactive-assistant
NEWS_API_KEY=your_newsapi_key_here
```

### 3. Start Server

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
```

### 4. Start Client (New Terminal)

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

### 5. Verify Pieces Connection

Check if Pieces OS is connected:
```bash
# In browser, open:
http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-27T...",
  "piecesConnected": true,
  "jobScheduled": "0 8 * * *",
  "jobRunning": false
}
```

## Manual Brief Generation

### Trigger First Brief

1. Open http://localhost:5173 in browser
2. Click "🚀 Generate Brief Now" button
3. Wait approximately 30-60 seconds for generation
4. Brief should appear on dashboard

Expected server logs:
```
========================================
🚀 Starting Daily Brief Generation
========================================
📅 Job started at: 2026-01-27T...
🔌 Connecting to Pieces OS...
✓ Connected to Pieces OS
📦 Fetching Pieces context...
✓ Retrieved X recent assets
✓ Retrieved Y code snippets
🔄 Fetching tech news...
✓ Fetched 10 tech news articles
🤖 Generating brief with Pieces Copilot...
✓ Found Z relevant context items
✓ Successfully parsed Pieces Copilot response
✓ Daily brief generated in 2345ms
💾 Saving brief to database...
========================================
✅ Daily Brief Generation Complete!
========================================
📊 Brief ID: 678a9...
📅 Date: 2026-01-27T...
💡 Improvements: 2
📰 News Articles: 3
🚀 MVP Ideas: 1
⏱ Total Time: 5678ms (5.68s)
```

## API Testing

### Test API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Get today's brief
curl http://localhost:3001/api/briefs/today

# Get brief history
curl http://localhost:3001/api/briefs/history?limit=7

# Get statistics
curl http://localhost:3001/api/briefs/stats

# Get assets
curl http://localhost:3001/api/assets?limit=10

# Search assets
curl http://localhost:3001/api/assets/search?q=react

# Trigger brief generation
curl -X POST http://localhost:3001/api/briefs/generate
```

## UI Testing Checklist

- [ ] Dashboard loads without errors
- [ ] API status shows "Connected"
- [ ] Stats bar displays correctly
- [ ] "Generate Brief Now" button is clickable
- [ ] Loading spinner appears during generation
- [ ] Brief displays with all sections
- [ ] Code improvements show correctly
- [ ] News articles show with working links
- [ ] MVP idea displays
- [ ] History tab shows past briefs
- [ ] Responsive design works on mobile

## Common Issues & Solutions

### Pieces OS Not Connected

**Problem**: Server shows `piecesConnected: false`

**Solution**:
1. Ensure Pieces for Developers desktop app is open
2. Check Pieces OS is running on correct port:
   - Windows/macOS: localhost:1000
   - Linux: localhost:5323
3. Restart the server

### MongoDB Connection Error

**Problem**: `MongoServerError: Authentication failed`

**Solution**:
1. Check MongoDB is running: `mongod`
2. Verify connection string in `.env`
3. If using MongoDB Atlas, whitelist your IP

### Brief Generation Fails

**Problem**: Generation starts but never completes

**Solution**:
1. Check server logs for errors
2. Verify Pieces Copilot is configured in Pieces desktop app
3. Check if an LLM model is selected in Pieces
4. Try manual trigger again after a few seconds

### News API Fails

**Problem**: NewsAPI returns errors

**Solution**:
1. Verify NEWS_API_KEY is correct in `.env`
2. If no key is available, the app uses fallback news (this is OK)

### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3001`

**Solution**:
1. Kill process on port 3001:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   
   # Mac/Linux
   lsof -ti:3001 | xargs kill -9
   ```
2. Change PORT in `.env`

## Scheduled Job Testing

The scheduled job runs automatically at 8:00 AM daily.

To test scheduled functionality:

1. Manually set system time to 7:59 AM (temporary)
2. Watch server logs at 8:00 AM
3. Verify brief generates automatically

**Note**: Reset system time after testing.

## Performance Monitoring

Check brief generation performance:

```bash
curl http://localhost:3001/api/briefs/stats
```

Look for:
- `avgGenerationTime`: Should be under 30 seconds
- `totalBriefs`: Increases each day
- `latestBriefDate`: Updates after each generation

## Database Verification

Check MongoDB directly:

```bash
# Connect to MongoDB
mongosh

# Switch to database
use proactive-assistant

# List all briefs
db.briefs.find().pretty()

# Count briefs
db.briefs.countDocuments()

# Get latest brief
db.briefs.findOne().sort({date: -1})
```

## Cleanup

To reset the application:

```bash
# Stop server (Ctrl+C)
# Stop client (Ctrl+C)

# Clear MongoDB data (if needed)
mongosh proactive-assistant --eval "db.briefs.deleteMany({})"
```

## Success Criteria

✅ Server starts without errors  
✅ Pieces OS connection successful  
✅ MongoDB connection successful  
✅ API health check passes  
✅ Client loads in browser  
✅ Brief generation completes  
✅ Brief displays in UI  
✅ History tab shows past briefs  
✅ Responsive design works  
✅ No console errors in browser
