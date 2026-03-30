/**
 * Enhanced AI Prompts for Proactive Assistant
 * 
 * These prompts are designed to produce SPECIFIC, ACTIONABLE output
 * that developers can actually use, not generic advice.
 * 
 * Each prompt template:
 * - Takes rich context from Pieces OS data
 * - Produces structured, actionable output
 * - Includes confidence scoring
 * - Avoids vague suggestions like "consider using better practices"
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Scenario Detection Types
 */
const SCENARIOS = {
  STUCK_ON_ERROR: 'stuck_on_error',
  CONTEXT_SWITCHING: 'context_switching',
  BURNOUT_RISK: 'burnout_risk',
  MORNING_BRIEF: 'morning_brief',
  REPETITIVE_PATTERN: 'repetitive_pattern',
  DEEP_FOCUS: 'deep_focus',
  CODE_REVIEW_OPPORTUNITY: 'code_review_opportunity',
  LEARNING_MOMENT: 'learning_moment',
  DEBUGGING_MARATHON: 'debugging_marathon',
  MEETING_PREP: 'meeting_prep'
};

/**
 * Prompt Templates - Each produces structured, actionable output
 */
const prompts = {
  /**
   * SCENARIO: User has been stuck on the same error
   * Trigger: Repeated error patterns, same file open for >30min, StackOverflow visits
   */
  stuckOnError: (context) => {
    const errorContext = context.errorContext || {};
    const activityContext = context.activityContext || {};
    
    return {
      id: `stuck-${uuidv4()}`,
      scenario: SCENARIOS.STUCK_ON_ERROR,
      confidence: calculateStuckConfidence(context),
      systemPrompt: `You are a debugging expert analyzing a developer who appears to be stuck on an error.
Your goal is to provide SPECIFIC, ACTIONABLE help - not generic debugging advice.

CRITICAL RULES:
1. Identify the EXACT error type from the context
2. Provide a SPECIFIC solution with actual code
3. Link to relevant documentation (real URLs)
4. Give ONE concrete next action
5. If you can't determine the error, say so clearly

NEVER say:
- "Check your code for errors"
- "Consider debugging"
- "Look at the documentation"

ALWAYS provide:
- The most likely root cause (be specific)
- A code fix or command to run
- A real documentation link
- The exact file/line to check if available`,

      userPrompt: `## ERROR CONTEXT
Error Pattern: "${errorContext.errorPattern || 'Unknown error'}"
Duration Stuck: ${errorContext.durationMinutes || 'Unknown'} minutes
Files Open: ${(activityContext.openFiles || []).join(', ') || 'Unknown'}
Current File: ${context.currentFile || 'Unknown'}
Recent URLs: ${(activityContext.recentUrls || []).slice(0, 5).join(', ') || 'None'}

## RECENT ACTIVITY
Last 5 Actions:
${(activityContext.recentActions || []).map((a, i) => `${i + 1}. ${a}`).join('\n') || 'No activity tracked'}

## CODE CONTEXT (if available)
\`\`\`
${errorContext.codeSnippet || 'No code snippet available'}
\`\`\`

## YOUR TASK
Provide a debugging brief in this EXACT JSON format:
{
  "diagnosis": {
    "likelyCause": "Specific root cause (not generic)",
    "confidence": "high|medium|low",
    "reasoning": "Why you think this is the cause based on the context"
  },
  "solution": {
    "description": "Step-by-step fix",
    "codeExample": "Actual code they can use",
    "commandToRun": "CLI command if applicable"
  },
  "resources": [
    {
      "title": "Specific doc/StackOverflow link",
      "url": "real URL",
      "whyRelevant": "Why this helps"
    }
  ],
  "nextAction": {
    "action": "The ONE thing they should do right now",
    "timeEstimate": "e.g., 2 minutes",
    "expectedOutcome": "What will happen when they do this"
  },
  "prevention": "One tip to prevent this in the future"
}`,

      outputFormat: 'json',
      priority: errorContext.durationMinutes > 45 ? 10 : (errorContext.durationMinutes > 20 ? 8 : 6)
    };
  },

  /**
   * SCENARIO: User is context switching too much
   * Trigger: Multiple apps/files opened rapidly, no focus on single task >10min
   */
  focusRecovery: (context) => {
    const focusContext = context.focusContext || {};
    const previousContext = context.previousFocus || {};
    
    return {
      id: `focus-${uuidv4()}`,
      scenario: SCENARIOS.CONTEXT_SWITCHING,
      confidence: calculateFocusConfidence(context),
      systemPrompt: `You are a focus coach helping a developer recover from context switching.
Your goal is to help them get back to deep work quickly with SPECIFIC guidance.

CRITICAL RULES:
1. Identify what they were ACTUALLY working on before the interruption
2. Give them the EXACT next step to resume that work
3. Reference specific files, TODOs, or comments from their code
4. Suggest what to defer/ignore temporarily
5. Be concise - they need to act fast

NEVER say:
- "Try to focus better"
- "Minimize distractions"
- "Consider time management"

ALWAYS provide:
- The specific task they were doing
- The exact next action to resume
- Any TODOs or code comments they left
- What to ignore for now`,

      userPrompt: `## FOCUS INTERRUPTION CONTEXT
Previous Focus: "${previousContext.task || 'Unknown task'}"
Time Away: ${focusContext.timeAwayMinutes || 'Unknown'} minutes
Last Active File: ${previousContext.lastFile || 'Unknown'}
Last Action Before Break: ${previousContext.lastAction || 'Unknown'}

## CURRENT STATE
Open Files: ${(focusContext.currentFiles || []).join(', ') || 'Unknown'}
Recent Apps: ${(focusContext.recentApps || []).join(', ') || 'Unknown'}
Switch Count (last hour): ${focusContext.switchCount || 'Unknown'}

## RECOVERY DATA
TODOs in Code:
${(previousContext.todos || []).map(t => `- ${t.file}: ${t.text}`).join('\n') || 'No TODOs found'}

Recent Commits (if any):
${(previousContext.recentCommits || []).map(c => `- ${c}`).join('\n') || 'No recent commits'}

Unsaved Changes:
${previousContext.hasUnsavedChanges ? 'YES - unsaved changes detected' : 'None detected'}

## YOUR TASK
Provide a focus recovery brief in this EXACT JSON format:
{
  "interruptionSummary": {
    "whatWasDoing": "Specific task they were focused on",
    "interruptionType": "meeting|distraction|break|unknown",
    "contextLoss": "high|medium|low"
  },
  "recoveryPlan": {
    "immediateAction": "The ONE thing to do right now to resume",
    "fileToOpen": "Specific file they should open",
    "lineToNavigate": "Line number or function to jump to",
    "mindsetReset": "One sentence to get back in the zone"
  },
  "contextRestore": {
    "relevantTODOs": ["List of TODOs to check"],
    "recentChanges": "What they last changed",
    "branch": "Git branch if applicable"
  },
  "deferList": [
    {
      "what": "Thing to ignore for now",
      "why": "Why it can wait",
      "whenToHandle": "When they should deal with it"
    }
  ],
  "focusSuggestion": {
    "technique": "Specific focus technique (Pomodoro, etc.)",
    "duration": "Suggested focus block duration",
    "goal": "What to accomplish in this block"
  }
}`,

      outputFormat: 'json',
      priority: focusContext.switchCount > 10 ? 8 : 6
    };
  },
  
  /**
   * SCENARIO: User is at risk of burnout
   * Trigger: Long session (>4h), high error rate, repetitive actions, late hour
   */
  wellnessCheck: (context) => {
    const wellnessContext = context.wellnessContext || {};
    
    return {
      id: `wellness-${uuidv4()}`,
      scenario: SCENARIOS.BURNOUT_RISK,
      confidence: calculateBurnoutConfidence(context),
      systemPrompt: `You are a wellness-aware productivity assistant.
Your goal is to suggest a break in a way that respects the developer's flow while protecting their health.

CRITICAL RULES:
1. Be gentle, not preachy
2. Suggest SPECIFIC exercises/stretches (not just "take a break")
3. Give a clear "when to return" timeframe
4. Acknowledge what they're working on so they feel safe pausing
5. Keep it light and actionable

NEVER say:
- "You're working too hard"
- "You should take better care of yourself"
- "Health is important"

ALWAYS provide:
- A specific micro-break activity (1-5 min)
- One stretch or exercise
- Exactly when to come back
- Assurance their context will be saved`,

      userPrompt: `## WELLNESS CONTEXT
Session Length: ${wellnessContext.sessionLengthHours || 'Unknown'} hours
Time Since Last Break: ${wellnessContext.minutesSinceBreak || 'Unknown'} minutes
Current Time: ${wellnessContext.currentTime || 'Unknown'}
Stress Indicators: ${(wellnessContext.indicators || []).join(', ') || 'None detected'}
Error Rate (last hour): ${wellnessContext.errorRate || 'Unknown'}
Typing Pattern: ${wellnessContext.typingPattern || 'Unknown'}

## WORK CONTEXT
Current Task: "${wellnessContext.currentTask || 'Unknown'}"
Progress: ${wellnessContext.progressPercent || 'Unknown'}% complete
Blockers: ${wellnessContext.hasBlockers ? 'YES' : 'No'}

## YOUR TASK
Provide a wellness brief in this EXACT JSON format:
{
  "wellnessStatus": {
    "fatigueLevel": "low|medium|high|critical",
    "riskFactors": ["Specific factors detected"],
    "productivityImpact": "How fatigue is affecting their work"
  },
  "breakRecommendation": {
    "urgency": "suggested|recommended|strongly recommended|required",
    "type": "micro|short|long",
    "duration": "e.g., 5 minutes",
    "message": "Friendly, gentle suggestion text"
  },
  "activity": {
    "title": "Name of the activity",
    "description": "Step-by-step what to do",
    "physicalFocus": "eyes|wrists|back|full body",
    "duration": "Minutes"
  },
  "returnPlan": {
    "whenToReturn": "Specific time or condition",
    "whatToExpect": "What will be waiting when they get back",
    "contextPreservation": "How their work state is saved"
  },
  "productivityTip": "One tip for working better when they return"
}`,

      outputFormat: 'json',
      priority: wellnessContext.sessionLengthHours > 6 ? 9 : (wellnessContext.sessionLengthHours > 4 ? 7 : 5)
    };
  },

  /**
   * SCENARIO: Daily morning brief
   * Trigger: First activity of the day, morning time window
   */
  morningBrief: (context) => {
    const yesterdayContext = context.yesterdayContext || {};
    const todayContext = context.todayContext || {};
    
    return {
      id: `morning-${uuidv4()}`,
      scenario: SCENARIOS.MORNING_BRIEF,
      confidence: 0.9,
      systemPrompt: `You are a productivity assistant preparing a morning brief.
Your goal is to help the developer start their day with clarity and focus.

CRITICAL RULES:
1. Recap yesterday in ONE sentence - be specific about what they did
2. Give exactly 3 priorities for today - actionable, specific tasks
3. Suggest ONE tool/resource that would actually help their current work
4. Warn about ONE thing to watch out for (based on yesterday's blockers)

NEVER say:
- "Have a productive day"
- "Review your goals"
- Generic motivational quotes

ALWAYS provide:
- Specific reference to yesterday's work (files, projects)
- Numbered priorities with clear outcomes
- A concrete tool suggestion with why it helps
- A specific warning based on their patterns`,

      userPrompt: `## YESTERDAY'S CONTEXT
Summary: ${yesterdayContext.summary || 'No data'}
Files Worked On: ${(yesterdayContext.files || []).join(', ') || 'None tracked'}
Websites Visited: ${(yesterdayContext.websites || []).slice(0, 5).join(', ') || 'None tracked'}
Top Applications: ${(yesterdayContext.applications || []).join(', ') || 'Unknown'}
Blockers Encountered: ${(yesterdayContext.blockers || []).join(', ') || 'None recorded'}
Commits Made: ${(yesterdayContext.commits || []).length || 0}

## TODAY'S CONTEXT
Open TODOs: ${(todayContext.todos || []).join(', ') || 'None'}
Scheduled Meetings: ${(todayContext.meetings || []).join(', ') || 'None'}
Pending PRs/Reviews: ${(todayContext.pendingReviews || []).length || 0}
Goals: ${(todayContext.goals || []).map(g => g.title).join(', ') || 'None set'}

## NEWS & EXTERNAL CONTEXT
${(todayContext.relevantNews || []).map(n => `- ${n.title}`).join('\n') || 'No relevant news'}

## YOUR TASK
Provide a morning brief in this EXACT JSON format:
{
  "greeting": "Personalized greeting with their name/time",
  "yesterdayRecap": {
    "oneSentence": "ONE specific sentence about what they did",
    "keyAccomplishment": "The main thing they achieved",
    "unfinished": "What they left incomplete"
  },
  "todayPriorities": [
    {
      "rank": 1,
      "task": "Specific actionable task",
      "why": "Why this matters today",
      "estimatedTime": "Time estimate",
      "successCriteria": "How they'll know it's done"
    },
    {
      "rank": 2,
      "task": "Specific actionable task",
      "why": "Why this matters today",
      "estimatedTime": "Time estimate",
      "successCriteria": "How they'll know it's done"
    },
    {
      "rank": 3,
      "task": "Specific actionable task",
      "why": "Why this matters today",
      "estimatedTime": "Time estimate",
      "successCriteria": "How they'll know it's done"
    }
  ],
  "toolSuggestion": {
    "name": "Specific tool/resource",
    "description": "What it does",
    "whyToday": "Why it helps with today's priorities",
    "link": "URL if applicable"
  },
  "watchOutFor": {
    "risk": "Specific thing to avoid",
    "basedOn": "What from yesterday suggests this",
    "mitigation": "How to prevent it"
  },
  "quickWin": {
    "task": "Something they can complete in 15 min",
    "impact": "Why it feels good to do this"
  }
}`,

      outputFormat: 'json',
      priority: 7
    };
  },

  /**
   * SCENARIO: Repetitive pattern detected
   * Trigger: User doing same action repeatedly, potential for automation
   */
  patternInsight: (context) => {
    const patternContext = context.patternContext || {};
    
    return {
      id: `pattern-${uuidv4()}`,
      scenario: SCENARIOS.REPETITIVE_PATTERN,
      confidence: calculatePatternConfidence(context),
      systemPrompt: `You are a workflow optimization expert.
Your goal is to help developers identify repetitive patterns and suggest concrete automation or workflow improvements.

CRITICAL RULES:
1. Name the specific pattern you've observed
2. Quantify the time being wasted
3. Provide EITHER an automation suggestion OR a better workflow
4. Give actual code/commands they can use
5. Show the time savings calculation

NEVER say:
- "You might want to automate this"
- "Consider a better approach"
- "There are tools for this"

ALWAYS provide:
- Clear observation of what they're doing repeatedly
- Specific automation script or workflow change
- Exact time/cost of current approach vs suggested approach
- Step-by-step implementation instructions`,

      userPrompt: `## PATTERN CONTEXT
Pattern Detected: "${patternContext.patternName || 'Unknown pattern'}"
Frequency: ${patternContext.frequency || 'Unknown'} times per ${patternContext.timeframe || 'hour'}
Time Wasted: ~${patternContext.estimatedTimeWasted || 'Unknown'} minutes per day
Applications Involved: ${(patternContext.applications || []).join(', ') || 'Unknown'}

## ACTIVITY LOG (Recent repetitive actions)
${(patternContext.recentActions || []).map((a, i) => `${i + 1}. ${a}`).join('\n') || 'No specific actions tracked'}

## CURRENT WORKFLOW
Current Steps:
${(patternContext.currentSteps || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Unknown'}

Files/Commands Repeated:
${(patternContext.repeatedItems || []).map(i => `- ${i}`).join('\n') || 'None tracked'}

## YOUR TASK
Provide a pattern insight brief in this EXACT JSON format:
{
  "pattern": {
    "name": "Descriptive name for this pattern",
    "description": "What they're doing repeatedly",
    "frequency": "How often",
    "confidence": "high|medium|low"
  },
  "impact": {
    "timePerDay": "X minutes",
    "timePerWeek": "X hours",
    "contextSwitches": "How many interruptions this causes",
    "frustrationLevel": "low|medium|high"
  },
  "solution": {
    "type": "automation|workflow|tool",
    "title": "Name of the solution",
    "description": "What it does",
    "implementation": {
      "difficulty": "easy|medium|hard",
      "timeToImplement": "e.g., 15 minutes",
      "steps": [
        "Step 1: specific action",
        "Step 2: specific action"
      ]
    },
    "codeExample": "Actual script, alias, or config they can use"
  },
  "roi": {
    "setupTime": "Time to implement",
    "dailySavings": "Time saved per day",
    "breakEven": "When they recover the setup time",
    "annualValue": "Estimated hours saved per year"
  },
  "alternative": {
    "ifNotAutomation": "Alternative workflow improvement",
    "quickFix": "Something they can do right now"
  }
}`,

      outputFormat: 'json',
      priority: patternContext.estimatedTimeWasted > 30 ? 8 : 6
    };
  },

  /**
   * SCENARIO: User in deep focus mode
   * Trigger: Sustained work on single task >30min, minimal context switching
   */
  deepFocus: (context) => {
    const focusContext = context.deepFocusContext || {};
    
    return {
      id: `focus-${uuidv4()}`,
      scenario: SCENARIOS.DEEP_FOCUS,
      confidence: calculateDeepFocusConfidence(context),
      systemPrompt: `You are a productivity assistant supporting deep work.
Your goal is to protect and enhance the developer's flow state.

CRITICAL RULES:
1. DO NOT interrupt unless critical
2. If suggesting anything, make it enhance their current flow
3. Offer to handle distractions for them
4. Suggest when to take a strategic break
5. Be minimal - they don't want to be bothered

NEVER:
- Break their concentration with non-critical info
- Suggest unrelated tasks
- Use chatty language

ALWAYS:
- Respect their focus
- Offer protection from interruptions
- Suggest flow-enhancing resources only`,

      userPrompt: `## DEEP FOCUS CONTEXT
Focus Duration: ${focusContext.durationMinutes || 'Unknown'} minutes
Current Task: "${focusContext.currentTask || 'Unknown'}"
Progress: ${focusContext.progressPercent || 'Unknown'}%
Distractions Blocked: ${focusContext.blockedDistractions || 0}
Applications Used: ${(focusContext.applications || []).join(', ') || 'Unknown'}

## FLOW STATE INDICATORS
Typing Rhythm: ${focusContext.typingRhythm || 'Unknown'}
Tab Switches (last 10 min): ${focusContext.tabSwitches || 0}
Scroll Activity: ${focusContext.scrollActivity || 'Unknown'}

## YOUR TASK
Provide a deep focus brief in this EXACT JSON format:
{
  "flowStatus": {
    "state": "in_flow|deep_flow|at_risk",
    "duration": "Time in current flow",
    "quality": "high|medium|low"
  },
  "protection": {
    "suggestion": "How to protect this flow state",
    "notifications": "What to silence/ignore",
    "autoActions": ["Things assistant can handle for them"]
  },
  "enhancement": {
    "suggestedResource": "Optional: one thing that might help",
    "whyHelpful": "Brief reason",
    "deliverWhen": "now|on_break|after_task"
  },
  "breakStrategy": {
    "suggestBreakAt": "When to take a strategic break",
    "breakDuration": "How long",
    "rationale": "Why this timing"
  },
  "message": "Brief supportive message (optional)"
}`,

      outputFormat: 'json',
      priority: 3 // Low priority - only show if explicitly requested
    };
  },

  /**
   * SCENARIO: Code review opportunity
   * Trigger: User just finished code, been working on same file >1hr
   */
  codeReviewOpportunity: (context) => {
    const codeContext = context.codeContext || {};
    
    return {
      id: `review-${uuidv4()}`,
      scenario: SCENARIOS.CODE_REVIEW_OPPORTUNITY,
      confidence: calculateReviewConfidence(context),
      systemPrompt: `You are a code review assistant.
Your goal is to suggest specific improvements to code the developer just wrote.

CRITICAL RULES:
1. Reference SPECIFIC lines or functions
2. Suggest concrete improvements with actual code
3. Prioritize by impact (security > performance > style)
4. Explain WHY each suggestion matters
5. Be respectful of their time

NEVER say:
- "Consider improving your code"
- "You might want to refactor"
- Vague style suggestions

ALWAYS provide:
- Specific file and line references
- Before/after code examples
- Impact assessment of each issue`,

      userPrompt: `## CODE CONTEXT
Files Recently Modified: ${(codeContext.recentFiles || []).join(', ') || 'Unknown'}
Language: ${codeContext.language || 'Unknown'}
Lines Changed: ${codeContext.linesChanged || 'Unknown'}
Time Spent: ${codeContext.timeSpent || 'Unknown'} minutes

## CODE SNIPPET (if available)
\`\`\`${codeContext.language || 'javascript'}
${codeContext.codeSnippet || 'No code available'}
\`\`\`

## PATTERNS DETECTED
${(codeContext.detectedPatterns || []).map(p => `- ${p}`).join('\n') || 'No patterns analyzed'}

## YOUR TASK
Provide a code review brief in this EXACT JSON format:
{
  "reviewSummary": {
    "filesAnalyzed": ["List of files"],
    "overallQuality": "excellent|good|needs_improvement",
    "issueCount": {
      "critical": 0,
      "warning": 0,
      "suggestion": 0
    }
  },
  "issues": [
    {
      "severity": "critical|warning|suggestion",
      "file": "filename.js",
      "line": 42,
      "title": "Brief issue description",
      "description": "Detailed explanation",
      "currentCode": "The problematic code",
      "suggestedCode": "Improved version",
      "why": "Why this matters",
      "impact": "What could go wrong if not fixed"
    }
  ],
  "positiveFindings": [
    {
      "aspect": "What they did well",
      "description": "Why it's good"
    }
  ],
  "quickWins": [
    {
      "action": "Easy improvement",
      "time": "How long it takes",
      "benefit": "What they gain"
    }
  ]
}`,

      outputFormat: 'json',
      priority: 5
    };
  },

  /**
   * SCENARIO: Learning moment detected
   * Trigger: User researching new topic, visiting docs/tutorials
   */
  learningMoment: (context) => {
    const learningContext = context.learningContext || {};
    
    return {
      id: `learning-${uuidv4()}`,
      scenario: SCENARIOS.LEARNING_MOMENT,
      confidence: calculateLearningConfidence(context),
      systemPrompt: `You are a learning assistant identifying opportunities for skill development.
Your goal is to help developers learn efficiently while they're actively interested.

CRITICAL RULES:
1. Identify the specific topic they're trying to learn
2. Suggest the BEST single resource for their level
3. Give a concrete exercise to practice
4. Connect to their current work if possible
5. Don't overwhelm - one good resource beats ten mediocre ones

NEVER say:
- "You should learn more about this"
- "Check out these resources"
- Generic learning advice

ALWAYS provide:
- Specific topic identification
- One high-quality resource recommendation
- A hands-on exercise
- Connection to their current project`,

      userPrompt: `## LEARNING CONTEXT
Topic Being Researched: "${learningContext.topic || 'Unknown'}"
Resources Visited: ${(learningContext.resources || []).join(', ') || 'None tracked'}
Time Spent: ${learningContext.timeSpent || 'Unknown'} minutes
Related Project: "${learningContext.relatedProject || 'Unknown'}"

## KNOWLEDGE ASSESSMENT
Current Level: ${learningContext.estimatedLevel || 'unknown'}
Prerequisites Known: ${(learningContext.knownPrerequisites || []).join(', ') || 'Unknown'}
Gaps Detected: ${(learningContext.knowledgeGaps || []).join(', ') || 'None identified'}

## YOUR TASK
Provide a learning brief in this EXACT JSON format:
{
  "learningOpportunity": {
    "topic": "Specific topic being learned",
    "relevance": "Why this matters for their current work",
    "urgency": "immediate|this_week|someday"
  },
  "recommendedResource": {
    "type": "documentation|tutorial|video|article|book",
    "title": "Specific resource name",
    "url": "Direct link",
    "description": "Why this is the best resource for them",
    "timeRequired": "Reading/working time",
    "level": "beginner|intermediate|advanced"
  },
  "practiceExercise": {
    "title": "Name of exercise",
    "description": "What to do",
    "starterCode": "Optional starting point",
    "expectedOutcome": "What they'll learn",
    "timeEstimate": "How long"
  },
  "application": {
    "howToUseNow": "How to apply this to current project",
    "implementationSpot": "Where in their code this fits",
    "migrationPath": "How to gradually adopt"
  },
  "nextSteps": ["Specific follow-up actions"]
}`,

      outputFormat: 'json',
      priority: 6
    };
  },

  /**
   * SCENARIO: Debugging marathon detected
   * Trigger: Extended debugging session, many breakpoints, log statements
   */
  debuggingMarathon: (context) => {
    const debugContext = context.debuggingContext || {};
    
    return {
      id: `debug-${uuidv4()}`,
      scenario: SCENARIOS.DEBUGGING_MARATHON,
      confidence: calculateDebugMarathonConfidence(context),
      systemPrompt: `You are a debugging strategy coach.
Your goal is to help developers break out of ineffective debugging loops.

CRITICAL RULES:
1. Identify if they're in a "debugging loop" (trying same things repeatedly)
2. Suggest a systematic debugging approach
3. Provide specific debugging commands or techniques
4. Suggest when to ask for help
5. Be empathetic - debugging is frustrating

NEVER say:
- "Keep trying"
- "You'll figure it out"
- "Check the logs"

ALWAYS provide:
- Recognition of their debugging effort
- A different approach to try
- Specific commands or techniques
- Clear "call for help" threshold`,

      userPrompt: `## DEBUGGING CONTEXT
Issue: "${debugContext.issue || 'Unknown'}"
Time Debugging: ${debugContext.duration || 'Unknown'} minutes
Approaches Tried: ${(debugContext.approaches || []).join(', ') || 'None recorded'}
Breakpoints Set: ${debugContext.breakpointCount || 0}
Logs Added: ${debugContext.logCount || 0}
Files Modified: ${(debugContext.filesTouched || []).join(', ') || 'Unknown'}

## DEBUGGING LOOP DETECTION
Same Action Repeated: ${debugContext.repeatedAction ? 'YES - ' + debugContext.repeatedAction : 'No'}
Last Error Message: ${debugContext.lastError || 'Unknown'}
Code Changes: ${debugContext.codeChanges || 0} modifications

## YOUR TASK
Provide a debugging strategy brief in this EXACT JSON format:
{
  "situation": {
    "type": "debugging_loop|fresh_issue|complex_bug",
    "duration": "Time spent",
    "riskLevel": "low|medium|high|frustrated"
  },
  "freshApproach": {
    "technique": "Name of debugging technique",
    "description": "How to apply it to this situation",
    "command": "Specific command to run",
    "expectedResult": "What to look for"
  },
  "systematicPlan": [
    {
      "step": 1,
      "action": "Specific action",
      "purpose": "Why this helps"
    }
  ],
  "resources": [
    {
      "type": "documentation|tool|person",
      "what": "What to check",
      "link": "URL if applicable"
    }
  ],
  "whenToAskForHelp": {
    "threshold": "When to stop debugging alone",
    "who": "Who to ask",
    "whatToPrepare": "Information to gather first"
  },
  "encouragement": "Brief empathetic message"
}`,

      outputFormat: 'json',
      priority: debugContext.duration > 60 ? 9 : 7
    };
  },

  /**
   * SCENARIO: Meeting preparation
   * Trigger: Calendar event approaching, related work detected
   */
  meetingPrep: (context) => {
    const meetingContext = context.meetingContext || {};
    
    return {
      id: `meeting-${uuidv4()}`,
      scenario: SCENARIOS.MEETING_PREP,
      confidence: calculateMeetingPrepConfidence(context),
      systemPrompt: `You are a meeting preparation assistant.
Your goal is to help developers prepare for upcoming meetings efficiently.

CRITICAL RULES:
1. Identify the meeting type and purpose
2. List specific preparation items based on their recent work
3. Suggest what to review or prepare
4. Estimate preparation time
5. Be realistic about what they can do

NEVER say:
- "Prepare for your meeting"
- "Review the agenda"
- Generic prep advice

ALWAYS provide:
- Specific prep items based on their recent work
- What they should review
- Time estimate
- What to bring/share`,

      userPrompt: `## MEETING CONTEXT
Meeting: "${meetingContext.title || 'Unknown'}"
Type: ${meetingContext.type || 'Unknown'}
Time: ${meetingContext.startTime || 'Unknown'}
Duration: ${meetingContext.duration || 'Unknown'} minutes
Attendees: ${(meetingContext.attendees || []).join(', ') || 'Unknown'}

## RELEVANT WORK
Recent Commits: ${(meetingContext.relatedCommits || []).join(', ') || 'None'}
Files Worked On: ${(meetingContext.relatedFiles || []).join(', ') || 'None'}
Issues/PRs: ${(meetingContext.relatedIssues || []).join(', ') || 'None'}

## YOUR TASK
Provide a meeting prep brief in this EXACT JSON format:
{
  "meeting": {
    "title": "Meeting name",
    "type": "standup|review|planning|1on1|other",
    "startsIn": "Time until meeting",
    "requiredPrep": "none|minimal|significant"
  },
  "preparation": {
    "items": [
      {
        "task": "Specific prep item",
        "why": "Why this matters",
        "time": "How long",
        "priority": "required|recommended|optional"
      }
    ],
    "totalTime": "Total prep time needed"
  },
  "talkingPoints": [
    {
      "topic": "What to discuss",
      "basedOn": "Their recent work",
      "suggestedFraming": "How to present it"
    }
  ],
  "questionsToAsk": ["Specific questions they should ask"],
  "blockersToRaise": ["Issues to bring up"],
  "quickPrep": "If they only have 5 minutes, what to do"
}`,

      outputFormat: 'json',
      priority: meetingContext.startsInMinutes < 15 ? 8 : 5
    };
  }
};

// ============================================
// CONFIDENCE CALCULATION HELPERS
// ============================================

function calculateStuckConfidence(context) {
  let confidence = 0.5;
  const errorContext = context.errorContext || {};
  
  if (errorContext.durationMinutes > 30) confidence += 0.2;
  if (errorContext.errorPattern) confidence += 0.15;
  if (errorContext.codeSnippet) confidence += 0.1;
  if (errorContext.stackOverflowVisits > 0) confidence += 0.05;
  
  return Math.min(0.95, confidence);
}

function calculateFocusConfidence(context) {
  let confidence = 0.5;
  const focusContext = context.focusContext || {};
  
  if (focusContext.switchCount > 5) confidence += 0.2;
  if (focusContext.timeAwayMinutes > 10) confidence += 0.15;
  if (context.previousFocus?.task) confidence += 0.1;
  
  return Math.min(0.95, confidence);
}

function calculateBurnoutConfidence(context) {
  let confidence = 0.4;
  const wellnessContext = context.wellnessContext || {};
  
  if (wellnessContext.sessionLengthHours > 4) confidence += 0.2;
  if (wellnessContext.minutesSinceBreak > 120) confidence += 0.15;
  if ((wellnessContext.indicators || []).length > 2) confidence += 0.1;
  if (wellnessContext.errorRate > 0.5) confidence += 0.1;
  
  return Math.min(0.9, confidence);
}

function calculatePatternConfidence(context) {
  let confidence = 0.5;
  const patternContext = context.patternContext || {};
  
  if (patternContext.frequency > 5) confidence += 0.2;
  if (patternContext.estimatedTimeWasted > 15) confidence += 0.15;
  if ((patternContext.currentSteps || []).length > 3) confidence += 0.1;
  
  return Math.min(0.9, confidence);
}

function calculateDeepFocusConfidence(context) {
  let confidence = 0.5;
  const focusContext = context.deepFocusContext || {};
  
  if (focusContext.durationMinutes > 30) confidence += 0.2;
  if (focusContext.tabSwitches === 0) confidence += 0.15;
  if (focusContext.progressPercent > 20) confidence += 0.1;
  
  return Math.min(0.9, confidence);
}

function calculateReviewConfidence(context) {
  let confidence = 0.4;
  const codeContext = context.codeContext || {};
  
  if (codeContext.timeSpent > 30) confidence += 0.2;
  if (codeContext.linesChanged > 10) confidence += 0.15;
  if (codeContext.codeSnippet) confidence += 0.1;
  
  return Math.min(0.85, confidence);
}

function calculateLearningConfidence(context) {
  let confidence = 0.5;
  const learningContext = context.learningContext || {};
  
  if (learningContext.topic) confidence += 0.2;
  if ((learningContext.resources || []).length > 2) confidence += 0.15;
  if (learningContext.timeSpent > 15) confidence += 0.1;
  
  return Math.min(0.85, confidence);
}

function calculateDebugMarathonConfidence(context) {
  let confidence = 0.5;
  const debugContext = context.debuggingContext || {};
  
  if (debugContext.duration > 30) confidence += 0.2;
  if (debugContext.repeatedAction) confidence += 0.15;
  if (debugContext.breakpointCount > 5) confidence += 0.1;
  
  return Math.min(0.9, confidence);
}

function calculateMeetingPrepConfidence(context) {
  let confidence = 0.6;
  const meetingContext = context.meetingContext || {};
  
  if (meetingContext.title) confidence += 0.2;
  if (meetingContext.startTime) confidence += 0.1;
  if (meetingContext.startsInMinutes < 60) confidence += 0.1;
  
  return Math.min(0.9, confidence);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  prompts,
  SCENARIOS,
  
  // Export confidence calculators for testing
  confidenceCalculators: {
    calculateStuckConfidence,
    calculateFocusConfidence,
    calculateBurnoutConfidence,
    calculatePatternConfidence,
    calculateDeepFocusConfidence,
    calculateReviewConfidence,
    calculateLearningConfidence,
    calculateDebugMarathonConfidence,
    calculateMeetingPrepConfidence
  }
};
