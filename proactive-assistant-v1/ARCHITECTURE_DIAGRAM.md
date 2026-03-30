# System Architecture - Post-Fix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  (React Dashboard, VS Code Extension, CLI, etc.)                            │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (Express)                              │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │ /api/briefs │ │/api/context │ │/api/suggest │ │   /api/context/     │  │
│  │             │ │             │ │             │ │      health         │  │
│  │ • /today    │ │ • /realtime │ │ • /active   │ │                     │  │
│  │ • /history  │ │ • /patterns │ │ • /history  │ │ • / (snapshot)      │  │
│  │ • /generate │ │ • /blockers │ │ • /trigger  │ │ • /detailed         │  │
│  │ • /stats    │ │ • /search   │ │ • /:id/dismiss│ • /history         │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘  │
│                                                                              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐ ┌────────────────┐ ┌─────────────────┐
│   Context Health  │ │   Context      │ │   Suggestion    │
│     Service       │ │ Summarization  │ │     Service     │
│                   │ │    Service     │ │                 │
│ • Polls APIs      │ │                │ │ • Generates     │
│ • Tracks quality  │ │ • Filters      │ │   suggestions   │
│ • Recommends      │ │ • Prioritizes  │ │ • Contextual    │
│   fixes           │ │ • Synthesizes  │ │   relevance     │
└─────────┬─────────┘ └───────┬────────┘ └─────────────────┘
          │                   │
          └─────────┬─────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PIECES COPILOT SERVICE (Fixed)                           │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Port Discovery │  │  App Register   │  │  API Controllers│             │
│  │  [1000,39300,   │  │  (ConnectorApi) │  │                │             │
│  │   5323]         │  │                 │  │                │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                   DATA EXTRACTION (Fixed)                    │           │
│  │                                                              │           │
│  │  Workstream Summaries:                                       │           │
│  │    BEFORE: summary.summary?.text → Always empty              │           │
│  │    AFTER:  annotationApi.get() → ✅ Full content             │           │
│  │                                                              │           │
│  │  Vision Events:                                              │           │
│  │    BEFORE: event.textContent → Always empty                  │           │
│  │    AFTER:  event.textual.ocr.raw → ✅ OCR text               │           │
│  │                                                              │           │
│  │  Conversations:                                              │           │
│  │    BEFORE: convo.messages → Always empty                     │           │
│  │    AFTER:  conversationMessagesApi.get() → ✅ Messages       │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │              QUALITY SCORING SYSTEM                          │           │
│  │                                                              │           │
│  │  • assets:        "good" | "empty"                           │           │
│  │  • summaries:     "good" | "empty_content" | "sparse"        │           │
│  │  • visionEvents:  "good" | "no_ocr" | "unavailable"          │           │
│  │  • activities:    "good" | "limited" | "empty"               │           │
│  └─────────────────────────────────────────────────────────────┘           │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┬───────────────┐
                ▼               ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐
│   Assets API    │ │ Workstream API  │ │    Vision API   │ │  Activities API│
│   (1 found)     │ │ (107 summaries) │ │ (973 events)    │ │  (41 events)   │
│                 │ │                 │ │                 │ │                │
│ • Code snippets │ │ • AI summaries  │ │ • Screen caps   │ │ • App switches │
│ • Saved links   │ │ • Activity roll │ │ • OCR text      │ │ • File ops     │
│ • Notes         │ │ • Work patterns │ │ • Window titles │ │ • Copy/paste   │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └────────────────┘
        │                   │                   │               │
        └───────────────────┴───────────────────┴───────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PIECES OS (Local)                                    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    LTM-2.7   │  │     WPE      │  │   Copilot    │  │   Vector DB  │    │
│  │    Engine    │  │   (Vision)   │  │    (AI)      │  │   (Qdrant)   │    │
│  │              │  │              │  │              │  │              │    │
│  │ • Summaries  │  │ • Screen cap │  │ • QGPT       │  │ • Embeddings │    │
│  │ • Activities │  │ • OCR        │  │ • Relevance  │  │ • Search     │    │
│  │ • Patterns   │  │ • Context    │  │ • Models     │  │ • Retrieval  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User   │────▶│  Dashboard   │────▶│   Express    │────▶│   Context    │
│  Action  │     │    Request   │     │    Router    │     │   Service    │
└──────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                   │
                    ┌──────────────────────────────────────────────┘
                    │
                    ▼
         ┌────────────────────┐
         │  Context Summarizer │
         │                     │
         │  1. Fetch from APIs │
         │  2. Filter noise    │
         │  3. Score relevance │
         │  4. Build digest    │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│  Real-time API  │   │   Brief Job     │
│  (immediate)    │   │  (scheduled)    │
└────────┬────────┘   └────────┬────────┘
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│  JSON Response  │   │   AI Prompt     │
│                 │   │   Generation    │
│ {currentApp,    │   │                 │
│  currentFile,   │   │ "Based on your  │
│  inferredTask}  │   │  work on X..."  │
└─────────────────┘   └─────────────────┘
```

## Context Synthesis Pipeline

```
Raw API Data (5 sources)
        │
        ▼
┌───────────────┐
│ Intake Layer  │ ◄── Parallel fetch from all APIs
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Filter Layer  │ ◄── Remove noise, deduplicate
└───────┬───────┘
        │
        ▼
┌───────────────────┐
│ Prioritize Layer  │ ◄── Score by recency + relevance
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Synthesis Layer  │ ◄── Chunk creation, token budget
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│   Output Layer    │ ◄── AI-optimized format
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│   AI Digest       │ ◄── 4000 tokens max
│                   │
│ • Current Focus   │
│ • Blockers        │
│ • Projects        │
│ • Activity        │
│ • Patterns        │
└───────────────────┘
```

## Health Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                    Health Service                           │
│                   (runs every 60s)                          │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
    ┌───────────▼──────────┐  ┌──────────▼──────────┐
    │   API Health Check   │  │   Quality Analysis  │
    │                      │  │                     │
    │ • Check each API     │  │ • Content presence  │
    │ • Measure latency    │  │ • OCR availability  │
    │ • Track errors       │  │ • Data freshness    │
    └───────────┬──────────┘  └──────────┬──────────┘
                │                         │
                └───────────┬─────────────┘
                            ▼
                ┌───────────────────────┐
                │   Recommendation      │
                │      Engine           │
                │                       │
                │ "🔴 WPE: Check        │
                │  screen recording"    │
                │                       │
                │ "🟡 Summaries:        │
                │  Need more activity"  │
                └───────────────────────┘
```

## Token Budget Allocation

```
┌────────────────────────────────────────────────────────────┐
│                    4000 Tokens Total                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  CURRENT FOCUS        [████████░░░░░░░░░░░░]  800 (20%)   │
│  What they're doing NOW                                    │
│                                                            │
│  BLOCKERS             [██████░░░░░░░░░░░░░░]  600 (15%)   │
│  Errors, stuck states                                      │
│                                                            │
│  PROJECTS             [█████░░░░░░░░░░░░░░░]  500 (12%)   │
│  Active work items                                         │
│                                                            │
│  ACTIVITY             [████░░░░░░░░░░░░░░░░]  400 (10%)   │
│  Recent actions                                            │
│                                                            │
│  PATTERNS             [███░░░░░░░░░░░░░░░░░]  300 ( 8%)   │
│  Historical trends                                         │
│                                                            │
│  FLEXIBILITY BUFFER   [██████████████░░░░░░] 1400 (35%)   │
│  Overhead + expansion room                                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```
