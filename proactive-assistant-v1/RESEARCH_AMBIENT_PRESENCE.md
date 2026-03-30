# Ambient Presence: AI Assistant UX Research

## Overview

Creating the feeling that an AI assistant is actively watching and ready to help—WITHOUT being annoying or cluttered.

**Core Challenge:** How do we signal "I'm here" in a way that feels helpful, not demanding?

---

## 1. Core Philosophy: Calm Technology Principles

### The Golden Rule
> "The most profound technologies are those that disappear." — Mark Weiser, Xerox PARC

Calm technology **informs without demanding focus**. It operates in the periphery of attention and only moves to the center when truly necessary.

### 8 Principles of Calm Technology (Amber Case)

1. **Require the smallest amount of attention**
2. **Inform and create calm** - Let users know something is happening without causing anxiety
3. **Make use of the periphery** - Glanceable, ambient awareness
4. **Amplify the best of technology and the best of humanity**
5. **Communicate, don't speak** - Use lights, tones, haptics over voice when possible
6. **Work even when it fails** - Graceful degradation
7. **The right amount of technology is the minimum needed**
8. **Respect social norms** - Context-aware delivery

### Attention Hierarchy (Resource Competition Framework)

| Level | Type | Examples |
|-------|------|----------|
| **Primary** | Visual, direct | Active task, typing, reading |
| **Secondary** | Distant, auditory, vibration | Rearview mirrors, soft tones |
| **Tertiary** | Peripheral, ambient | Status lights, background motion |

**Rule:** The more frequent the alert, the calmer it should be.

---

## 2. System Tray / Menu Bar Presence

### Key Insight
The menu bar/system tray is the PERFECT place for ambient AI presence because:
- Always visible but never demanding
- Users glance at it subconsciously
- No screen real estate wasted
- Native OS feel

### Patterns from Successful Apps

#### Raycast (Mac)
- **Trigger:** `Cmd + Space` (global hotkey)
- **Pattern:** Modal command palette that appears instantly
- **Key Features:**
  - "Palettes in palettes" - nested command structure
  - AI commands as first-class citizens
  - Extensions integrate seamlessly
  - No persistent UI - appears when needed, disappears when done

#### Bartender (Mac)
- **Pattern:** Collapsible menu bar icons
- **Insight:** Users want control over what's visible
- **Takeaway:** Allow users to choose AI visibility level

#### RescueTime
- **Pattern:** Passive activity tracking with periodic reports
- **Presence:** Small icon that changes color based on productivity
- **Key:** Shows data without interrupting

#### OnlySwitch (Mac)
- **Pattern:** All-in-one menu bar toggles
- **Visual:** Clean, native-looking icons
- **Behavior:** Click to expand, click elsewhere to dismiss

### Implementation Pattern (Electron/Tauri)

```javascript
// System tray with context menu
const { Tray, Menu } = require('electron');

let tray = new Tray('icon-template.png');

const contextMenu = Menu.buildFromTemplate([
  { label: 'AI Status: Watching', enabled: false },
  { type: 'separator' },
  { label: 'Quick Action...', accelerator: 'Cmd+Shift+A' },
  { label: 'View Insights', click: () => openDashboard() },
  { type: 'separator' },
  { label: 'Snooze for 1 hour', click: () => snooze(60) },
  { label: 'Settings...', click: () => openSettings() },
  { type: 'separator' },
  { label: 'Quit', role: 'quit' }
]);

tray.setContextMenu(contextMenu);
tray.setToolTip('AI Assistant - Ready to help');

// Dynamic icon updates based on state
tray.setImage(getIconForState('idle')); // idle, watching, thinking, suggestion
```

### Windows System Tray Pattern

```javascript
// Windows notification area
const { Tray, nativeImage } = require('electron');

// Template icon for dark/light mode auto-switching
const icon = nativeImage.createFromPath('icon.ico');
icon.setTemplateImage(true);

tray = new Tray(icon);
tray.setTitle('AI'); // Text next to icon (optional)
```

---

## 3. Visual Status Indicators

### The Psychology of Color

| Color | Meaning | Use Case | Psychology |
|-------|---------|----------|------------|
| **Green** | Active, ready, healthy | AI is watching, all good | Calm, reassuring |
| **Blue** | Processing, thinking | AI is analyzing | Trust, intelligence |
| **Amber/Orange** | Attention needed | Suggestion available | Warm, non-urgent |
| **Purple** | Creative/AI mode | AI-generated content | Innovation, magic |
| **Red** | Error, blocked | Something went wrong | Alert (use sparingly) |
| **Gray** | Inactive, snoozed | AI paused | Neutral, resting |

### Animation Principles

#### The "Breathing" Pattern
Most effective for "I'm here" indicators:

```css
/* Subtle ambient pulse - doesn't demand attention */
@keyframes ambient-pulse {
  0%, 100% { 
    opacity: 0.6; 
    transform: scale(1);
  }
  50% { 
    opacity: 1; 
    transform: scale(1.05);
  }
}

.ai-indicator {
  animation: ambient-pulse 3s ease-in-out infinite;
}
```

#### State-Based Animations

| State | Animation | Duration | Intensity |
|-------|-----------|----------|-----------|
| **Idle** | Slow pulse | 3-4s | 0.6-1.0 opacity |
| **Watching** | Gentle glow | 2-3s | subtle |
| **Thinking** | Quick pulse | 1s | higher |
| **Suggestion Ready** | Soft bounce | 0.5s | noticeable |
| **Alert** | Steady pulse | 0.5s | strong |

### CSS Implementation: Pulsing Status Dot

```css
/* Complete status indicator system */
:root {
  --status-size: 8px;
  --status-green: #10B981;
  --status-blue: #3B82F6;
  --status-amber: #F59E0B;
  --status-purple: #8B5CF6;
  --status-red: #EF4444;
  --status-gray: #6B7280;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: var(--status-size);
  height: var(--status-size);
  border-radius: 50%;
  position: relative;
}

/* Pulsing ring effect */
.status-dot::before,
.status-dot::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  background: inherit;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: status-pulse 2s infinite ease-out;
  opacity: 0.4;
}

.status-dot::after {
  animation-delay: 1s;
}

@keyframes status-pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.5;
  }
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
  }
}

/* State colors */
.status-idle { background-color: var(--status-green); }
.status-watching { background-color: var(--status-blue); }
.status-suggestion { background-color: var(--status-amber); }
.status-ai { background-color: var(--status-purple); }
.status-error { background-color: var(--status-red); }
.status-snoozed { background-color: var(--status-gray); }
```

### SVG Icon Animation (Menu Bar)

```svg
<!-- Animated AI icon for menu bar -->
<svg width="16" height="16" viewBox="0 0 16 16">
  <!-- Static outer ring -->
  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  
  <!-- Animated inner dot -->
  <circle cx="8" cy="8" r="2" fill="currentColor">
    <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite"/>
    <animate attributeName="r" values="2;2.5;2" dur="3s" repeatCount="indefinite"/>
  </circle>
  
  <!-- Thinking arcs (shown when processing) -->
  <path d="M 8 2 A 6 6 0 0 1 14 8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0">
    <animate attributeName="opacity" values="0;1;0" dur="1s" repeatCount="indefinite"/>
    <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="2s" repeatCount="indefinite"/>
  </path>
</svg>
```

---

## 4. Notification Patterns

### The Notification Hierarchy

| Priority | Trigger | Behavior | Channel |
|----------|---------|----------|---------|
| **1 - Critical** | Errors, security | Immediate, persistent | Sound + Visual + System notification |
| **2 - Important** | User-requested reminder | Timely, non-persistent | Visual + Brief sound |
| **3 - Helpful** | Suggestion available | Deferred, glanceable | Visual indicator only |
| **4 - Background** | Status updates | Silent | Tray icon change only |

### Native OS Notification Best Practices

#### Windows Action Center
```javascript
const { Notification } = require('electron');

const notification = new Notification({
  title: 'AI Suggestion',
  body: 'I noticed you\'re working on a database query. Want to see an optimized version?',
  icon: 'ai-icon.png',
  timeoutType: 'default', // or 'never' for persistent
  actions: [
    { text: 'Show me' },
    { text: 'Not now' }
  ]
});

notification.show();
```

#### macOS Notification Center
```javascript
const { Notification } = require('electron');

// macOS-specific rich notifications
const notification = new Notification({
  title: 'Proactive Assistant',
  subtitle: 'Suggestion Available',
  body: 'I can help automate this task',
  sound: 'subtle.caf', // Custom subtle sound
  hasReply: true, // Allow inline reply
  replyPlaceholder: 'Ask me anything...'
});
```

### Timing Best Practices

**The 30-Minute Rule:**
- Never show more than 1 proactive notification per 30 minutes
- Group multiple suggestions into a single digest
- Respect "Focus Mode" / DnD status

**Context-Aware Delivery:**
```javascript
// Check if user is available
function shouldNotify() {
  const isFocusMode = checkFocusMode();
  const isInMeeting = checkCalendar();
  const lastNotification = getLastNotificationTime();
  const minutesSinceLast = (Date.now() - lastNotification) / 60000;
  
  return !isFocusMode && 
         !isInMeeting && 
         minutesSinceLast > 30;
}
```

### Rich Notifications with Actions

```javascript
// Proactive suggestion notification
const suggestionNotification = new Notification({
  title: '🤖 Quick Help',
  body: 'I noticed you\'ve been switching between VS Code and documentation. Want me to summarize the API?',
  actions: [
    { type: 'button', text: '✨ Summarize' },
    { type: 'button', text: '📝 Save for later' },
    { type: 'button', text: '✕ Dismiss' }
  ],
  silent: true // No sound for proactive suggestions
});

suggestionNotification.on('action', (event, index) => {
  switch(index) {
    case 0: showSummary(); break;
    case 1: addToQueue(); break;
    case 2: markDismissed(); break;
  }
});
```

---

## 5. Floating UI / HUD Patterns

### VS Code Copilot Model

**Ghost Text Pattern:**
- Appears inline, dimmed
- Non-blocking - user can keep typing
- Accept with `Tab` (natural continuation)
- Dismiss by continuing to type

```typescript
// Pseudo-code for ghost text overlay
interface GhostTextSuggestion {
  text: string;
  confidence: number;
  position: CursorPosition;
}

function showGhostText(suggestion: GhostTextSuggestion) {
  // Render dimmed text after cursor
  // User can:
  // - Press Tab to accept
  // - Press Esc to dismiss  
  // - Keep typing to ignore
  renderOverlay({
    text: suggestion.text,
    opacity: 0.5,
    style: 'italic',
    position: 'inline'
  });
}
```

### Grammarly Model

**Contextual Underlines:**
- Color-coded by severity (red=error, blue=suggestion, purple=style)
- Hover to see details
- Click to expand options
- Never blocks typing

```css
/* Ambient suggestion underline */
.ai-suggestion {
  border-bottom: 2px wavy var(--suggestion-color);
  cursor: pointer;
  transition: background 0.2s;
}

.ai-suggestion:hover {
  background: rgba(var(--suggestion-color-rgb), 0.1);
}
```

### Raycast/Alfred Model

**Command Palette Pattern:**
- Global hotkey to invoke
- Blurs background (focus mode)
- Type to filter
- Keyboard-first navigation

```typescript
// Command palette component structure
<CommandPalette>
  <SearchInput 
    placeholder="What can I help you with?"
    onChange={filterResults}
  />
  <ResultsList>
    {results.map(result => (
      <ResultItem 
        icon={result.icon}
        title={result.title}
        subtitle={result.description}
        shortcut={result.keybinding}
        onSelect={result.action}
      />
    ))}
  </ResultsList>
  <FooterHints>
    <Hint key="↵" action="Select" />
    <Hint key="⌘+↵" action="Open in new window" />
    <Hint key="esc" action="Close" />
  </FooterHints>
</CommandPalette>
```

### Linear's Command Palette

**Key Features:**
- `Cmd + K` to open
- Recent commands at top
- AI suggestions marked with sparkle icon
- Breadcrumb navigation for nested commands

---

## 6. Sound & Haptic Feedback

### Audio Design Principles

**Windows 11 Sound Philosophy:**
> "The new sounds have a much rounder wavelength, making them softer so that they can still alert/notify you, but without being overwhelming."

| Event | Sound Type | Duration | Frequency |
|-------|------------|----------|-----------|
| **Startup** | Soft chime | 500ms | Low, welcoming |
| **Suggestion** | Gentle ding | 200ms | Mid, non-intrusive |
| **Success** | Positive chime | 300ms | Rising pitch |
| **Error** | Subtle thud | 250ms | Lower pitch |
| **Alert** | Attention tone | 400ms | Pulsing |

### Sound Implementation (Web Audio API)

```javascript
// Calm notification sound
class AmbientSounds {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  playSuggestion() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Soft, rounded tone
    oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
    
    // Gentle envelope
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }
}
```

### Haptic Patterns (Mobile/Desktop with gamepad)

| Pattern | Meaning | Duration |
|---------|---------|----------|
| **Short tap** | Acknowledgment | 10ms |
| **Double tap** | Suggestion ready | 10ms, 100ms pause, 10ms |
| **Gentle rise** | Processing complete | 50ms ramp up |
| **Heartbeat** | Urgent attention | Rhythmic 200ms pulses |

---

## 7. Micro-Interactions

### Smart Transitions

```css
/* Smooth state transitions */
.ai-orb {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

/* Idle state */
.ai-orb[data-state="idle"] {
  transform: scale(1);
  opacity: 0.8;
}

/* Processing - gentle rotation */
.ai-orb[data-state="thinking"] {
  animation: think-rotate 2s linear infinite;
}

@keyframes think-rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Suggestion available - inviting bounce */
.ai-orb[data-state="suggestion"] {
  animation: suggest-bounce 1s ease-in-out infinite;
}

@keyframes suggest-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Hover interaction */
.ai-orb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.4);
  cursor: pointer;
}
```

### Intelligence Indicators

```css
/* "Thinking" dots */
.thinking-dots {
  display: flex;
  gap: 4px;
}

.thinking-dots span {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: thinking-dot 1.4s ease-in-out infinite both;
}

.thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
.thinking-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes thinking-dot {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
```

---

## 8. Examples: Presence Done Right

### 🌟 VS Code Copilot

**What they do right:**
- ✅ Ghost text is genuinely non-blocking
- ✅ Accept suggestion with Tab (natural flow)
- ✅ Partial acceptance (Ctrl+Right for word-by-word)
- ✅ Status bar icon shows when Copilot is processing
- ✅ Can snooze suggestions when needed
- ✅ Next Edit Suggestions (NES) use gutter arrows - peripheral awareness

**Key Insight:** The AI waits in the periphery and only suggests when it has high confidence.

---

### 🌟 Raycast

**What they do right:**
- ✅ No persistent UI - appears on demand
- ✅ AI features feel native to the interface
- ✅ Command palette pattern is familiar
- ✅ Extensions add AI capabilities without clutter
- ✅ "Quick AI" for instant answers

**Key Insight:** The AI is a first-class citizen in a launcher interface users already know.

---

### 🌟 Grammarly

**What they do right:**
- ✅ Underlines are glanceable
- ✅ Color coding is intuitive (red=error, blue=suggestion)
- ✅ Hover for details (progressive disclosure)
- ✅ Never blocks typing
- ✅ Weekly writing reports (digests over real-time)

**Key Insight:** Micro-feedback in context beats modal interruptions.

---

### 🌟 macOS Menu Bar Icons

**What they do right:**
- ✅ Template icons adapt to dark/light mode
- ✅ Subtle status changes (color, badge)
- ✅ Click to expand, click away to dismiss
- ✅ Tooltips on hover
- ✅ Native feel

---

### 🌟 Things 3 Quick Entry

**What they do right:**
- ✅ Global hotkey from anywhere
- ✅ Appears over current app (non-disruptive)
- ✅ Captures thought, gets out of the way
- ✅ No notification noise

**Key Insight:** Be available instantly, then disappear completely.

---

## 9. Implementation Recommendations

### The "Ambient AI" Component Stack

```typescript
// Core ambient presence system
interface AmbientPresence {
  // Visual layer
  trayIcon: TrayIconManager;
  statusIndicator: StatusIndicator;
  
  // Notification layer  
  notifier: ContextualNotifier;
  
  // Interaction layer
  commandPalette: CommandPalette;
  floatingUI: FloatingUIManager;
  
  // Intelligence layer
  contextWatcher: ContextWatcher;
  suggestionEngine: SuggestionEngine;
}

// State machine for AI presence
enum PresenceState {
  IDLE = 'idle',           // Watching, minimal indicator
  OBSERVING = 'observing', // Active monitoring
  THINKING = 'thinking',   // Processing
  SUGGESTION = 'suggestion', // Has something to offer
  SNooZED = 'snoozed'      // User requested quiet
}
```

### Recommended UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AMBIENT STATE                                            │
│    ┌─────┐                                                  │
│    │ ●   │ ← Menu bar icon, slow pulse (3s)                │
│    └─────┘                                                  │
│    "I'm here, watching quietly"                              │
├─────────────────────────────────────────────────────────────┤
│ 2. SUGGESTION READY                                         │
│    ┌─────┐                                                  │
│    │ ✨  │ ← Gentle bounce, amber color                     │
│    └─────┘                                                  │
│    Click to open command palette with suggestion            │
├─────────────────────────────────────────────────────────────┤
│ 3. ACTIVE HELP                                              │
│    ┌──────────────────────────────┐                        │
│    │ 🤖 How can I help?           │                        │
│    │ > _                          │                        │
│    │ • Suggest code completion    │                        │
│    │ • Summarize this page        │                        │
│    │ • Remind me later...         │                        │
│    └──────────────────────────────┘                        │
│    Command palette opens with contextual options            │
└─────────────────────────────────────────────────────────────┘
```

### Snooze/DnD Pattern

```typescript
// Respect user's focus time
interface QuietModeConfig {
  // User-defined quiet hours
  quietHours: { start: Time; end: Time };
  
  // Calendar integration
  respectCalendar: boolean;
  
  // Manual snooze
  snoozeUntil: Timestamp | null;
  
  // Context detection
  detectScreenshare: boolean;
  detectGaming: boolean;
  detectVideoCall: boolean;
}

// During quiet mode, only show:
// - Tray icon (gray, no animation)
// - Critical alerts (errors, security)
// - No proactive suggestions
```

---

## 10. Anti-Patterns to Avoid

| ❌ Bad Pattern | ✅ Better Alternative |
|---------------|----------------------|
| Blinking alerts | Gentle color transitions |
| "Hey!" notifications | Contextual tray icon changes |
| Full-screen modals | Inline suggestions or command palette |
| Sound on every action | Silent by default, sound for important only |
| Persistent floating button | Menu bar presence + hotkey |
| "Did you mean..." popups | Ghost text or underlines |
| Multiple notifications | Digests grouped by time |
| Auto-executing actions | Preview + confirm pattern |

---

## 11. Quick Implementation Checklist

### Phase 1: Basic Presence
- [ ] Menu bar/system tray icon
- [ ] Template icons for dark/light mode
- [ ] Basic context menu
- [ ] Tooltips

### Phase 2: Status Communication
- [ ] Color-coded states (green/blue/amber/purple/gray)
- [ ] Pulsing animations (different speeds per state)
- [ ] Click to expand/collapse

### Phase 3: Smart Notifications
- [ ] Context-aware timing
- [ ] Snooze functionality
- [ ] Rich notifications with actions
- [ ] Notification history/digest

### Phase 4: Deep Integration
- [ ] Global hotkey for command palette
- [ ] Contextual suggestions
- [ ] Inline ghost text (if applicable)
- [ ] Calendar/focus mode integration

---

## Key Takeaways

1. **The best AI presence is the one users forget is there until they need it**

2. **Use the periphery**: Tray icons, subtle animations, and status lights communicate state without demanding attention

3. **Respect the 30-minute rule**: Proactive suggestions should be rare and valuable

4. **Ghost text > popups**: Inline, non-blocking suggestions feel magical

5. **Let users control the volume**: Snooze, quiet hours, and visibility settings are essential

6. **Match urgency to intensity**: Critical alerts can demand attention; suggestions should wait patiently

7. **Be predictable**: Consistent patterns build trust and habit

---

## Resources

- **Calm Technology** by Amber Case
- **Command Palette Interfaces** - Philip Davis
- **VS Code Copilot Documentation**
- **Raycast Developer Docs**
- **Human Interface Guidelines** (Apple)
- **Fluent Design System** (Microsoft)

---

*Research compiled for proactive AI assistant UX design.*
