# 🎨 Design Synthesis: The New Proactive Assistant

## Research Findings Summary

### 1. Timing is Everything (CHI 2024 Research)
- **58% prefer AFTER suggestions** vs synchronous (33%)
- **4x more frequent suggestions = 50% less preference**
- Key insight: Wait for user to pause, don't interrupt flow

### 2. Clippy's Failure Lessons
- Misreading context + unwelcome interruptions = death
- Low value per interruption destroys trust
- Must learn from dismissals

### 3. Successful Patterns
- **Grammarly**: Ghost underlines, user controls expansion
- **VS Code Copilot**: Tab-to-accept, presence through utility
- **RescueTime**: Background tracking, digest at boundaries

### 4. Ambient Presence Principles
- Inform without demanding focus
- Use periphery (menu bar, subtle animations)
- Respect the **30-minute rule**: Max 1 proactive suggestion per 30 min
- Color psychology: Green (ready), Blue (thinking), Amber (suggestion)

### 5. Smart Interruption Tiers
| Level | Name | Use When | UI |
|-------|------|----------|-----|
| 1 | Whisper | Low confidence | Icon pulse |
| 2 | Nudge | Good suggestion | Notification banner |
| 3 | Tap | Urgent help needed | Modal |
| 4 | Emergency | Critical | System notif + sound |

---

## 🎯 The New Design: "Companion"

### Core Philosophy
**"A quiet companion that's there when you need it, invisible when you don't"**

### Key Changes from Old Design

| Old | New |
|-----|-----|
| Browser dashboard | System tray app |
| Cards and tabs | Notifications and quick window |
| Passive display | Proactive interruptions |
| Cluttered UI | Minimalist presence |
| Generic briefs | Contextual micro-help |

### The Experience

```
User working on code...
    ↓
AI detects stuck state (20min on same error)
    ↓
Tray icon pulses amber
    ↓
Notification appears: "Stuck on useEffect? Tap for help"
    ↓
User clicks → Quick window opens with solution
    ↓
One click to apply → Back to work
    ↓
Tray icon turns green → Shows "You're on fire!" streak
```

---

## 📱 Component Architecture

### 1. Tray Icon (Always Visible)
```
┌─────────┐
│  🤖     │  ← Main icon
│ ╭───╮  │
│ │ 5 │  │  ← Streak/suggestions count
│ ╰───╯  │
│ ●      │  ← Status dot (color indicates state)
└─────────┘
```

**States:**
- 🔵 Blue dot pulsing: Watching
- 🟡 Amber solid: Has suggestion
- 🔴 Red pulsing: Needs attention
- 🟢 Green: All good
- 🟣 Purple: Deep focus mode

### 2. Quick Window (On Click)
```
┌─────────────────────────────┐
│ 🤖 Companion     ─ □ ✕      │
├─────────────────────────────┤
│ Watching you work on        │
│ auth.ts for 12 minutes      │
├─────────────────────────────┤
│ 📌 Active Suggestions (2)   │
│ ┌─────────────────────────┐ │
│ │ useEffect dependency    │ │
│ │ issue? Tap for fix →    │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ You've been coding 2hrs │ │
│ │ Take a 5min break?      │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ [Focus Mode] [Brief] [⚙️]  │
└─────────────────────────────┘
```

### 3. Rich Notifications (Proactive)
```
┌─────────────────────────────┐
│ 🤖 Companion                │
├─────────────────────────────┤
│ Stuck on this error?        │
│                             │
│ Cannot read property 'map'  │
│ of undefined                │
│                             │
│ [Show Fix] [Dismiss] [Snooze│
└─────────────────────────────┘
```

### 4. Inline Suggestions (VS Code)
```typescript
// Ghost text style
useEffect(() => {
  fetchData();
}, [id]); // ← Grey ghost text: "Add 'id' to prevent stale closure"
```

---

## 🎨 Visual Design System

### Colors
```css
/* States */
--watching: #3B82F6;      /* Blue - pulsing */
--suggestion: #F59E0B;    /* Amber - solid */
--urgent: #EF4444;        /* Red - pulsing */
--good: #10B981;          /* Green - solid */
--focus: #8B5CF6;         /* Purple - solid */

/* Backgrounds */
--bg-dark: #0F172A;
--bg-card: #1E293B;
--bg-hover: #334155;
```

### Typography
```
Primary: Inter, system-ui
Size: 13px (readable at small sizes)
Weights: 400 (body), 500 (labels), 600 (actions)
```

### Animations
```css
/* Breathing pulse for watching state */
@keyframes breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}
/* Duration: 3s, infinite */

/* Streak celebration */
@keyframes streak {
  0% { transform: scale(0) rotate(0deg); }
  50% { transform: scale(1.2) rotate(180deg); }
  100% { transform: scale(1) rotate(360deg); }
}
```

---

## 🧠 Smart Interruption Logic

### Flow State Detection
```javascript
// Calculate interruption score (0-100)
// Higher = better time to interrupt

const score = (
  typingVelocityScore * 0.25 +
  idleTimeScore * 0.20 +
  errorRateScore * 0.20 +
  backspaceScore * 0.15 +
  tabSwitchScore * 0.10 +
  timeOnTaskScore * 0.10
);

// Thresholds
if (score < 30) return "DONT_INTERRUPT"; // Deep flow
if (score < 60) return "WAIT"; // Might be thinking
if (score < 80) return "NUDGE"; // Good time
return "TAP"; // Probably stuck
```

### Anti-Annoyance Rules
1. **30-Minute Rule**: Max 1 proactive notification per 30 minutes
2. **3-Strike Rule**: Dismissed 3 times → Don't suggest again today
3. **Focus Mode**: User can enable "Leave me alone" mode
4. **Meeting Aware**: Check calendar before interrupting
5. **Debug Mode**: Don't interrupt when breakpoints active

---

## 📦 Implementation Plan

### Phase 1: Core Presence (Week 1)
- System tray icon
- Basic status states
- Quick window shell

### Phase 2: Intelligence (Week 2)
- Flow state detection
- Interruption manager
- Basic suggestions

### Phase 3: Polish (Week 3)
- Rich notifications
- Micro-interactions
- Settings panel

### Phase 4: Integration (Week 4)
- VS Code inline suggestions
- Native OS notifications
- Sound/haptic feedback

---

## ✅ Success Metrics

- **>70%** suggestion acceptance rate
- **>60%** user preference for proactive mode
- **<1** "annoying" interruption per session
- **<3s** from click to action
- **<50MB** memory usage

---

## 🚀 Implementation Priority

1. **Tray Icon** - Must have, defines the experience
2. **Quick Window** - Core interaction surface
3. **Stuck Detection** - Highest value feature
4. **Notifications** - Proactive value delivery
5. **Inline Suggestions** - VS Code integration
6. **Celebrations** - Delight factor

---

**The Goal: An assistant that feels like a skilled pair programmer sitting next to you - helpful, unobtrusive, and always ready when you need them.**
