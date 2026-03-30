/**
 * ContextSummarizationService - Usage Examples
 * 
 * This file demonstrates how to use the ContextSummarizationService
 * in various scenarios.
 */

const contextService = require('./contextSummarizationService');

// ============================================
// EXAMPLE 1: Basic Context Synthesis
// ============================================

async function basicUsage() {
  console.log('=== Example 1: Basic Context Synthesis ===\n');

  try {
    // Synthesize context from Pieces OS data
    const result = await contextService.synthesizeContext();

    console.log('Context Synthesis Result:');
    console.log('------------------------');
    console.log(`Duration: ${result.metadata.duration}ms`);
    console.log(`Tokens used: ${result.metadata.tokenCount}/4000`);
    console.log(`Items processed: ${result.metadata.itemsProcessed}`);
    console.log(`Items included: ${result.metadata.itemsIncluded}`);
    console.log(`Confidence: ${(result.confidence.overall * 100).toFixed(1)}%`);
    console.log('\nDigest Structure:');
    console.log(Object.keys(result.digest));

    return result;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// ============================================
// EXAMPLE 2: Using with Pre-fetched Context
// ============================================

async function withPrefetchedContext() {
  console.log('\n=== Example 2: Using Pre-fetched Context ===\n');

  // Simulate pre-fetched context from Pieces OS
  const rawContext = {
    visionEvents: [
      {
        id: 'event-1',
        created: new Date().toISOString(),
        application: 'VS Code',
        title: 'contextSummarizationService.js - proactive-assistant',
        textContent: 'class ContextSummarizationService {',
        url: '',
        anchors: [{ fullPath: '/home/user/project/server/services/contextSummarizationService.js' }],
        tags: ['coding', 'javascript', 'node.js']
      },
      {
        id: 'event-2',
        created: new Date(Date.now() - 300000).toISOString(), // 5 min ago
        application: 'Chrome',
        title: 'MDN Web Docs - JavaScript',
        textContent: 'Array.prototype.map()',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
        anchors: [],
        tags: ['documentation', 'learning']
      }
    ],
    activities: [
      {
        id: 'act-1',
        created: new Date().toISOString(),
        application: 'VS Code',
        type: 'asset',
        rank: 8
      }
    ],
    workstreamSummaries: [
      {
        id: 'summary-1',
        created: new Date().toISOString(),
        summary: 'Working on context summarization service implementation',
        tags: ['ai', 'context', 'pieces'],
        anchors: [{ fullPath: '/home/user/project/server/services' }]
      }
    ],
    assets: [],
    conversations: [],
    anchors: [
      { fullPath: '/home/user/project/server/services/contextSummarizationService.js', created: new Date().toISOString() }
    ],
    websites: [],
    ocrAnalyses: [],
    workstreamEvents: []
  };

  // Synthesize with pre-fetched context (faster, no API calls)
  const result = await contextService.synthesizeContext(rawContext);

  console.log('Pre-fetched Context Result:');
  console.log('---------------------------');
  console.log(JSON.stringify(result.digest, null, 2));

  return result;
}

// ============================================
// EXAMPLE 3: Extracting Current Focus
// ============================================

async function extractCurrentFocus() {
  console.log('\n=== Example 3: Extracting Current Focus ===\n');

  const visionEvents = [
    {
      created: new Date().toISOString(),
      application: 'Cursor',
      title: 'apiRoutes.js - server',
      anchors: [{ fullPath: '/project/server/routes/apiRoutes.js' }],
      url: ''
    },
    {
      created: new Date(Date.now() - 60000).toISOString(),
      application: 'Cursor',
      title: 'server.js - server',
      anchors: [{ fullPath: '/project/server/server.js' }],
      url: ''
    },
    {
      created: new Date(Date.now() - 120000).toISOString(),
      application: 'Chrome',
      title: 'Express.js Routing',
      url: 'https://expressjs.com/en/guide/routing.html',
      anchors: []
    }
  ];

  const activities = [
    { created: new Date().toISOString(), application: 'Cursor', type: 'asset' }
  ];

  const focus = contextService.inferCurrentFocus(visionEvents, activities);

  console.log('Current Focus Inference:');
  console.log('------------------------');
  console.log(`App: ${focus.app}`);
  console.log(`File: ${focus.file}`);
  console.log(`Task: ${focus.task}`);
  console.log(`Confidence: ${(focus.confidence * 100).toFixed(1)}%`);
  console.log('\nSupporting Data:');
  console.log(`Recent Files: ${focus.supportingData.recentFiles.join(', ')}`);
  console.log(`Recent URLs: ${focus.supportingData.recentUrls.join(', ')}`);

  return focus;
}

// ============================================
// EXAMPLE 4: Extracting Work Patterns
// ============================================

async function extractWorkPatterns() {
  console.log('\n=== Example 4: Extracting Work Patterns ===\n');

  const summaries = [
    {
      created: new Date().toISOString(),
      summary: 'Debugging authentication middleware issue',
      tags: ['authentication', 'middleware', 'bug-fix']
    },
    {
      created: new Date(Date.now() - 3600000).toISOString(),
      summary: 'Implementing JWT token validation',
      tags: ['jwt', 'authentication', 'security']
    },
    {
      created: new Date(Date.now() - 7200000).toISOString(),
      summary: 'Setting up user session management',
      tags: ['sessions', 'authentication', 'redis']
    }
  ];

  const activities = [
    { created: new Date().toISOString(), type: 'asset' },
    { created: new Date(Date.now() - 1800000).toISOString(), type: 'interaction' },
    { created: new Date(Date.now() - 3600000).toISOString(), type: 'asset' }
  ];

  const patterns = contextService.extractWorkPatterns(summaries, activities);

  console.log('Work Pattern Analysis:');
  console.log('---------------------');
  console.log('Topics:', patterns.topics.map(t => `${t.name}(${t.frequency})`).join(', '));
  console.log('Projects:', patterns.projects.map(p => p.name).join(', ') || 'None detected');
  console.log('Blockers:', patterns.blockers.length);
  console.log('Time of Day:', patterns.patterns.timeOfDay?.averageHour);
  console.log('Focus Duration:', patterns.patterns.focusDuration?.category);

  return patterns;
}

// ============================================
// EXAMPLE 5: Building AI-Optimized Prompt
// ============================================

async function buildAIPrompt() {
  console.log('\n=== Example 5: Building AI-Optimized Prompt ===\n');

  // First synthesize context
  const synthesizedContext = await contextService.synthesizeContext({
    visionEvents: [
      {
        created: new Date().toISOString(),
        application: 'VS Code',
        title: 'userController.js',
        anchors: [{ fullPath: '/project/controllers/userController.js' }],
        url: ''
      }
    ],
    activities: [],
    workstreamSummaries: [
      {
        created: new Date().toISOString(),
        summary: 'Implementing user registration endpoint',
        tags: ['api', 'users', 'authentication']
      }
    ],
    assets: [],
    conversations: [],
    anchors: [{ fullPath: '/project/controllers/userController.js' }],
    websites: [],
    ocrAnalyses: [],
    workstreamEvents: []
  });

  // Build the prompt
  const prompt = contextService.buildAIPrompt(synthesizedContext);

  console.log('AI-Optimized Prompt:');
  console.log('-------------------');
  console.log(prompt);

  return prompt;
}

// ============================================
// EXAMPLE 6: Advanced Configuration
// ============================================

async function advancedConfiguration() {
  console.log('\n=== Example 6: Advanced Configuration ===\n');

  // Create a custom instance with different settings
  const { ContextSummarizationService } = require('./contextSummarizationService');
  
  const customService = new ContextSummarizationService();
  
  // Modify configuration
  customService.config = {
    ...customService.config,
    maxTokens: 2000,              // Smaller budget
    recentWindowMs: 5 * 60000,    // 5 minute window
    maxCurrentFocusItems: 10,     // Fewer items
    blockerKeywords: [            // Custom blocker keywords
      'error', 'bug', 'fix', 'fail', 'crash',
      'deadline', 'urgent', 'critical', 'blocking'
    ]
  };

  console.log('Custom Configuration:');
  console.log('--------------------');
  console.log(`Token Budget: ${customService.config.maxTokens}`);
  console.log(`Recent Window: ${customService.config.recentWindowMs / 60000} minutes`);
  console.log(`Max Focus Items: ${customService.config.maxCurrentFocusItems}`);
  console.log(`Blocker Keywords: ${customService.config.blockerKeywords.length}`);
}

// ============================================
// EXAMPLE 7: Integration with Express Route
// ============================================

// Example Express route handler
async function expressRouteExample(req, res) {
  try {
    const contextService = require('./contextSummarizationService');
    
    // Optional: Accept filters from request
    const { includePatterns, maxTokens } = req.query;
    
    // Synthesize context
    const result = await contextService.synthesizeContext(null, {
      includePatterns: includePatterns === 'true',
      maxTokens: maxTokens ? parseInt(maxTokens) : undefined
    });

    // Return structured response
    res.json({
      success: true,
      data: {
        digest: result.digest,
        confidence: result.confidence,
        metadata: result.metadata
      },
      // Also include the formatted prompt for convenience
      prompt: contextService.buildAIPrompt(result)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ============================================
// EXAMPLE 8: Batch Processing Multiple Users
// ============================================

async function batchProcessingExample() {
  console.log('\n=== Example 8: Batch Processing ===\n');

  // Simulate multiple context sources
  const contexts = [
    { name: 'Morning Session', timestamp: Date.now() - 3600000 },
    { name: 'Afternoon Session', timestamp: Date.now() - 1800000 },
    { name: 'Evening Session', timestamp: Date.now() }
  ];

  const results = await Promise.all(
    contexts.map(async (ctx) => {
      const result = await contextService.synthesizeContext();
      return {
        session: ctx.name,
        confidence: result.confidence.overall,
        focus: result.digest.CURRENT_FOCUS?.primaryApplication
      };
    })
  );

  console.log('Batch Results:');
  console.log('-------------');
  results.forEach(r => {
    console.log(`${r.session}: ${r.focus} (${(r.confidence * 100).toFixed(1)}% confidence)`);
  });
}

// ============================================
// RUN EXAMPLES
// ============================================

async function runAllExamples() {
  console.log('ContextSummarizationService Examples');
  console.log('====================================\n');

  // Run examples that don't require Pieces OS connection
  await withPrefetchedContext();
  await extractCurrentFocus();
  await extractWorkPatterns();
  await buildAIPrompt();
  await advancedConfiguration();
  await batchProcessingExample();

  console.log('\n====================================');
  console.log('Examples completed!');
  console.log('\nNote: Examples 1 and 7 require Pieces OS to be running.');
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  basicUsage,
  withPrefetchedContext,
  extractCurrentFocus,
  extractWorkPatterns,
  buildAIPrompt,
  advancedConfiguration,
  expressRouteExample,
  batchProcessingExample,
  runAllExamples
};
