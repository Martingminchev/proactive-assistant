# Context Summarization Service Architecture

## Overview

The `ContextSummarizationService` is an optimal context summarization system designed to transform raw Pieces OS data into AI-optimized context within a strict 4000-token budget. It uses a multi-layer pipeline architecture that mimics human cognitive processing of information.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT SUMMARIZATION PIPELINE                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   INTAKE     │───▶│   FILTER     │───▶│  PRIORITIZE  │              │
│  │   LAYER      │    │   LAYER      │    │    LAYER     │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│        │                   │                   │                        │
│        ▼                   ▼                   ▼                        │
│   Raw API Calls      Noise Removal       Importance Ranking            │
│   Data Fetching      Deduplication       Temporal Weighting            │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐                                  │
│  │  SYNTHESIZE  │───▶│    OUTPUT    │                                  │
│  │    LAYER     │    │    LAYER     │                                  │
│  └──────────────┘    └──────────────┘                                  │
│        │                   │                                           │
│        ▼                   ▼                                           │
│   Chunk Creation     Token Budgeting                                  │
│   Context Fusion     AI Prompt Build                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Layer Details

### 1. Intake Layer (`fetchRawContext`)

**Purpose**: Collect raw data from all Pieces OS APIs

**Data Sources**:
- Vision Events (screen captures with OCR)
- Activities (application interactions)
- Workstream Summaries (AI-generated session summaries)
- Assets (saved code snippets)
- Anchors (file locations)
- Websites (visited URLs)
- OCR Analyses (extracted screen text)
- Conversations (chat history)

**Key Features**:
- Parallel API calls for efficiency
- Standardized data extraction
- Timestamp normalization
- Graceful error handling (returns empty arrays on failure)

### 2. Filtering Layer (`filterContext`)

**Purpose**: Remove noise and irrelevant items

**Filters Applied**:

| Data Type | Filter Criteria | Rationale |
|-----------|-----------------|-----------|
| Vision Events | Within 1 hour, has app name | Focus on recent activity |
| Activities | High rank OR recent | Keep important events longer |
| Workstream Summaries | Within 24 hours | Session summaries expire |
| Anchors | Has file path, not node_modules | Valid file references only |
| Websites | Skip search/CDN URLs | Remove non-informative URLs |
| OCR Text | 20-1000 chars | Filter empty/too long text |

**Deduplication**:
- File paths normalized (case-insensitive)
- URLs stripped of query params
- Project names extracted from paths
- Tag occurrence counting

### 3. Prioritization Layer (`prioritizeContext`)

**Purpose**: Rank items by importance using multi-factor scoring

**Temporal Weighting Formula**:
```
weight = 0.5^(age_in_hours)

Recent (15 min):  3.0x multiplier
Last hour:        2.5x multiplier
Last 4 hours:     2.0x multiplier
Last 8 hours:     1.5x multiplier
Last 24 hours:    1.2x multiplier
Older:            1.0x multiplier
```

**Priority Tiers**:

1. **Current Focus** (Tier 1): Vision events with application, file, and URL data
2. **Blockers** (Tier 2): Error patterns, high-rank activities, OCR error text
3. **Active Projects** (Tier 3): Project folders, topic clusters
4. **Activities** (Tier 4): Scored by rank × recency
5. **Patterns** (Tier 5): Long-term trends, application usage

### 4. Synthesis Layer (`synthesizeToChunks`)

**Purpose**: Condense prioritized data into structured chunks

**Chunk Types**:

```javascript
{
  currentFocus: {
    primaryApplication: "VS Code",
    confidence: 0.85,
    recentFiles: [...],
    recentUrls: [...],
    context: "coding"  // inferred from titles
  },
  
  blockers: [{
    type: "screen_error",
    indicators: ["error:", "exception:"],
    severity: "high"
  }],
  
  projects: [{
    name: "proactive-assistant",
    fileCount: 12,
    lastAccessed: "..."
  }],
  
  activitySummary: {
    level: "high",
    topTypes: [...]
  },
  
  patterns: {
    topApplications: [...],
    topLanguages: [...]
  }
}
```

### 5. Output Layer (`buildDigest`)

**Purpose**: Construct final output within token budget

**Token Budget Allocation**:

```
Total Budget: 4000 tokens

Current Focus:    800 tokens (20%)
Blockers:         600 tokens (15%)
Active Projects:  500 tokens (12%)
Activity Summary: 400 tokens (10%)
Work Patterns:    300 tokens (7%)
Overhead:         ~400 tokens (10%)
Reserved:         ~1000 tokens (26%)  // Flexibility buffer
```

**Truncation Strategy**:
- Arrays: Keep highest-scored items first
- Strings: Truncate to 200 chars + "..."
- Objects: Remove less critical fields

## Key Algorithms

### Current Focus Inference

```javascript
function inferCurrentFocus(visionEvents, activities) {
  // 1. Filter to recent window (15 min)
  const recent = filterRecent(visionEvents, 15 * 60 * 1000);
  
  // 2. Count application occurrences
  const appCounts = countBy(recent, 'application');
  const primaryApp = maxBy(appCounts);
  
  // 3. Extract files from anchors
  const recentFiles = extractUnique(recent.flatMap(e => e.anchors));
  
  // 4. Infer task from URLs/titles
  const task = inferTaskFromIndicators(recent);
  
  // 5. Calculate confidence
  const confidence = min(1, 
    files.length * 0.1 + 
    urls.length * 0.1 + 
    primaryApp.occurrences * 0.1
  );
  
  return { app, file, task, confidence };
}
```

### Blocker Detection

```javascript
function extractBlockers(context) {
  const blockerKeywords = [
    'error', 'bug', 'fix', 'fail', 'crash',
    'exception', 'broken', 'issue', 'problem', 'stuck'
  ];
  
  const blockers = [];
  
  // Check workstream summaries
  summaries.forEach(s => {
    const matches = blockerKeywords.filter(k => 
      s.summary.toLowerCase().includes(k)
    );
    if (matches.length > 0) {
      blockers.push({
        source: s,
        indicators: matches,
        score: matches.length * 2
      });
    }
  });
  
  // Check OCR text for error patterns
  ocrAnalyses.forEach(ocr => {
    const errorPatterns = ['error:', 'exception:', 'failed'];
    const matches = errorPatterns.filter(p => 
      ocr.text.toLowerCase().includes(p)
    );
    if (matches.length > 0) {
      blockers.push({ type: 'screen_error', ... });
    }
  });
  
  return blockers.sort((a, b) => b.score - a.score);
}
```

### Confidence Scoring

```javascript
function calculateConfidence(synthesized, sections) {
  return {
    // Current focus clarity (0-1)
    currentFocus: hasRecentData ? 0.8 : 0.3,
    
    // Data coverage (0-1)
    dataCoverage: sections.length / 5,
    
    // Recency of data (boolean → 0.2)
    hasRecentData: lastActivity < 1 hour,
    
    // Overall weighted score
    overall: currentFocus * 0.4 + 
             dataCoverage * 0.4 + 
             hasRecentData * 0.2
  };
}
```

## Quality Metrics

The service tracks several quality indicators:

| Metric | Target | Description |
|--------|--------|-------------|
| Token Efficiency | >80% | % of budget used for meaningful content |
| Confidence Score | >0.6 | Overall reliability of context |
| Coverage | >3 tiers | Number of priority tiers represented |
| Recency | <1 hour | Time since last activity detection |
| Deduplication Rate | >20% | Reduction in redundant items |

## Usage Patterns

### Pattern 1: Real-time Context
```javascript
// Get current context for immediate AI assistance
const result = await contextService.synthesizeContext();
const prompt = contextService.buildAIPrompt(result);
const aiResponse = await aiModel.generate(prompt);
```

### Pattern 2: Pre-fetched Context
```javascript
// Use cached/raw context for faster processing
const rawContext = await piecesService.getComprehensiveContext();
const result = await contextService.synthesizeContext(rawContext);
```

### Pattern 3: Focus Extraction Only
```javascript
// Quick focus detection without full synthesis
const focus = contextService.inferCurrentFocus(
  visionEvents, 
  activities
);
if (focus.confidence > 0.7) {
  // Act on high-confidence focus detection
}
```

## Performance Characteristics

| Operation | Typical Time | Complexity |
|-----------|--------------|------------|
| Fetch Raw Context | 200-500ms | O(n) API calls |
| Filter Context | 10-50ms | O(n) iterations |
| Prioritize | 20-100ms | O(n log n) sorting |
| Synthesize | 10-30ms | O(n) chunking |
| Build Digest | 5-20ms | O(n) construction |
| **Total** | **250-700ms** | **O(n log n)** |

## Integration Points

```
┌─────────────────┐     ┌─────────────────────────┐     ┌─────────────────┐
│  Pieces OS APIs │────▶│ ContextSummarizationSvc │────▶│  AI/LLM Models  │
└─────────────────┘     └─────────────────────────┘     └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Express Routes │
                       │  /api/context   │
                       └─────────────────┘
```

## Future Enhancements

1. **Semantic Clustering**: Use embeddings to group related activities
2. **Predictive Focus**: Anticipate user needs based on patterns
3. **Multi-modal Context**: Include screenshot analysis
4. **Collaborative Context**: Merge team member contexts
5. **Temporal Patterns**: Day-of-week, time-of-day adjustments

## Summary

The ContextSummarizationService provides:

- **Optimal Token Usage**: Strict 4000-token budget with intelligent allocation
- **High Confidence**: Multi-factor scoring with explicit confidence metrics
- **Smart Prioritization**: Current focus → Blockers → Projects → Activity → Patterns
- **Clean Architecture**: 5-layer pipeline with clear separation of concerns
- **Extensible Design**: Easy to add new data sources or scoring algorithms
