# Enhanced AI Prompts for Proactive Assistant

This module contains **specific, actionable AI prompts** designed to produce actually useful output for developers. Unlike generic prompts that result in vague advice like "consider using better practices," these prompts leverage rich context from Pieces OS to deliver concrete, actionable insights.

## 🎯 Design Principles

1. **Specific over Generic**: Every prompt targets a specific developer scenario
2. **Actionable Output**: Results include concrete steps, code examples, and commands
3. **Context-Aware**: Leverages Pieces OS data (files, activities, vision events, etc.)
4. **Confidence Scored**: Every detection includes a confidence score
5. **Structured JSON**: All outputs follow strict schemas for frontend consumption

## 📋 Available Scenarios

### 1. Stuck on Error (`stuckOnError`)
**Trigger**: User struggling with same error for >20 minutes, StackOverflow visits

**Output**:
```json
{
  "diagnosis": { "likelyCause": "...", "confidence": "high" },
  "solution": { "description": "...", "codeExample": "..." },
  "resources": [{ "title": "...", "url": "..." }],
  "nextAction": { "action": "...", "timeEstimate": "2 min" }
}
```

### 2. Focus Recovery (`focusRecovery`)
**Trigger**: Context switching detected, away from task for >10 minutes

**Output**:
```json
{
  "interruptionSummary": { "whatWasDoing": "...", "contextLoss": "medium" },
  "recoveryPlan": { "immediateAction": "...", "fileToOpen": "..." },
  "contextRestore": { "relevantTODOs": [...], "recentChanges": "..." }
}
```

### 3. Wellness Check (`wellnessCheck`)
**Trigger**: Long session (>4h), high error rate, late hours

**Output**:
```json
{
  "wellnessStatus": { "fatigueLevel": "high", "riskFactors": [...] },
  "breakRecommendation": { "type": "micro", "duration": "5 min" },
  "activity": { "title": "20-20-20 Eye Rest", "description": "..." },
  "returnPlan": { "whenToReturn": "After 5 minutes" }
}
```

### 4. Morning Brief (`morningBrief`)
**Trigger**: First activity of the day

**Output**:
```json
{
  "greeting": "Good morning! ☕",
  "yesterdayRecap": { "oneSentence": "...", "keyAccomplishment": "..." },
  "todayPriorities": [
    { "rank": 1, "task": "...", "estimatedTime": "...", "successCriteria": "..." }
  ],
  "toolSuggestion": { "name": "...", "whyToday": "..." },
  "watchOutFor": { "risk": "...", "mitigation": "..." }
}
```

### 5. Pattern Insight (`patternInsight`)
**Trigger**: Repetitive actions detected, automation opportunity

**Output**:
```json
{
  "pattern": { "name": "Manual API Testing", "frequency": "8x/hour" },
  "impact": { "timePerDay": "45 minutes", "frustrationLevel": "high" },
  "solution": { "type": "automation", "codeExample": "..." },
  "roi": { "setupTime": "15 min", "dailySavings": "45 min", "breakEven": "1 day" }
}
```

### 6. Debugging Marathon (`debuggingMarathon`)
**Trigger**: Extended debugging (>30min), many breakpoints

**Output**:
```json
{
  "situation": { "type": "debugging_loop", "riskLevel": "frustrated" },
  "freshApproach": { "technique": "Binary Search Debugging", "command": "..." },
  "whenToAskForHelp": { "threshold": "After 1 more hour", "whatToPrepare": "..." }
}
```

### 7. Deep Focus (`deepFocus`)
**Trigger**: Sustained single-task work (>30min), minimal switching

**Output**:
```json
{
  "flowStatus": { "state": "deep_flow", "quality": "high" },
  "protection": { "notifications": "Silence all", "autoActions": [...] },
  "breakStrategy": { "suggestBreakAt": "After completing current function" }
}
```

### 8. Code Review (`codeReviewOpportunity`)
**Trigger**: Recent code changes, >30min on same file

**Output**:
```json
{
  "reviewSummary": { "overallQuality": "good", "issueCount": {...} },
  "issues": [{ "severity": "warning", "file": "...", "suggestedCode": "..." }],
  "quickWins": [{ "action": "Add input validation", "time": "2 min" }]
}
```

### 9. Learning Moment (`learningMoment`)
**Trigger**: Documentation/tutorial browsing detected

**Output**:
```json
{
  "learningOpportunity": { "topic": "React Hooks", "urgency": "this_week" },
  "recommendedResource": { "title": "...", "url": "...", "timeRequired": "20 min" },
  "practiceExercise": { "title": "...", "starterCode": "..." }
}
```

### 10. Meeting Prep (`meetingPrep`)
**Trigger**: Calendar event approaching

**Output**:
```json
{
  "meeting": { "type": "standup", "startsIn": "15 minutes" },
  "preparation": { "items": [...], "totalTime": "5 minutes" },
  "talkingPoints": [{ "topic": "...", "basedOn": "Recent PR #234" }]
}
```

## 🚀 Usage

### Basic Usage

```javascript
const intelligentBriefService = require('../services/intelligentBriefService');

// Generate a brief based on current context
const brief = await intelligentBriefService.generateIntelligentBrief();
```

### Manual Scenario Trigger (Testing)

```javascript
// Force a specific scenario
const brief = await intelligentBriefService.triggerScenario('stuckOnError', {
  errorContext: {
    errorPattern: 'TypeError: Cannot read property',
    durationMinutes: 35
  }
});
```

### Using Prompts Directly

```javascript
const { prompts, SCENARIOS } = require('../prompts');

// Generate prompt configuration
const promptConfig = prompts.stuckOnError({
  errorContext: {
    errorPattern: 'NullPointerException',
    durationMinutes: 30
  }
});

// Use with your AI provider
const response = await aiProvider.complete({
  systemPrompt: promptConfig.systemPrompt,
  userPrompt: promptConfig.userPrompt
});
```

## 📊 Confidence Scoring

Every scenario detection includes a confidence score (0.0 - 1.0):

| Score | Interpretation |
|-------|----------------|
| 0.9+ | Very high confidence - likely accurate |
| 0.7-0.9 | High confidence - probably accurate |
| 0.5-0.7 | Moderate confidence - check context |
| <0.5 | Low confidence - may be incorrect |

Confidence is calculated based on:
- Data quality and quantity
- Pattern strength
- Context clarity
- Historical accuracy

## 🎨 Output Formatting

The `IntelligentBriefService` formats all outputs for maximum actionability:

```javascript
{
  title: "🐛 Cannot read property of undefined",
  description: "The error occurs because data.items is undefined...",
  type: "blocker",
  priority: 9,
  actions: [
    { label: "Try Fix", type: "copy", payload: "code..." },
    { label: "View Docs", type: "link", payload: "https://..." },
    { label: "Dismiss", type: "dismiss" }
  ],
  metadata: {
    confidence: 0.85,
    nextAction: { action: "Add null check", timeEstimate: "2 min" }
  }
}
```

## 🔧 Extending

### Adding a New Scenario

1. Add scenario constant to `SCENARIOS`
2. Create prompt generator in `prompts` object
3. Add detection logic in `detectScenarios()`
4. Add confidence calculator
5. Add formatter in `formatForActionability()`

Example:

```javascript
// 1. Add to SCENARIOS
NEW_SCENARIO: 'new_scenario'

// 2. Create prompt
newScenario: (context) => ({
  systemPrompt: `...`,
  userPrompt: `...`,
  confidence: calculateNewScenarioConfidence(context)
})

// 3. Add detection
if (this.isNewScenario(context)) {
  detected.push({ scenario: SCENARIOS.NEW_SCENARIO, ... });
}
```

## 📝 Best Practices

### Do:
- Provide specific file names and line numbers
- Include actual code examples
- Give time estimates for actions
- Reference real documentation URLs
- Quantify impact (time saved, etc.)

### Don't:
- Give generic advice
- Use vague language like "consider" or "might"
- Suggest actions without context
- Overwhelm with too many suggestions
- Break developer's flow unnecessarily
