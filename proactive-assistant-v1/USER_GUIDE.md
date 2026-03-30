# Proactive AI Assistant - User Guide

A step-by-step guide to using all the features.

---

## 🚀 Getting Started

### 1. Start the Application

```bash
# Terminal 1 - Start MongoDB
mongod

# Terminal 2 - Start Server
cd server
npm start

# Terminal 3 - Start Client
cd client
npm run dev
```

### 2. Open in Browser
Go to: `http://localhost:5173`

---

## 📋 Main Features

### Generate Your First Brief

1. Click the big **"Generate Today's Brief"** button
2. Wait 30-60 seconds while the AI analyzes your activity
3. Your personalized brief appears with:
   - A personalized greeting
   - Activity summary
   - Recommended items (tips, articles, tools, etc.)
   - Daily challenge
   - Reflection question

---

## ⌨️ Keyboard Shortcuts (Power User Mode!)

Press these keys anytime (except when typing in a text field):

| Shortcut | What It Does |
|----------|--------------|
| `Cmd + G` (Mac) / `Ctrl + G` (Windows) | Generate a new brief |
| `Cmd + H` / `Ctrl + H` | Go to History page |
| `Cmd + F` / `Ctrl + F` | Open/Close Goals panel |
| `Cmd + ,` / `Ctrl + ,` | Open Settings |
| `Shift + ?` | Show keyboard shortcuts help |
| `Escape` | Close panels, go back |

**Try it now:** Press `Shift + ?` to see the shortcuts help popup!

---

## 🎨 Using Themes (Dark/Light Mode)

1. Look for the ☀️ or 🌙 button in the top-right corner of the header
2. Click it to toggle between dark and light mode
3. Your preference is saved automatically

**Tip:** The app respects your system preference by default.

---

## 📊 The Feed (Today's Brief)

### Reading Items

Each card in your feed contains:
- **Category badge** (e.g., "⚡ Productivity", "🔧 Tools")
- **Title** - What this item is about
- **Description** - Details and explanation
- **Time estimate** (if available) - How long it takes

### Using Item Actions

Hover over any card to see action buttons:

| Button | What It Does |
|--------|--------------|
| 📋 **Copy** | Copies the item text to your clipboard |
| ↗️ **Share** | Opens native share dialog (mobile) or copies link |
| 🔖 **Save** | Marks item as saved for later |
| ☑️ **Do it** | Marks item as completed |
| 💬 **Chat** | Opens chat to ask about this item |

**Try it:** Hover over any card in your feed and click "Copy" - you can paste it anywhere!

---

## 📚 History & Search

### Viewing Past Briefs

1. Click **"📚 History"** in the header (or press `Cmd+H`)
2. You'll see all your previous briefs

### Searching Briefs

1. In the History page, you'll see a search box at the top
2. Type keywords to search:
   - Words from the greeting
   - Item titles
   - Item descriptions
3. Results update instantly as you type

### Filtering by Provider

1. Next to the search box is a dropdown
2. Select a provider (e.g., "pieces", "gemini") to filter
3. Select "All Providers" to see everything

### Viewing Brief Details

1. Click any brief in the history list
2. You'll see the full brief with:
   - Complete date (weekday, month, day, year)
   - Full greeting
   - All items with descriptions
   - Generation stats (time, files analyzed)
3. Click "← Back to History" to return

---

## 🎯 Goals Panel

### Opening Goals

- Click **"🎯 Goals"** in the header
- Or press `Cmd+F`

### Adding a Goal

1. Click the **"Add Goal"** button in the panel
2. Type your goal (e.g., "Learn React", "Finish Project X")
3. Press Enter or click Add

### Seeing Goals in Feed

Active goals appear as chips at the top of your feed:
```
Active Goals: Learn React Finish Project X +2
```

### Closing the Panel

- Click the X button
- Press `Escape`
- Click outside the panel

---

## 💬 Chatting About Items

### Starting a Chat

1. Hover over any feed item
2. Click the **💬 Chat** button
3. A chat panel slides in from the right

### Asking Questions

Type questions like:
- "Tell me more about this"
- "How do I get started?"
- "Can you give me an example?"

### Closing Chat

- Click the X button
- Press `Escape`

---

## ⚙️ Settings

### Opening Settings

- Click **"⚙️ Settings"** in the header
- Or press `Cmd + ,`

### What You Can Configure

- **AI Provider**: Choose between Pieces, Gemini, or z.ai
- **API Keys**: Add your own API keys
- **Schedule**: Change when daily briefs generate

---

## 🔄 Regenerating a Brief

Don't like today's brief? Generate a new one:

1. Scroll to the bottom of the feed
2. Click **"🔄 Regenerate Brief"**
3. Wait for the new brief to generate

**Note:** The old brief is still saved in your history.

---

## 📱 Tips & Tricks

### Quick Actions

- **Double-tap `Cmd+G`** to quickly generate a new brief
- **Press `Escape`** repeatedly to close everything and go back to feed
- **Use `Shift+?`** whenever you forget the shortcuts

### Copy & Paste

The **Copy** button on items is great for:
- Saving tips to your notes app
- Sharing recommendations with teammates
- Keeping a personal knowledge base

### Mobile Usage

On mobile devices:
- Swipe gestures work for navigation
- The Share button uses native sharing
- Theme toggle is always accessible

---

## 🐛 Troubleshooting

### "Unable to Connect" Error

1. Make sure MongoDB is running: `mongod`
2. Make sure server is running: `npm start` in server folder
3. Click "Retry Connection" button

### Brief Generation Stuck

1. Check that Pieces OS is running
2. Look for error messages in the console
3. Try refreshing the page and generating again

### Keyboard Shortcuts Not Working

- Make sure you're not typing in a text field
- Try clicking on the background first
- Press `Escape` to reset focus

---

## 🎓 Keyboard Shortcut Cheat Sheet

Print this out:

```
┌─────────────────────────────────────┐
│      KEYBOARD SHORTCUTS             │
├─────────────────────────────────────┤
│ Cmd+G  │ Generate new brief         │
│ Cmd+H  │ View history               │
│ Cmd+F  │ Toggle goals panel         │
│ Cmd+,  │ Open settings              │
│ ESC    │ Close / Go back            │
│ Shift+?│ Show this help             │
└─────────────────────────────────────┘
```

---

## 🎉 Enjoy Your AI Assistant!

The more you use it, the better it gets at understanding your work patterns and providing relevant recommendations.

**Questions?** Check the IMPROVEMENTS_V2.md for technical details.
