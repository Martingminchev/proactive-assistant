# Proactive Assistant Ecosystem

**AI assistants that help before you ask.**

---

## What This Is

I was tired of AI assistants that only respond when you explicitly ask them something. You're stuck on a bug for 20 minutes, and the AI just sits there waiting. You forget about that meeting, that API change, that dependency update -- and the assistant says nothing because you never asked.

So I built a suite of proactive assistants. They watch context -- what window you're in, what file you're editing, what errors are piling up -- and surface help at the right moment. Not random interruptions. Intelligent ones, timed to natural pauses in your workflow, calibrated by flow state detection and interruption management.

This ecosystem is three projects, each tackling a different surface area:

| Project | Surface | Status |
|---------|---------|--------|
| **NEXUS** | Desktop companion (Electron) | ~90% complete |
| **Proactive Web System** | Browser-based daily briefs + chat | 100% complete |
| **VSCode Extension** | IDE-integrated suggestions | ~85% complete |

All three integrate with [Pieces OS](https://pieces.app/) for local, private AI processing -- your code context never leaves your machine unless you explicitly choose a cloud provider.

---

## NEXUS -- Desktop Companion

A system-tray Electron app that knows what you're doing across your entire desktop. It tracks your active window, monitors file changes in your projects, reads system resource state, and uses all of that as context for an AI conversation.

### How It Works

NEXUS runs a continuous context loop:

1. **Situation Aggregator** collects window changes, file events, clipboard state, CPU/memory/battery
2. **Error Detector** watches for error patterns in visible windows (via screen analysis with Tesseract.js OCR)
3. **Intent Engine** infers what you're trying to do from behavioral patterns
4. **Interruption Decision Engine** determines if now is the right time to surface a suggestion
5. **Proactive Agent** generates the actual help, grounded in your current context

The AI backend is Moonshot's Kimi K2.5, with Pieces OS providing local snippet retrieval and long-term memory via MCP.

### Features

- Active window tracking (knows you switched from VS Code to Stack Overflow)
- File change monitoring via chokidar (detects when you're rapidly editing/saving)
- System resource awareness (CPU, memory, battery)
- Screen content analysis via Tesseract.js OCR
- Tool system with file operations, browser tools, clipboard, dev tools
- "Soul Document" -- a persistent personality layer you can customize
- Pattern recognition and preference learning across sessions
- Context-aware conversation management with automatic summarization
- Glassmorphism UI with Framer Motion animations

### Tech Stack

Electron 28, React 18, TypeScript, Tailwind CSS, Zustand, Framer Motion, active-win, chokidar, tesseract.js, systeminformation, Pieces MCP SDK, Zod

### Running It

```bash
cd nexus-assistant
npm install
npm run dev          # Build + launch Electron
npm run dev:watch    # Watch mode with hot reload
```

Requires a Kimi API key from [platform.moonshot.cn](https://platform.moonshot.cn/). Configure in the Settings modal inside the app.

Optional: Install [Pieces OS](https://pieces.app/) for enhanced context from your saved snippets.

---

## Proactive Web System (v1)

A web-based assistant built around the idea of daily briefings. Every morning at 8am, it generates a personalized brief combining news from your configured topics, context from your Pieces OS snippets, and AI-synthesized insights. Throughout the day, it proactively monitors for relevant suggestions.

### How It Works

1. **Daily Brief Job** (node-cron, 8am) pulls from NewsAPI, Pieces OS context, and your preference history to generate a morning brief
2. **Proactive Assistant Job** runs periodically, checking for context changes that warrant a suggestion
3. **Intelligent Brief Service** ranks and personalizes content based on your interaction history
4. **Notification System** with WebSocket push for real-time alerts
5. **Multi-provider AI** -- switch between z.ai (GLM-4.7), Google Gemini, or Pieces Copilot

### Features

- Automated 8am daily briefs with news, insights, and action items
- Multi-AI provider support (z.ai, Gemini, Pieces Copilot)
- Real-time chat with context summarization
- Proactive suggestion feed with feedback loop
- User preference learning and context health monitoring
- Dashboard with focus tracking, goals, and action center
- Smart interruption management
- MongoDB persistence for briefs, suggestions, preferences, and settings

### Tech Stack

**Server:** Express, MongoDB/Mongoose, node-cron, Pieces OS Client SDK, OpenAI SDK (for z.ai), Google GenAI SDK, NewsAPI, WebSocket (ws)

**Client:** React 18, Vite, Axios, date-fns, react-markdown

### Running It

```bash
# Server
cd proactive-assistant-v1/server
cp .env.example .env     # Fill in your API keys
npm install
npm run dev

# Client (separate terminal)
cd proactive-assistant-v1/client
npm install
npm run dev
```

Requires MongoDB running locally. The server starts on port 3001, the client on port 5173.

---

## VSCode Extension

An IDE extension that monitors your coding activity and surfaces help when it detects you're stuck. It tracks typing velocity, backspace ratio, file switching patterns, and error diagnostics to determine your flow state -- then decides whether an interruption would help or hurt.

### How It Works

1. **Activity Monitor** tracks keystrokes, file switches, and error counts to compute flow state (idle / active / flow / deep-flow / stuck / frustrated)
2. **Suggestion Engine** generates context-aware suggestions based on current file, diagnostics, and Pieces OS snippets
3. **Interruption Manager** enforces rules: no interruptions during deep flow, quiet hours, 30-minute cooldowns, 3-strike blacklisting for dismissed suggestion types
4. **Suggestion Orchestrator** ties it all together -- when Activity Monitor signals "stuck", it asks Suggestion Engine for help, checks with Interruption Manager if now is appropriate, then surfaces the suggestion

### Features

- Flow state detection (idle, active, flow, deep-flow, stuck, frustrated)
- Typing velocity and frustration detection (high backspace ratio)
- Smart interruption timing with quiet hours and cooldowns
- Pieces OS integration for local AI-powered suggestions
- Focus mode toggle
- Status bar with real-time flow state indicator
- Webview panel with stats, settings, and suggestion cards
- Full test suite (Mocha)

### Tech Stack

TypeScript, VS Code Extension API, Pieces OS Client SDK, Mocha, NYC (coverage)

### Running It

```bash
cd vscode-proactive-assistant
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

To package as .vsix:
```bash
npm install -g @vscode/vsce
vsce package
```

---

## Common Thread: Pieces OS

All three projects integrate with [Pieces OS](https://pieces.app/), a local AI orchestration layer. This means:

- **Your code context stays on your machine** -- snippets, file contents, and conversation history are processed locally
- **Shared context across tools** -- a snippet you save in your browser extension is available to NEXUS, the web system, and the VSCode extension
- **Long-term memory** -- Pieces provides persistent context that survives across sessions

Pieces OS is optional for NEXUS and the web system (they fall back to cloud AI), but the VSCode extension relies on it for suggestion generation.

---

## Architecture

```
+------------------------------------------------------------------+
|                    PROACTIVE ASSISTANT ECOSYSTEM                  |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  |     NEXUS        |  |   Web System     |  |  VSCode Ext      | |
|  |   (Electron)     |  |  (Express+React) |  |  (TS Extension)  | |
|  |                  |  |                  |  |                  | |
|  | Context Monitor  |  | Daily Brief Job  |  | Activity Monitor | |
|  | Error Detector   |  | Proactive Job    |  | Suggestion Eng.  | |
|  | Intent Engine    |  | News Service     |  | Interruption Mgr | |
|  | Situation Aggr.  |  | AI Service       |  | Flow Detection   | |
|  | Proactive Agent  |  | Notification Svc |  | Pieces Client    | |
|  | Tool System      |  | Brief Service    |  |                  | |
|  +--------+---------+  +--------+---------+  +--------+---------+ |
|           |                      |                     |          |
|           v                      v                     v          |
|  +----------------------------------------------------------+    |
|  |                       Pieces OS (Local)                   |    |
|  |  Snippet storage | Context enrichment | LTM | MCP Server |    |
|  +----------------------------------------------------------+    |
|           |                      |                     |          |
|           v                      v                     v          |
|  +------------------+  +------------------+  +------------------+ |
|  |  Kimi K2.5 (API) |  | z.ai / Gemini   |  | Pieces Copilot   | |
|  |  (Moonshot)      |  | (cloud fallback)|  | (local)          | |
|  +------------------+  +------------------+  +------------------+ |
+------------------------------------------------------------------+
```

---

## Project Status

| Component | Completion | Notes |
|-----------|-----------|-------|
| NEXUS - Core UI | Done | Glassmorphism drawer, chat, settings |
| NEXUS - Context Loop | Done | Window tracking, file monitoring, error detection |
| NEXUS - Proactive Engine | Done | Intent engine, pattern recognition, smart triggers |
| NEXUS - Tool System | Done | File, browser, clipboard, system, dev tools |
| NEXUS - Screen Analysis | ~90% | Tesseract.js OCR working, refinement needed |
| Web System - Server | Done | All routes, jobs, services, middleware |
| Web System - Client | Done | Dashboard, chat, briefs, settings, notifications |
| Web System - AI Providers | Done | z.ai, Gemini, Pieces Copilot all working |
| VSCode Ext - Core | Done | Activity monitor, suggestion engine, interruption manager |
| VSCode Ext - Pieces Integration | ~85% | Connected but edge cases remain |
| VSCode Ext - Webview Panel | Done | Stats, settings, suggestion cards |

---

## What I Learned

**Interruption timing is everything.** The hardest part wasn't generating good suggestions -- it was knowing when to show them. Interrupt during deep flow and you destroy productivity. Wait too long and the moment passes. The sweet spot is detecting natural transition points: when someone switches files, pauses typing for a specific duration, or encounters an error they linger on.

**Flow state detection is surprisingly tractable.** Typing velocity, backspace ratio, file switch frequency, and error count form a reliable signal. You don't need eye tracking or biometrics -- keyboard and editor telemetry is enough to distinguish "productive flow" from "stuck and frustrated."

**Multi-provider AI is worth the complexity.** Different tasks suit different models. Local Pieces Copilot for quick snippet lookups, Kimi K2.5 for nuanced conversation, Gemini for broad knowledge. The abstraction layer pays for itself.

**Context windows matter more than model quality.** A mediocre model with perfect context (what file you're in, what error you're seeing, what you were doing 5 minutes ago) outperforms a frontier model with no context every time.
