# User-Centered AI Assistant Design

## Core Philosophy

> **The assistant should feel like a pair programming partner who actually pays attention - not a random suggestion generator.**

---

## User Personas

### 1. The Deep Diver (Alex)
- **Profile**: Full-stack developer working on complex features
- **Behavior**: Gets in flow state, codes for 3-4 hour stretches, forgets to commit/push
- **Pain Points**: 
  - Loses track of time and skips meals
  - Forgets context when switching between PRs
  - Gets stuck debugging for hours without a break
- **Needs**: Time awareness, context recovery, gentle nudges

### 2. The Context Switcher (Jordan)
- **Profile**: Tech lead juggling multiple projects and meetings
- **Behavior**: Constantly switching between code review, meetings, and feature work
- **Pain Points**:
  - Forgets what they were working on after a meeting
  - Accumulates "parking lot" of TODOs
  - Can't maintain deep focus
- **Needs**: Rapid context recovery, TODO tracking, focus protection

### 3. The Learner (Sam)
- **Profile**: Junior developer building skills
- **Behavior**: Heavy documentation reader, Googles extensively, saves lots of snippets
- **Pain Points**:
  - Information overload from tutorials
  - Can't connect learned concepts to actual work
  - Re-googles the same things
- **Needs**: Pattern recognition, knowledge consolidation, practical application

---

## Pain Points Matrix

| Pain Point | Current System | Ideal Solution |
|------------|---------------|----------------|
| **Getting Stuck** | Generic "take a break" tips | Detect stuck state (repeated errors, same file for 45+ min, StackOverflow loops) → offer specific help or suggest rubber duck debugging |
| **Context Loss** | Shows random recent files | "You were refactoring UserService when you switched to Slack. Here's your last thought: 'need to extract validation logic'" |
| **TODO Accumulation** | No tracking | Surface TODOs from current project: "You have 4 TODOs in files you edited today" |
| **Focus Destruction** | Interrupts with random news | Batch non-urgent suggestions; only interrupt for blockers or wellness checks |
| **Repetitive Work** | Doesn't notice patterns | "You've written 3 similar useEffect hooks today - here's a custom hook template" |
| **Decision Fatigue** | Asks user to choose from options | Make intelligent defaults: "I've prepared the scaffold for your new component - accept or modify?" |
| **Burnout Risk** | No wellness tracking | Track session length, error rate spikes, time since last break → suggest walk/stretch |
| **Missing Deadlines** | No timeline awareness | "Your PR has been open 3 days with no review - want me to remind the team?" |

---

## Redesigned Brief Format

### Current Format (Problematic)
```
📊 Daily Brief
- Improvements: [generic suggestions]
- News: [random articles]
- MVP Ideas: [unrelated projects]
```

### New Format: Action-First Architecture

```
┌─────────────────────────────────────────────────────────┐
│  🔴 IMMEDIATE ATTENTION                                  │
│  [Only if something needs action NOW]                   │
│  - "You've been stuck on this error for 47 minutes"     │
│  - "3 PRs need your review before EOD"                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🧠 CONTEXT RECOVERY                                     │
│  "Welcome back! You were working on:"                   │
│  - File: src/services/auth.ts                           │
│  - Last action: Refactoring login method                │
│  - Your note: "Extract to separate service"             │
│  [Continue where I left off] [Show related TODOs]       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  💡 SMART SUGGESTIONS (Max 3, ranked by urgency)        │
│                                                         │
│  1. [HIGH] Pattern detected                             │
│     "You've created 4 similar API hooks today. Create   │
│      a useApi hook? [Yes] [Not now] [Don't suggest]"    │
│                                                         │
│  2. [MEDIUM] TODO reminder                              │
│     "You left a TODO in AuthService.ts 2 days ago"      │
│                                                         │
│  3. [LOW] Knowledge connection                          │
│     "The React Query pattern you're using matches a     │
│      snippet you saved last week"                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🌱 WELLNESS CHECKS                                      │
│  [Only after 2+ hours of continuous work]               │
│  - "You've been coding for 2.5 hours. Quick stretch?"   │
│  - "11 errors in the last 30 min - frustration spike?"  │
└─────────────────────────────────────────────────────────┘
```

---

## Enhanced Prompt Strategy

### 1. Stuck Detection Prompt
```
Analyze the developer's recent activity for signs of being stuck:

INPUT:
- Time on current file/task: {minutes}
- Error count in last 30 min: {count}
- Repeated searches: [{queries}]
- File save attempts: {count}
- Navigation pattern: {pattern}

OUTPUT (JSON):
{
  "isStuck": boolean,
  "stuckType": "debugging_loop" | "research_rabbit_hole" | "implementation_paralysis" | null,
  "confidence": 1-10,
  "evidence": ["specific observations"],
  "suggestedIntervention": {
    "type": "offer_solution" | "suggest_break" | "rubber_duck" | "connect_to_resource",
    "message": "personalized message referencing their actual situation",
    "action": "specific action they can take"
  }
}
```

### 2. Context Recovery Prompt
```
Generate a context recovery summary for a developer returning after {awayDuration}.

INPUT:
- Last active file: {file}
- Last 5 git operations: [{ops}]
- Open TODOs in current project: [{todos}]
- Recent workstream summary: {summary}
- Time since last commit: {duration}

OUTPUT (JSON):
{
  "contextSummary": "1-2 sentence summary of what they were doing",
  "recoveryPriority": "continue_work" | "review_changes" | "address_todos",
  "keyContext": {
    "mainFile": "path to primary file",
    "lastThought": "their last note/TODO",
    "uncommittedChanges": boolean,
    "pendingReviews": count
  },
  "suggestedFirstAction": "specific action to get back in flow"
}
```

### 3. Pattern Recognition Prompt
```
Analyze code patterns in the last {hours} hours:

INPUT:
- Files modified: [{files}]
- Code snippets from changes: [{snippets}]
- Time between similar changes: [{durations}]

OUTPUT (JSON):
{
  "patternsDetected": [{
    "type": "repetitive_code" | "similar_structure" | "copy_paste",
    "confidence": 1-10,
    "examples": ["file:line - brief description"],
    "suggestedAbstraction": "specific suggestion for DRYing code",
    "effortEstimate": "minutes to implement"
  }],
  "shouldSuggest": boolean,
  "urgency": 1-10
}
```

---

## Action-Oriented Suggestions

### Every Suggestion Must Have:

1. **Clear Trigger** - Why now? What pattern was detected?
2. **Specific Context** - Reference actual files/code/times
3. **Action Button(s)** - Not just "View" but "Apply Template", "Create Hook", "Commit Now"
4. **Dismissal Reason** - Learn from rejection: "Why not? [Not relevant] [Too busy] [Already done]"

### Suggestion Types:

| Type | Example | Actions |
|------|---------|---------|
| **blocker_help** | "You keep getting the same TypeScript error" | [Show fix] [Explain error] [Find examples in my code] |
| **pattern_abstraction** | "You've written 3 similar fetch wrappers" | [Generate hook] [Show diff] [Remind later] |
| **todo_nudge** | "This TODO is 3 days old" | [Open file] [Mark done] [Snooze 1 day] |
| **context_switch** | "You have uncommitted changes from 2 hours ago" | [View changes] [Commit now] [Discard] |
| **wellness_nudge** | "You've been debugging for 90 minutes with rising error rates" | [5-min break] [Switch tasks] [I'm fine - dismiss] |
| **knowledge_link** | "This problem matches a pattern you saved 2 weeks ago" | [View snippet] [Compare side-by-side] |
| **deadline_aware** | "Your PR has been sitting for 48 hours" | [Request review] [View PR] [Dismiss] |

---

## Feedback Loop

Every suggestion tracks:
```javascript
{
  suggestionId: "uuid",
  type: "pattern_abstraction",
  triggerContext: "3 similar useEffect hooks detected",
  userAction: "accepted" | "dismissed" | "ignored" | "snoozed",
  dismissalReason: "not_relevant" | "too_busy" | "already_done" | "bad_timing",
  outcome: "helpful" | "annoying" | "neutral",  // Optional follow-up
  timestamp: ISOString
}
```

Used to:
- Adjust suggestion frequency per type
- Learn user's preferred interruption times
- Improve pattern detection thresholds

---

## Implementation Priorities

### Phase 1: Core Detection (MVP)
- [ ] Stuck state detection (time + error patterns)
- [ ] Context recovery (last file + git state)
- [ ] Basic TODO tracking

### Phase 2: Pattern Recognition
- [ ] Similar code detection
- [ ] Repeated search detection
- [ ] Work rhythm analysis

### Phase 3: Intelligence
- [ ] Personalized suggestion ranking
- [ ] Proactive intervention timing
- [ ] Cross-project pattern learning

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Suggestion Acceptance Rate | >40% | User clicks "accept" or takes suggested action |
| Context Recovery Time | <30 sec | Time from opening IDE to first productive action |
| Stuck State Detection Accuracy | >70% | User confirms they were stuck when prompted |
| User Satisfaction | >4.0/5 | Weekly micro-surveys on helpfulness |
| Interruption Fatigue | <10% | Suggestions marked as "annoying" or disabled |
