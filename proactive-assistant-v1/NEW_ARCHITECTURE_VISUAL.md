# 🎨 New Architecture: From Dashboard to Companion

## Before vs After

```
┌─────────────────────────────────────────────────────────────────┐
│                        BEFORE                                   │
│                    (Web Dashboard)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐                                                    │
│  │ Browser │──▶ localhost:5173                                  │
│  └────┬────┘                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Proactive AI Assistant              [Feed][History]│       │
│  ├─────────────────────────────────────────────────────┤       │
│  │                                                     │       │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │       │
│  │  │   Card 1    │ │   Card 2    │ │   Card 3    │   │       │
│  │  │             │ │             │ │             │   │       │
│  │  │  💡 Tip     │ │  📰 News    │ │  🚀 Idea    │   │       │
│  │  │             │ │             │ │             │   │       │
│  │  │ "Consider  │ │ "New React  │ │ "Build a    │   │       │
│  │  │ learning    │ │ version     │ │ chat app"   │   │       │
│  │  │ TypeScript" │ │ released"   │ │             │   │       │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │       │
│  │                                                     │       │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │       │
│  │  │   Card 4    │ │   Card 5    │ │   Card 6    │   │       │
│  │  │   ...       │ │   ...       │ │   ...       │   │       │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │       │
│  │                                                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ❌ User must OPEN browser                                      │
│  ❌ Must NAVIGATE to dashboard                                  │
│  ❌ CLUTTERED with many cards                                   │
│  ❌ GENERIC suggestions                                         │
│  ❌ PASSIVE - waits for user                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        AFTER                                    │
│                    (Tray Companion)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Menu Bar / System Tray                                         │
│  ┌───┐                                                          │
│  │🤖│  ◀── Always visible, always watching                     │
│  └───┘     (Changes color based on state)                       │
│                                                                 │
│  Click icon ──▶ Quick Window opens:                            │
│                                                                 │
│  ┌─────────────────────────────┐                               │
│  │ 🤖 Companion           ✕    │                               │
│  ├─────────────────────────────┤                               │
│  │ 👁 Watching auth.ts          │                               │
│  │    12 minutes               │                               │
│  ├─────────────────────────────┤                               │
│  │ 📌 Stuck on useEffect?      │                               │
│  │    [Show Fix]  [Dismiss]    │                               │
│  ├─────────────────────────────┤                               │
│  │ 🔥 2hr streak! Take break?  │                               │
│  │    [5 Min Break] [Later]    │                               │
│  ├─────────────────────────────┤                               │
│  │ [Focus] [Brief] [⚙️]        │                               │
│  └─────────────────────────────┘                               │
│                                                                 │
│  Notification (proactive):                                      │
│  ┌─────────────────────────────┐                               │
│  │ 🤖 Companion                │                               │
│  ├─────────────────────────────┤                               │
│  │ Stuck on this error?        │                               │
│  │ [Show Fix] [I'm Fine]       │                               │
│  └─────────────────────────────┘                               │
│                                                                 │
│  ✅ Icon ALWAYS visible (in menu bar)                           │
│  ✅ Proactive NOTIFICATIONS come to YOU                         │
│  ✅ FOCUSED - max 3 suggestions                                 │
│  ✅ CONTEXTUAL - "Stuck on useEffect?"                          │
│  ✅ PROACTIVE - interrupts when helpful                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER                                     │
│                    (Working on code)                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Activity Signals
                           │ (typing, errors, idle, etc.)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              PIECES OS (Background)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   LTM-2.7    │  │     WPE      │  │   Copilot    │          │
│  │  Summaries   │  │ Vision/OCR   │  │    (AI)      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT SERVICES                             │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │           piecesCopilotService (FIXED)                    │ │
│  │  • Correctly extracts vision OCR                          │ │
│  │  • Correctly extracts summary content                     │ │
│  │  • Auto-discovers Pieces OS port                          │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         contextSummarizationService (NEW)                 │ │
│  │  • Filters noise from raw data                            │ │
│  │  • Prioritizes by relevance                               │ │
│  │  • Builds AI-optimized digest                             │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              INTERRUPTION MANAGER (NEW)                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Flow State Detection                                     │ │
│  │  • Deep Flow (typing 5+ min) ───────▶ DON'T INTERRUPT    │ │
│  │  • Working (normal) ────────────────▶ MAYBE INTERRUPT    │ │
│  │  • Idle (5+ min no activity) ───────▶ INTERRUPT          │ │
│  │  • Stuck (20+ min on error) ────────▶ INTERRUPT NOW      │ │
│  │  • Frustrated (high backspace) ─────▶ OFFER HELP         │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Smart Timing                                             │ │
│  │  • Wait for pause in typing                               │ │
│  │  • Check calendar (no meetings)                           │ │
│  │  • 30-min rule (max 1 per 30 min)                         │ │
│  │  • 3-strike rule (dismissed 3x = stop)                    │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              DECISION GATE                                      │
│                                                                 │
│   Should interrupt? ──YES──▶ Choose Level ──▶ Deliver          │
│        │                       │                                │
│        NO                      ├── Level 1: Whisper (icon pulse)│
│        │                       ├── Level 2: Nudge (notification)│
│        ▼                       ├── Level 3: Tap (quick window) │
│   Continue watching            └── Level 4: Emergency (alert)   │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              DELIVERY LAYER                                     │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐ │
│  │   TRAY APP          │  │   NOTIFICATIONS                  │ │
│  │   (Electron)        │  │                                  │ │
│  │                     │  │  ┌────────────────────────────┐  │ │
│  │  Tray Icon          │  │  │ Rich OS Notifications      │  │ │
│  │  • Pulsing states   │  │  │ • Stuck detection          │  │ │
│  │  • Color changes    │  │  │ • Context recovery         │  │ │
│  │  • Badge counts     │  │  │ • Wellness checks          │  │ │
│  │                     │  │  │ • Celebrations             │  │ │
│  │  Quick Window       │  │  └────────────────────────────┘  │ │
│  │  • Current focus    │  │                                  │ │
│  │  • Suggestions      │  │  WebSocket (real-time)           │ │
│  │  • Actions          │  │                                  │ │
│  │                     │  │  In-App Panel (if window open)   │ │
│  │  Right-Click Menu   │  │                                  │ │
│  │  • Focus Mode       │  └──────────────────────────────────┘ │
│  │  • Settings         │                                        │
│  │  • Quit             │                                        │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Machine: Tray Icon

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
         ┌─────────│   IDLE      │
         │         │  (gray)     │
         │         └──────┬──────┘
         │                │
         │                │ Server connects
         │                │
         │                ▼
         │         ┌─────────────┐
         │    ┌────│  WATCHING   │◀─────────────┐
         │    │    │ (blue pulse)│              │
         │    │    └──────┬──────┘              │
         │    │           │                     │
         │    │           │ No activity         │
         │    │           │ detected            │
         │    │           ▼                     │
         │    │    ┌─────────────┐              │
         │    │    │  SUGGESTION │              │
         │    └────│ (amber)     │              │
         │         └──────┬──────┘              │
         │                │                     │
         │                │ Stuck detected      │
         │                │ (20+ min error)     │
         │                ▼                     │
         │         ┌─────────────┐              │
         └────────▶│   URGENT    │──────────────┘
                   │ (red pulse) │  Dismissed/
                   └──────┬──────┘  resolved
                          │
                          │ User clicks
                          │
                          ▼
                   ┌─────────────┐
                   │ QUICK WINDOW│
                   │   OPEN      │
                   └──────┬──────┘
                          │
                          │ Click outside /
                          │ Press Esc
                          ▼
                   ┌─────────────┐
                   │   CLOSE     │
                   └─────────────┘

LEGEND:
┌─────────────┐
│ STATE_NAME  │
│ (color)     │
└─────────────┘
```

---

## Interruption Decision Tree

```
AI detects potential issue
        │
        ▼
┌─────────────────────┐
│ Calculate Flow State│
└──────────┬──────────┘
           │
           ├──▶ DEEP_FLOW (typing 5+ min steady)
           │    └──▶ DON'T INTERRUPT ❌
           │
           ├──▶ DEBUGGING (breakpoint active)
           │    └──▶ DON'T INTERRUPT ❌
           │
           ├──▶ FOCUS_MODE (user enabled)
           │    └──▶ DON'T INTERRUPT ❌
           │
           ├──▶ MEETING (calendar says busy)
           │    └──▶ DON'T INTERRUPT ❌
           │
           ├──▶ IDLE (5+ min no activity)
           │    └──▶ CAN INTERRUPT ✅
           │
           ├──▶ STUCK (20+ min on error)
           │    └──▶ SHOULD INTERRUPT ✅✅
           │
           └──▶ FRUSTRATED (high backspace rate)
                └──▶ SHOULD INTERRUPT ✅✅
           │
           ▼
┌─────────────────────┐
│ Check 30-Min Rule   │
│ (1 suggestion per   │
│ 30 min max)         │
└──────────┬──────────┘
           │
           ├──▶ Within 30 min of last
           │    └──▶ DON'T INTERRUPT ❌
           │
           └──▶ More than 30 min ago
                └──▶ CONTINUE ✅
           │
           ▼
┌─────────────────────┐
│ Check 3-Strike Rule │
│ (Dismissed 3x =     │
│ blacklisted)        │
└──────────┬──────────┘
           │
           ├──▶ 3+ dismissals today
           │    └──▶ DON'T INTERRUPT ❌
           │
           └──▶ Fewer than 3 dismissals
                └──▶ CONTINUE ✅
           │
           ▼
┌─────────────────────┐
│ Wait for Pause      │
│ (User stops typing) │
└──────────┬──────────┘
           │
           ├──▶ Still typing
           │    └──▶ WAIT ⏳
           │
           └──▶ Paused for 2+ sec
                └──▶ INTERRUPT NOW ✅
           │
           ▼
┌─────────────────────┐
│ Choose Level        │
└──────────┬──────────┘
           │
           ├──▶ Low confidence
           │    └──▶ LEVEL 1: WHISPER
           │         (icon pulse only)
           │
           ├──▶ Good suggestion
           │    └──▶ LEVEL 2: NUDGE
           │         (notification)
           │
           ├──▶ User stuck
           │    └──▶ LEVEL 3: TAP
           │         (quick window)
           │
           └──▶ Critical issue
                └──▶ LEVEL 4: EMERGENCY
                     (notification + sound)
```

---

## Notification Templates

### Stuck Detection
```
┌─────────────────────────────┐
│ 🤖 Companion          ✕     │
├─────────────────────────────┤
│ 🔴 Stuck on useEffect?      │
│                             │
│ You've been debugging for   │
│ 25 minutes.                 │
│                             │
│ I found the issue: missing  │
│ dependency array.           │
│                             │
│ [Show Fix] [Dismiss]        │
└─────────────────────────────┘
```

### Context Recovery
```
┌─────────────────────────────┐
│ 🤖 Companion          ✕     │
├─────────────────────────────┤
│ 🟡 Continue where you       │
│    left off?                │
│                             │
│ You were working on auth.ts │
│ before your meeting.        │
│                             │
│ 2 TODOs remaining:          │
│ • Add validation            │
│ • Write tests               │
│                             │
│ [Open File] [Later]         │
└─────────────────────────────┘
```

### Wellness Check
```
┌─────────────────────────────┐
│ 🤖 Companion          ✕     │
├─────────────────────────────┤
│ 🟣 Time for a break?        │
│                             │
│ You've been coding for      │
│ 2 hours straight.           │
│                             │
│ Your eyes and brain         │
│ need a rest.                │
│                             │
│ [5 Min Break] [Snooze 30]   │
└─────────────────────────────┘
```

### Celebration
```
┌─────────────────────────────┐
│ 🤖 Companion          ✕     │
├─────────────────────────────┤
│ 🟢 🔥 You're on fire!       │
│                             │
│ 3-day coding streak!        │
│                             │
│ Today you:                  │
│ • Shipped auth feature      │
│ • Fixed 5 bugs              │
│ • Wrote 200 lines           │
│                             │
│ [View Stats] [Dismiss]      │
└─────────────────────────────┘
```

---

## Data Flow

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  Pieces OS │────▶│  Context   │────▶│Interruption│────▶│Notification│
│  APIs      │     │ Summarizer │     │  Manager   │     │  Service   │
└────────────┘     └────────────┘     └────────────┘     └─────┬──────┘
     │                   │                   │                  │
     │                   │                   │                  │
     ▼                   ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         TRAY APP                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │Tray Icon │  │  Quick   │  │   OS     │  │  In-App  │            │
│  │  State   │  │  Window  │  │  Notif   │  │  Panel   │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                                 │
│  [Accept] [Dismiss] [Snooze] [Focus Mode] [Settings]                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Feedback Loop    │
                    │  (Learning)       │
                    └───────────────────┘
```

---

## Memory Usage

| Component | Memory |
|-----------|--------|
| Tray App (Electron) | ~80-120MB |
| Server (Node) | ~100-150MB |
| MongoDB | ~50-100MB |
| **Total** | **~230-370MB** |

Lightweight for a background assistant!

---

## Key Files Created

```
tray/
├── main.js                    # Electron entry
├── TrayManager.js             # Icon states
├── WindowManager.js           # Quick window
└── package.json               # Electron deps

server/services/
├── interruptionManager.js     # Smart interruption
├── notificationService.js     # Rich notifications
└── contextSummarizationService.js

server/models/
└── DismissedSuggestion.js     # Track dismissals

client/src/components/tray/
├── TrayIcon.jsx               # Animated icon
├── QuickWindow.jsx            # Main window
├── SuggestionCard.jsx         # Suggestion UI
├── CurrentStatus.jsx          # Status display
├── FocusToggle.jsx            # Focus mode
└── Celebration.jsx            # Achievements

docs/
├── DESIGN_SYNTHESIS.md        # Design philosophy
├── TRAY_APP_INTEGRATION.md    # Integration guide
├── QUICK_START_TRAY.md        # Quick start
└── NEW_ARCHITECTURE_VISUAL.md # This file!
```

---

**The new architecture transforms a passive dashboard into an active, intelligent companion that respects your flow while being there when you need it.**
