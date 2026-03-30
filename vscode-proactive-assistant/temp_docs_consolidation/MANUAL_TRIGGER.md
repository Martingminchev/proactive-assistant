# 🎯 How to Trigger Suggestions Manually

## Automatic Triggers (Current Implementation)

The extension automatically triggers suggestions when:

### 1. Flow State Changes to "stuck" or "frustrated"

**"Stuck" Detection:**
- Error persists for 20+ minutes on the same error
- High error count with no resolution

**"Frustrated" Detection:**
- High backspace ratio (lots of deleting)
- Rapid file switching
- Low typing velocity with high error rate

## Manual Trigger Options

### Option 1: Simulate Stuck State (Easiest)

1. Open a code file in VS Code
2. Introduce a syntax error
3. Leave the error there for **20+ minutes**
4. The extension will detect "stuck" state and trigger a suggestion

### Option 2: Create a Test Command (Recommended for Testing)

Add a temporary command to manually trigger suggestions:

**In `src/commands/index.ts` add:**

```typescript
// Temporary test command
vscode.commands.registerCommand('proactiveAssistant.testSuggestion', async () => {
  const { services } = require('../extension');
  const svc = services;
  
  if (!svc) {
    vscode.window.showErrorMessage('Extension not ready');
    return;
  }
  
  // Create a test suggestion
  const testSuggestion = {
    id: 'test-' + Date.now(),
    title: '🧪 Test Suggestion',
    description: 'This is a manually triggered test suggestion.',
    priority: 'high',
    timestamp: new Date(),
    actions: [
      { id: 'apply', label: 'Apply Test', type: 'apply', isPrimary: true },
      { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
    ],
    context: {
      file: vscode.window.activeTextEditor?.document.uri.fsPath,
      language: vscode.window.activeTextEditor?.document.languageId,
      line: vscode.window.activeTextEditor?.selection.active.line
    }
  };
  
  // Show it
  const panelProvider = svc.panelProvider || getPanel(svc);
  await panelProvider.showSuggestion(testSuggestion as Suggestion);
  
  vscode.window.showInformationMessage('Test suggestion triggered!');
});
```

**Add to package.json:**

```json
{
  "command": "proactiveAssistant.testSuggestion",
  "title": "Proactive Assistant: Test Suggestion",
  "category": "Proactive Assistant"
}
```

### Option 3: Force Flow State (For Development)

**In Developer Tools Console:**

1. Open Command Palette → "Developer: Toggle Developer Tools"
2. In Console, you can try:

```javascript
// This would require exposing the activityMonitor globally
vscode.commands.executeCommand('proactiveAssistant.openPanel');
```

### Option 4: Modify Interruption Threshold (Quickest for Testing)

**Temporarily lower the thresholds in `src/services/interruptionManager.ts`:**

```typescript
// Change the stuck detection time from 20 minutes to 1 minute:
const STUCK_THRESHOLD_MS = 1 * 60 * 1000; // 1 minute instead of 20

// In shouldInterrupt method, temporarily bypass checks:
async shouldInterrupt(...): Promise<InterruptionDecision> {
  // FOR TESTING: Always allow interruption
  return { shouldInterrupt: true, reason: 'test-mode' };
}
```

**Remember to revert after testing!**

---

## Current Suggestion Flow

```
User Activity
    ↓
ActivityMonitor detects state change
    ↓
Flow State = 'stuck' or 'frustrated'
    ↓
SuggestionOrchestrator.tryGenerateSuggestion()
    ↓
InterruptionManager.shouldInterrupt() [checks 30-min rule, focus mode, etc.]
    ↓
SuggestionEngine.generateForFlowState()
    ↓
Show notification + update panel
```

## Why No Manual Trigger Exists

The extension is designed to be **proactive** - it only suggests when it detects you need help (stuck/frustrated). There's no manual trigger command because:

1. It respects the 30-minute rule (no spam)
2. It respects focus mode
3. It requires actual context (file, errors, etc.)

For testing, Option 2 (test command) or Option 4 (lower thresholds) work best.

---

## Quick Test Method

**Fastest way to see a suggestion:**

1. Open any code file
2. Type some code with an error
3. Run this in VS Code's Debug Console (if debugging):

```typescript
// Get services and manually trigger
const svc = require('./out/extension').getServices();
if (svc) {
  svc.suggestionEngine.generateForFlowState({
    flowState: 'stuck',
    activityContext: { file: 'test.ts', language: 'typescript' },
    recentSuggestions: []
  });
}
```

Or simply **wait 20 minutes with an error** for automatic detection!
