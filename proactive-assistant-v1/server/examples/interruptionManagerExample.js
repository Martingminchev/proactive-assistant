/**
 * Smart Interruption Manager - Usage Examples
 * 
 * This file demonstrates how to use the InterruptionManager service
 * to intelligently decide when and how to interrupt users.
 */

const interruptionManager = require('../services/interruptionManager');
const DismissedSuggestion = require('../models/DismissedSuggestion');

// ============================================
// EXAMPLE 1: Basic Usage - Check if we should interrupt
// ============================================
async function exampleBasicCheck() {
  console.log('\n=== Example 1: Basic Interruption Check ===\n');
  
  // Simulate user activity signals
  const signals = {
    timeOnCurrentTask: 5 * 60 * 1000,  // 5 minutes
    errorFrequency: 0.5,                // Low error rate
    backspaceRatio: 0.05,               // Normal backspacing
    typingVelocity: 80,                 // 80 chars/min
    tabSwitchRate: 1,                   // 1 tab switch/min
    idleTime: 0,                        // Not idle
    recentKeystrokes: generateKeystrokes(5 * 60 * 1000) // 5 min of keystrokes
  };
  
  // A sample suggestion we want to show
  const suggestion = {
    type: 'tip',
    title: 'Quick Code Review',
    description: 'Take a moment to review your recent changes.',
    priority: 5,
    category: 'productivity',
    keywords: ['code', 'review']
  };
  
  // Check if we should interrupt
  const decision = await interruptionManager.shouldInterrupt({
    signals,
    suggestion,
    userId: 'default'
  });
  
  console.log('Decision:', decision);
  // Expected output:
  // {
  //   should: true/false,
  //   level: 1-4,
  //   reason: '...',
  //   flowState: 'working'
  // }
}

// ============================================
// EXAMPLE 2: Detect Different Flow States
// ============================================
async function exampleFlowStates() {
  console.log('\n=== Example 2: Flow State Detection ===\n');
  
  const scenarios = [
    {
      name: 'Deep Flow (Coding)',
      signals: {
        timeOnCurrentTask: 10 * 60 * 1000,
        errorFrequency: 0.2,
        backspaceRatio: 0.03,
        typingVelocity: 120,
        tabSwitchRate: 0.5,
        idleTime: 0,
        recentKeystrokes: generateKeystrokes(10 * 60 * 1000, 'steady')
      }
    },
    {
      name: 'Stuck (Debugging)',
      signals: {
        timeOnCurrentTask: 25 * 60 * 1000,
        errorFrequency: 3,
        backspaceRatio: 0.4,
        typingVelocity: 5,
        tabSwitchRate: 2,
        idleTime: 0,
        recentKeystrokes: generateKeystrokes(25 * 60 * 1000, 'erratic')
      }
    },
    {
      name: 'Frustrated',
      signals: {
        timeOnCurrentTask: 15 * 60 * 1000,
        errorFrequency: 5,
        backspaceRatio: 0.35,
        typingVelocity: 20,
        tabSwitchRate: 8,  // High tab switching
        idleTime: 0,
        recentKeystrokes: generateKeystrokes(15 * 60 * 1000, 'slow')
      }
    },
    {
      name: 'Idle',
      signals: {
        timeOnCurrentTask: 0,
        errorFrequency: 0,
        backspaceRatio: 0,
        typingVelocity: 0,
        tabSwitchRate: 0,
        idleTime: 5 * 60 * 1000,  // 5 minutes idle
        recentKeystrokes: []
      }
    }
  ];
  
  for (const scenario of scenarios) {
    const flowState = interruptionManager.calculateFlowState(scenario.signals);
    const level = interruptionManager.getInterruptionLevel(flowState, {
      suggestion: { priority: 5, type: 'tip' }
    });
    
    console.log(`\n${scenario.name}:`);
    console.log(`  Flow State: ${flowState}`);
    console.log(`  Interruption Level: ${level}`);
    console.log(`  Should Interrupt: ${flowState !== 'deep_flow' && level > 0}`);
  }
}

// ============================================
// EXAMPLE 3: Three-Strike Rule
// ============================================
async function exampleThreeStrikeRule() {
  console.log('\n=== Example 3: Three-Strike Rule ===\n');
  
  const suggestion = {
    type: 'tip',
    title: 'Take a Break',
    description: 'You\'ve been coding for a while. Consider a short break.',
    priority: 4,
    category: 'health',
    keywords: ['break', 'health', 'wellness']
  };
  
  // Simulate 3 dismissals
  for (let i = 1; i <= 3; i++) {
    const dismissed = await interruptionManager.recordDismissal(suggestion, 'default', {
      flowState: 'working',
      interruptionLevel: 1
    });
    
    console.log(`Dismissal ${i}: count = ${dismissed.dismissalCount}`);
    
    // Check if blacklisted
    const isBlacklisted = await DismissedSuggestion.isBlacklisted(suggestion, 'default');
    console.log(`  Blacklisted: ${isBlacklisted}`);
  }
  
  // Try to show the suggestion again - should be blocked
  console.log('\nTrying to show suggestion again after 3 dismissals...');
  const decision = await interruptionManager.shouldInterrupt({
    signals: { idleTime: 2 * 60 * 1000 },
    suggestion,
    userId: 'default'
  });
  
  console.log('Decision:', decision);
  console.log('Expected: should = false (blacklisted)');
}

// ============================================
// EXAMPLE 4: Focus Mode
// ============================================
async function exampleFocusMode() {
  console.log('\n=== Example 4: Focus Mode ===\n');
  
  // Enable focus mode
  await interruptionManager.enableFocusMode();
  console.log('Focus mode enabled');
  
  // Try to interrupt - should be blocked
  const decision = await interruptionManager.shouldInterrupt({
    signals: { idleTime: 5 * 60 * 1000 },
    suggestion: { type: 'tip', priority: 5 },
    userId: 'default'
  });
  
  console.log('Decision with focus mode ON:', decision);
  
  // Disable focus mode
  await interruptionManager.disableFocusMode();
  console.log('Focus mode disabled');
  
  // Try again - might be allowed
  const decision2 = await interruptionManager.shouldInterrupt({
    signals: { idleTime: 5 * 60 * 1000 },
    suggestion: { type: 'tip', priority: 5 },
    userId: 'default'
  });
  
  console.log('Decision with focus mode OFF:', decision2);
}

// ============================================
// EXAMPLE 5: Filter Suggestions by Appropriateness
// ============================================
async function exampleFilterSuggestions() {
  console.log('\n=== Example 5: Filter Suggestions by Appropriateness ===\n');
  
  const suggestions = [
    {
      type: 'tip',
      title: 'Stay Hydrated',
      category: 'health',
      priority: 3
    },
    {
      type: 'warning',
      title: 'Error Detected',
      category: 'debugging',
      priority: 9
    },
    {
      type: 'action',
      title: 'Fix This Issue',
      category: 'code_quality',
      priority: 8
    },
    {
      type: 'tip',
      title: 'Learn TypeScript',
      category: 'learning',
      priority: 5
    }
  ];
  
  // Simulate being stuck on an error
  const stuckSignals = {
    timeOnCurrentTask: 25 * 60 * 1000,
    errorFrequency: 4,
    backspaceRatio: 0.35,
    typingVelocity: 8,
    tabSwitchRate: 2,
    idleTime: 0,
    recentKeystrokes: generateKeystrokes(25 * 60 * 1000, 'erratic')
  };
  
  console.log('User is STUCK - filtering suggestions:');
  const appropriate = await interruptionManager.filterAppropriateSuggestions(
    suggestions,
    stuckSignals,
    'default'
  );
  
  console.log('Appropriate suggestions:');
  appropriate.forEach(s => {
    console.log(`  - ${s.title} (level ${s._interruptionLevel})`);
  });
  
  console.log('\nFiltered out:');
  suggestions
    .filter(s => !appropriate.find(a => a.title === s.title))
    .forEach(s => {
      console.log(`  - ${s.title} (${s.category})`);
    });
}

// ============================================
// Helper: Generate simulated keystrokes
// ============================================
function generateKeystrokes(durationMs, pattern = 'steady') {
  const keystrokes = [];
  const now = Date.now();
  let interval;
  
  switch (pattern) {
    case 'steady':
      interval = 200; // 300 chars/min
      break;
    case 'slow':
      interval = 3000; // 20 chars/min
      break;
    case 'erratic':
      interval = 1000; // Average 60 chars/min with gaps
      break;
    default:
      interval = 500;
  }
  
  for (let t = 0; t < durationMs; t += interval) {
    // Add some randomness for erratic pattern
    if (pattern === 'erratic' && Math.random() > 0.7) {
      t += 10000; // Large gap
    }
    
    keystrokes.push(now - durationMs + t);
  }
  
  return keystrokes;
}

// ============================================
// Run examples
// ============================================
async function runExamples() {
  console.log('🧠 Smart Interruption Manager - Examples');
  console.log('=====================================\n');
  
  try {
    // Note: These examples require a database connection
    // Uncomment the ones you want to run:
    
    // await exampleBasicCheck();
    // await exampleFlowStates();
    // await exampleThreeStrikeRule();
    // await exampleFocusMode();
    // await exampleFilterSuggestions();
    
    console.log('\n✅ Examples completed');
  } catch (error) {
    console.error('\n❌ Error running examples:', error.message);
  }
}

// Export for use
module.exports = {
  runExamples,
  exampleBasicCheck,
  exampleFlowStates,
  exampleThreeStrikeRule,
  exampleFocusMode,
  exampleFilterSuggestions
};

// Run if executed directly
if (require.main === module) {
  runExamples();
}
