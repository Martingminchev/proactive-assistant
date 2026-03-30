/**
 * Enhanced Prompts Usage Examples
 * 
 * This file demonstrates how to use the new intelligent brief system
 * with specific, actionable prompts.
 */

const { prompts, SCENARIOS } = require('../prompts');
const intelligentBriefService = require('../services/intelligentBriefService');

// ============================================
// EXAMPLE 1: Direct Prompt Usage
// ============================================

async function example1_directPromptUsage() {
  console.log('\n=== Example 1: Direct Prompt Usage ===\n');

  // Simulate a user stuck on an error
  const stuckContext = {
    errorContext: {
      errorPattern: 'TypeError: Cannot read property \'map\' of undefined',
      durationMinutes: 35,
      codeSnippet: `
function processData(data) {
  return data.items.map(item => item.name);
}
      `,
      stackOverflowVisits: 2
    },
    activityContext: {
      openFiles: ['src/utils/dataProcessor.js', 'src/components/List.vue'],
      recentUrls: ['https://stackoverflow.com/search?q=javascript+map+undefined', 'https://developer.mozilla.org'],
      recentActions: ['Opened dataProcessor.js', 'Added console.log', 'Searched StackOverflow', 'Opened browser', 'Returned to IDE']
    },
    currentFile: 'src/utils/dataProcessor.js'
  };

  // Generate the prompt
  const promptConfig = prompts.stuckOnError(stuckContext);

  console.log('Generated Prompt Configuration:');
  console.log('  Scenario:', promptConfig.scenario);
  console.log('  Confidence:', (promptConfig.confidence * 100).toFixed(1) + '%');
  console.log('  Priority:', promptConfig.priority);
  console.log('  Output Format:', promptConfig.outputFormat);
  console.log('\nSystem Prompt (first 200 chars):');
  console.log(promptConfig.systemPrompt.substring(0, 200) + '...');
  console.log('\nUser Prompt (first 300 chars):');
  console.log(promptConfig.userPrompt.substring(0, 300) + '...');

  return promptConfig;
}

// ============================================
// EXAMPLE 2: Focus Recovery Scenario
// ============================================

async function example2_focusRecovery() {
  console.log('\n=== Example 2: Focus Recovery Scenario ===\n');

  const focusContext = {
    focusContext: {
      timeAwayMinutes: 25,
      currentFiles: ['src/App.js', 'package.json', 'README.md'],
      recentApps: ['Slack', 'VS Code', 'Chrome'],
      switchCount: 8
    },
    previousFocus: {
      task: 'Implementing user authentication flow',
      lastFile: 'src/auth/login.js',
      lastAction: 'Added JWT token validation',
      todos: [
        { file: 'src/auth/login.js', text: 'TODO: Add refresh token logic' },
        { file: 'src/auth/middleware.js', text: 'TODO: Handle token expiration' }
      ],
      recentCommits: ['feat: add login form validation'],
      hasUnsavedChanges: true
    }
  };

  const promptConfig = prompts.focusRecovery(focusContext);

  console.log('Focus Recovery Detected:');
  console.log('  Time Away:', focusContext.focusContext.timeAwayMinutes, 'minutes');
  console.log('  Previous Task:', focusContext.previousFocus.task);
  console.log('  Context Switches:', focusContext.focusContext.switchCount);
  console.log('  Confidence:', (promptConfig.confidence * 100).toFixed(1) + '%');
  console.log('\nTODOs Found:', focusContext.previousFocus.todos.length);
  focusContext.previousFocus.todos.forEach(todo => {
    console.log(`  - ${todo.file}: ${todo.text}`);
  });

  return promptConfig;
}

// ============================================
// EXAMPLE 3: Pattern Detection
// ============================================

async function example3_patternDetection() {
  console.log('\n=== Example 3: Repetitive Pattern Detection ===\n');

  const patternContext = {
    patternContext: {
      patternName: 'Manual API endpoint testing',
      frequency: 12,
      timeframe: 'hour',
      estimatedTimeWasted: 45,
      applications: ['Postman', 'VS Code', 'Terminal'],
      currentSteps: [
        'Switch to Postman',
        'Find the request',
        'Update the payload',
        'Send request',
        'Check response',
        'Switch back to VS Code',
        'Make code changes',
        'Repeat'
      ],
      recentActions: [
        'Opened Postman',
        'Sent POST request',
        'Modified payload',
        'Sent again',
        'Checked console',
        'Back to VS Code'
      ]
    }
  };

  const promptConfig = prompts.patternInsight(patternContext);

  console.log('Pattern Detected:', patternContext.patternContext.patternName);
  console.log('  Frequency:', patternContext.patternContext.frequency, 'times per hour');
  console.log('  Time Wasted:', patternContext.patternContext.estimatedTimeWasted, 'minutes/day');
  console.log('  Confidence:', (promptConfig.confidence * 100).toFixed(1) + '%');
  console.log('\nProposed Solution Will Include:');
  console.log('  - Shell script or VS Code task for automation');
  console.log('  - ROI calculation');
  console.log('  - Step-by-step implementation');

  return promptConfig;
}

// ============================================
// EXAMPLE 4: Wellness Check
// ============================================

async function example4_wellnessCheck() {
  console.log('\n=== Example 4: Wellness/Burnout Detection ===\n');

  const wellnessContext = {
    wellnessContext: {
      sessionLengthHours: 5.5,
      minutesSinceBreak: 150,
      currentTime: '11:30 PM',
      indicators: ['long_session', 'high_error_rate', 'late_hours'],
      errorRate: 0.7,
      typingPattern: 'erratic',
      currentTask: 'Debugging production issue',
      progressPercent: 30,
      hasBlockers: true
    }
  };

  const promptConfig = prompts.wellnessCheck(wellnessContext);

  console.log('Wellness Check Triggered:');
  console.log('  Session Length:', wellnessContext.wellnessContext.sessionLengthHours, 'hours');
  console.log('  Time Since Break:', wellnessContext.wellnessContext.minutesSinceBreak, 'minutes');
  console.log('  Current Time:', wellnessContext.wellnessContext.currentTime);
  console.log('  Stress Indicators:', wellnessContext.wellnessContext.indicators.join(', '));
  console.log('  Error Rate:', (wellnessContext.wellnessContext.errorRate * 100).toFixed(0) + '%');
  console.log('  Priority:', promptConfig.priority, '(High due to session length)');

  return promptConfig;
}

// ============================================
// EXAMPLE 5: Morning Brief
// ============================================

async function example5_morningBrief() {
  console.log('\n=== Example 5: Morning Brief ===\n');

  const morningContext = {
    yesterdayContext: {
      summary: 'Worked on authentication system and API integration',
      files: ['src/auth/login.js', 'src/auth/middleware.js', 'src/api/client.js'],
      websites: ['JWT.io', 'Axios documentation', 'StackOverflow'],
      applications: ['VS Code', 'Chrome', 'Terminal'],
      blockers: ['CORS issue with API calls', 'Token refresh logic incomplete'],
      commits: ['feat: add login form', 'fix: handle auth errors']
    },
    todayContext: {
      todos: ['Complete token refresh', 'Write auth tests', 'Review PR #234'],
      meetings: ['10:00 AM Standup', '2:00 PM Code Review'],
      pendingReviews: 2,
      goals: [
        { title: 'Complete authentication feature', priority: 5 },
        { title: 'Improve test coverage', priority: 3 }
      ]
    }
  };

  const promptConfig = prompts.morningBrief(morningContext);

  console.log('Morning Brief Generated:');
  console.log('  Yesterday:', morningContext.yesterdayContext.summary);
  console.log('  Files Worked:', morningContext.yesterdayContext.files.length);
  console.log('  Open TODOs:', morningContext.todayContext.todos.length);
  console.log('  Meetings Today:', morningContext.todayContext.meetings.length);
  console.log('  Blockers from Yesterday:', morningContext.yesterdayContext.blockers.length);

  return promptConfig;
}

// ============================================
// EXAMPLE 6: Using IntelligentBriefService
// ============================================

async function example6_intelligentBriefService() {
  console.log('\n=== Example 6: Intelligent Brief Service ===\n');

  // Show service status
  const status = intelligentBriefService.getStatus();
  console.log('Service Status:');
  console.log('  Available Scenarios:', status.availableScenarios.length);
  console.log('  Scenarios:', status.availableScenarios.join(', '));

  // Demonstrate manual scenario triggering
  console.log('\nManually Triggering Scenarios:');
  
  const scenarios = [
    SCENARIOS.STUCK_ON_ERROR,
    SCENARIOS.CONTEXT_SWITCHING,
    SCENARIOS.BURNOUT_RISK
  ];

  for (const scenario of scenarios) {
    console.log(`\n  Triggering: ${scenario}`);
    try {
      // Note: This would normally call the AI, but for demo we just show the prompt
      const mockBrief = await intelligentBriefService.triggerScenario(scenario);
      console.log(`  ✓ Generated brief with ${Object.keys(mockBrief).length} fields`);
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
    }
  }
}

// ============================================
// EXAMPLE 7: Confidence Score Calculation
// ============================================

async function example7_confidenceScores() {
  console.log('\n=== Example 7: Confidence Score Calculation ===\n');

  const { confidenceCalculators } = require('../prompts');

  // Test different contexts and their confidence scores
  const testCases = [
    {
      name: 'Stuck - Minimal Context',
      context: { errorContext: { durationMinutes: 15 } },
      calculator: confidenceCalculators.calculateStuckConfidence
    },
    {
      name: 'Stuck - Strong Context',
      context: { 
        errorContext: { 
          durationMinutes: 45, 
          errorPattern: 'NullPointerException',
          codeSnippet: 'const x = data.value;',
          stackOverflowVisits: 2 
        } 
      },
      calculator: confidenceCalculators.calculateStuckConfidence
    },
    {
      name: 'Burnout - Low Risk',
      context: { wellnessContext: { sessionLengthHours: 2, minutesSinceBreak: 30 } },
      calculator: confidenceCalculators.calculateBurnoutConfidence
    },
    {
      name: 'Burnout - High Risk',
      context: { 
        wellnessContext: { 
          sessionLengthHours: 7, 
          minutesSinceBreak: 180,
          indicators: ['long_session', 'high_error_rate', 'late_hours'],
          errorRate: 0.8
        } 
      },
      calculator: confidenceCalculators.calculateBurnoutConfidence
    }
  ];

  testCases.forEach(tc => {
    const score = tc.calculator(tc.context);
    console.log(`  ${tc.name}: ${(score * 100).toFixed(1)}%`);
  });
}

// ============================================
// EXAMPLE 8: Complete Workflow
// ============================================

async function example8_completeWorkflow() {
  console.log('\n=== Example 8: Complete Workflow ===\n');

  console.log('Simulating a complete workflow:\n');

  // Step 1: Gather context (normally from Pieces)
  console.log('1. Gathering context from Pieces OS...');
  const mockContext = {
    files: [
      { name: 'api.js', fullPath: '/project/src/api.js', updated: new Date().toISOString() },
      { name: 'auth.js', fullPath: '/project/src/auth.js', updated: new Date().toISOString() }
    ],
    activities: [
      { application: 'VS Code', created: new Date().toISOString(), description: 'Editing api.js' },
      { application: 'Chrome', created: new Date(Date.now() - 60000).toISOString(), description: 'StackOverflow search' }
    ],
    errorMetrics: {
      durationMinutes: 40,
      errorPattern: '404 Not Found',
      stackOverflowVisits: 1
    }
  };
  console.log('   ✓ Context gathered');

  // Step 2: Detect scenarios
  console.log('\n2. Detecting applicable scenarios...');
  const isStuck = mockContext.errorMetrics.durationMinutes > 30;
  console.log(`   Detected: Stuck on Error (${isStuck ? 'YES' : 'NO'})`);

  // Step 3: Generate prompt
  console.log('\n3. Generating enhanced prompt...');
  const promptConfig = prompts.stuckOnError(mockContext);
  console.log(`   Scenario: ${promptConfig.scenario}`);
  console.log(`   Confidence: ${(promptConfig.confidence * 100).toFixed(1)}%`);
  console.log(`   Priority: ${promptConfig.priority}/10`);

  // Step 4: Format for actionability
  console.log('\n4. Formatting for actionability...');
  const mockAIResponse = {
    diagnosis: {
      likelyCause: 'API endpoint URL is incorrect or server is not running',
      confidence: 'high',
      reasoning: '404 errors indicate the endpoint does not exist at that URL'
    },
    solution: {
      description: 'Check the API base URL and ensure the server is running',
      codeExample: 'const baseURL = process.env.API_URL || "http://localhost:3000";',
      commandToRun: 'curl http://localhost:3000/health'
    },
    resources: [
      {
        title: 'HTTP 404 Error - MDN',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404',
        whyRelevant: 'Explains what 404 means and common causes'
      }
    ],
    nextAction: {
      action: 'Verify the server is running on port 3000',
      timeEstimate: '2 minutes',
      expectedOutcome: 'You should see a successful response from /health endpoint'
    },
    prevention: 'Add environment variable validation at app startup'
  };

  const formattedBrief = {
    title: `🐛 ${mockAIResponse.diagnosis.likelyCause.substring(0, 50)}...`,
    description: mockAIResponse.solution.description,
    type: 'blocker',
    priority: promptConfig.priority,
    actions: [
      { label: 'Try Fix', type: 'copy', payload: mockAIResponse.solution.codeExample },
      { label: 'View Docs', type: 'link', payload: mockAIResponse.resources[0].url },
      { label: 'Dismiss', type: 'dismiss' }
    ],
    metadata: {
      confidence: promptConfig.confidence,
      nextAction: mockAIResponse.nextAction
    }
  };

  console.log('   Formatted Brief:');
  console.log(`   - Title: ${formattedBrief.title}`);
  console.log(`   - Type: ${formattedBrief.type}`);
  console.log(`   - Actions: ${formattedBrief.actions.map(a => a.label).join(', ')}`);

  console.log('\n✓ Workflow complete!');
}

// ============================================
// RUN ALL EXAMPLES
// ============================================

async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Enhanced Prompts System - Usage Examples               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await example1_directPromptUsage();
    await example2_focusRecovery();
    await example3_patternDetection();
    await example4_wellnessCheck();
    await example5_morningBrief();
    await example6_intelligentBriefService();
    await example7_confidenceScores();
    await example8_completeWorkflow();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     All Examples Complete!                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n✗ Error running examples:', error.message);
    console.error(error.stack);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}

module.exports = {
  example1_directPromptUsage,
  example2_focusRecovery,
  example3_patternDetection,
  example4_wellnessCheck,
  example5_morningBrief,
  example6_intelligentBriefService,
  example7_confidenceScores,
  example8_completeWorkflow,
  runAllExamples
};
