# Enhanced AI Prompts System - Implementation Summary

## 🎯 What Was Created

This implementation addresses the core problem: **generic AI prompts that produce vague, unhelpful output**. The new system creates specific, actionable prompts tailored to real developer scenarios.

## 📁 Files Created

### 1. `server/prompts/enhancedPrompts.js` (34KB)
The core prompt library with 10 scenario-specific prompt generators:

| Scenario | Trigger | Output |
|----------|---------|--------|
| `stuckOnError` | Error for >20min | Diagnosis, fix code, docs link, next action |
| `focusRecovery` | Context switching | Exact task to resume, TODOs, what to defer |
| `wellnessCheck` | Long session | Specific break activity, when to return |
| `morningBrief` | First activity | Yesterday recap, 3 priorities, tool suggestion |
| `patternInsight` | Repetitive actions | Automation script, ROI calculation |
| `debuggingMarathon` | Extended debugging | Fresh approach, systematic plan, help threshold |
| `deepFocus` | Sustained work | Flow protection, strategic break timing |
| `codeReviewOpportunity` | Recent code changes | Specific issues, before/after code |
| `learningMoment` | Documentation browsing | Best resource, practice exercise |
| `meetingPrep` | Calendar event | Prep checklist, talking points, time estimate |

### 2. `server/services/intelligentBriefService.js` (32KB)
Service that:
- Detects which scenario applies from Pieces context
- Selects appropriate prompt
- Generates brief using AI (z.ai, Gemini, or Pieces)
- Formats output for maximum actionability
- Includes confidence scores (0.0-1.0)
- Saves briefs as suggestions in database

### 3. `server/prompts/index.js`
Module entry point for clean imports

### 4. `server/prompts/README.md` (8KB)
Complete documentation with:
- All 10 scenarios detailed
- JSON output schemas
- Usage examples
- Extension guide

### 5. `server/examples/enhancedPromptsExample.js` (16KB)
8 runnable examples demonstrating:
- Direct prompt usage
- All scenario types
- Confidence calculations
- Complete workflow

## 🚀 Key Features

### Specific, Actionable Output

**Before (Generic):**
> "Consider debugging your code and checking the documentation."

**After (Enhanced):**
```json
{
  "diagnosis": {
    "likelyCause": "data.items is undefined because API returned null",
    "confidence": "high"
  },
  "solution": {
    "codeExample": "const items = data?.items ?? [];",
    "commandToRun": "curl http://localhost:3000/api/items"
  },
  "nextAction": {
    "action": "Add null check before map()",
    "timeEstimate": "2 minutes"
  }
}
```

### Confidence Scoring

Every detection includes a confidence score:
- 90%+ = Very high confidence
- 70-90% = High confidence  
- 50-70% = Moderate confidence
- <50% = Low confidence (won't trigger)

Factors affecting confidence:
- Data quality and quantity
- Pattern strength
- Context clarity

### Structured JSON Output

All prompts produce strict JSON schemas with:
- Specific file names and line numbers
- Actual code examples
- Real documentation URLs
- Time estimates
- Clear action items

### Integration with Pieces OS

The system leverages:
- Recent files (anchors)
- Activity history
- Vision events (OCR)
- Workstream summaries
- Conversations
- Saved assets

## 📋 Usage Examples

### Basic Usage
```javascript
const intelligentBriefService = require('./services/intelligentBriefService');

// Auto-detect scenario and generate brief
const brief = await intelligentBriefService.generateIntelligentBrief();
```

### Direct Prompt Usage
```javascript
const { prompts } = require('./prompts');

const promptConfig = prompts.stuckOnError({
  errorContext: {
    errorPattern: 'TypeError: Cannot read property',
    durationMinutes: 35
  }
});

// Use with your AI provider
const response = await aiProvider.complete({
  systemPrompt: promptConfig.systemPrompt,
  userPrompt: promptConfig.userPrompt
});
```

### Manual Testing
```javascript
// Force a specific scenario
const brief = await intelligentBriefService.triggerScenario(
  'stuck_on_error'
);
```

## 🔧 Integration

The `proactiveAssistantJob.js` has been updated to include Step 3:

```javascript
// Step 3: Generate intelligent contextual briefs
const intelligentBrief = await intelligentBriefService.generateIntelligentBrief();
```

This runs alongside the existing suggestion generation.

## 🎨 Output Formatting

Briefs are formatted for actionability:

```javascript
{
  title: "🐛 data.items is undefined",
  description: "Add optional chaining before map()",
  type: "blocker",
  priority: 9,
  actions: [
    { label: "Try Fix", type: "copy", payload: "const items = data?.items ?? [];" },
    { label: "View Docs", type: "link", payload: "https://mdn.io/optional-chaining" },
    { label: "Dismiss", type: "dismiss" }
  ],
  metadata: {
    confidence: 0.85,
    scenario: "stuck_on_error"
  }
}
```

## 🧪 Testing

Run the examples:
```bash
cd server
node examples/enhancedPromptsExample.js
```

This demonstrates all 10 scenarios without needing AI providers.

## 📊 Scenario Detection

The system detects scenarios by analyzing:

| Scenario | Detection Logic |
|----------|----------------|
| Stuck on Error | Error duration >20min, StackOverflow visits |
| Context Switching | >5 app switches, away >10min |
| Burnout Risk | Session >4h, high error rate, late hours |
| Repetitive Pattern | Same action >5x, >15min wasted |
| Debugging Marathon | Debug >30min, >3 approaches tried |
| Deep Focus | Single task >30min, <2 switches |

## 🔄 Workflow

```
1. Gather Context (from Pieces)
   ↓
2. Detect Scenarios (10 possible)
   ↓
3. Select Highest Priority
   ↓
4. Generate Prompt
   ↓
5. Call AI (z.ai/Gemini/Pieces)
   ↓
6. Format for Actionability
   ↓
7. Save as Suggestion
```

## 🛡️ Safeguards

- **Cooldown**: 30min minimum between same-scenario briefs
- **Confidence Threshold**: Only triggers if >50% confident
- **Priority Ranking**: Blockers > Wellness > Patterns > Tips
- **Fallback**: Graceful degradation if AI fails

## 📝 Best Practices Followed

1. **NEVER** say "consider" or "might" - be specific
2. **ALWAYS** provide code examples
3. **INCLUDE** time estimates
4. **REFERENCE** actual files/context
5. **QUANTIFY** impact (time saved, etc.)
6. **ONE** clear next action per brief

## 🚦 Next Steps

1. Configure AI provider (z.ai or Gemini) for full functionality
2. Run `node examples/enhancedPromptsExample.js` to see examples
3. Monitor confidence scores to tune detection
4. Add custom scenarios as needed

## 📈 Expected Impact

- **Before**: Generic tips like "take a break" or "debug your code"
- **After**: Specific fixes like "Add null check at line 42 in auth.js"

Developers get actionable help instead of vague suggestions.
