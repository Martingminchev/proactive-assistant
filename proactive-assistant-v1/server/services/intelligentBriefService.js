/**
 * Intelligent Brief Service
 * 
 * This service:
 * 1. Detects which scenario applies to the current user context
 * 2. Selects the appropriate enhanced prompt
 * 3. Generates actionable briefs using AI
 * 4. Formats responses for maximum actionability
 * 5. Includes confidence scores and metadata
 */

const { prompts, SCENARIOS } = require('../prompts/enhancedPrompts');
const piecesCopilotService = require('./piecesCopilotService');
const aiService = require('./aiService');
const Suggestion = require('../models/Suggestion');

class IntelligentBriefService {
  constructor() {
    this.scenarioHistory = new Map(); // Track scenario history
    this.lastBriefTime = new Map(); // Track when briefs were last sent
    this.minBriefInterval = 30 * 60 * 1000; // Minimum 30 minutes between briefs of same type
  }

  /**
   * Main entry point: Analyze context and generate appropriate brief
   */
  async generateIntelligentBrief(userContext = {}) {
    console.log('\n🧠 Intelligent Brief Service: Analyzing context...\n');

    try {
      // Step 1: Gather comprehensive context from Pieces
      const piecesContext = await this.gatherPiecesContext();
      
      // Step 2: Enrich with user context
      const enrichedContext = {
        ...piecesContext,
        ...userContext,
        timestamp: new Date().toISOString()
      };

      // Step 3: Detect which scenario(s) apply
      const detectedScenarios = this.detectScenarios(enrichedContext);
      console.log(`  Detected ${detectedScenarios.length} scenarios:`, 
        detectedScenarios.map(s => s.scenario).join(', '));

      // Step 4: Select the highest priority scenario
      const selectedScenario = this.selectPriorityScenario(detectedScenarios);
      if (!selectedScenario) {
        console.log('  No applicable scenario detected');
        return null;
      }

      console.log(`  Selected scenario: ${selectedScenario.scenario} ` +
        `(confidence: ${(selectedScenario.confidence * 100).toFixed(1)}%)`);

      // Step 5: Check cooldown to avoid spamming
      if (this.isOnCooldown(selectedScenario.scenario)) {
        console.log(`  Scenario ${selectedScenario.scenario} is on cooldown`);
        return null;
      }

      // Step 6: Generate the brief using appropriate prompt
      const brief = await this.generateBrief(selectedScenario, enrichedContext);
      
      // Step 7: Format for actionability
      const formattedBrief = this.formatForActionability(brief, selectedScenario);
      
      // Step 8: Save to history and database
      this.recordBrief(selectedScenario.scenario);
      await this.saveBriefAsSuggestion(formattedBrief);

      console.log(`  ✓ Brief generated: ${formattedBrief.title}`);
      
      return formattedBrief;

    } catch (error) {
      console.error('✗ Error generating intelligent brief:', error.message);
      return this.generateFallbackBrief(userContext);
    }
  }

  /**
   * Gather context from Pieces OS
   */
  async gatherPiecesContext() {
    try {
      if (!piecesCopilotService.connected) {
        await piecesCopilotService.connect();
      }

      // Fetch key context data
      const [
        anchors,
        websites,
        activities,
        workstreamSummaries,
        visionEvents,
        conversations,
        assets
      ] = await Promise.all([
        piecesCopilotService.getAnchors(20),
        piecesCopilotService.getRecentWebsites(20),
        piecesCopilotService.getRecentActivities(50),
        piecesCopilotService.getWorkstreamSummaries(10),
        piecesCopilotService.getVisionEvents(30),
        piecesCopilotService.getConversations(5),
        piecesCopilotService.getRecentAssets(15)
      ]);

      // Extract actionable insights from raw data
      return {
        files: anchors.data || [],
        websites: websites.data || [],
        activities: activities.data || [],
        workstreamSummaries: workstreamSummaries.data || [],
        visionEvents: visionEvents.data || [],
        conversations: conversations.data || [],
        assets: assets.data || [],
        
        // Derived metrics
        activityMetrics: this.calculateActivityMetrics(activities.data),
        focusMetrics: this.calculateFocusMetrics(anchors.data, activities.data),
        errorMetrics: this.detectErrorPatterns(visionEvents.data, activities.data),
        patternMetrics: this.detectRepetitivePatterns(activities.data),
        
        // Timestamps
        lastActivity: activities.data?.[0]?.created,
        sessionStart: this.estimateSessionStart(activities.data)
      };

    } catch (error) {
      console.error('  ✗ Error gathering Pieces context:', error.message);
      return {};
    }
  }

  /**
   * Detect which scenarios apply to current context
   */
  detectScenarios(context) {
    const detected = [];

    // Scenario: STUCK_ON_ERROR
    if (this.isStuckOnError(context)) {
      detected.push({
        scenario: SCENARIOS.STUCK_ON_ERROR,
        confidence: this.calculateStuckConfidence(context),
        context: {
          errorContext: context.errorMetrics,
          activityContext: {
            openFiles: context.files?.slice(0, 5).map(f => f.fullPath || f.name),
            recentUrls: context.websites?.slice(0, 5).map(w => w.url),
            recentActions: context.activities?.slice(0, 5).map(a => a.description || 'Activity')
          },
          currentFile: context.files?.[0]?.fullPath
        }
      });
    }

    // Scenario: CONTEXT_SWITCHING
    if (this.isContextSwitching(context)) {
      detected.push({
        scenario: SCENARIOS.CONTEXT_SWITCHING,
        confidence: this.calculateContextSwitchConfidence(context),
        context: {
          focusContext: {
            timeAwayMinutes: this.calculateTimeAway(context),
            currentFiles: context.files?.slice(0, 3).map(f => f.name),
            recentApps: this.extractRecentApps(context.activities),
            switchCount: context.focusMetrics?.switchCount
          },
          previousFocus: this.getPreviousFocus(context)
        }
      });
    }

    // Scenario: BURNOUT_RISK
    if (this.isBurnoutRisk(context)) {
      detected.push({
        scenario: SCENARIOS.BURNOUT_RISK,
        confidence: this.calculateBurnoutRiskConfidence(context),
        context: {
          wellnessContext: {
            sessionLengthHours: this.calculateSessionLength(context),
            minutesSinceBreak: this.calculateTimeSinceBreak(context),
            currentTime: new Date().toLocaleTimeString(),
            indicators: this.extractStressIndicators(context),
            errorRate: context.errorMetrics?.errorRate,
            currentTask: this.inferCurrentTask(context)
          }
        }
      });
    }

    // Scenario: REPETITIVE_PATTERN
    if (this.hasRepetitivePattern(context)) {
      detected.push({
        scenario: SCENARIOS.REPETITIVE_PATTERN,
        confidence: this.calculatePatternConfidence(context),
        context: {
          patternContext: {
            patternName: context.patternMetrics?.patternName,
            frequency: context.patternMetrics?.frequency,
            estimatedTimeWasted: context.patternMetrics?.timeWasted,
            applications: context.patternMetrics?.applications
          }
        }
      });
    }

    // Scenario: DEBUGGING_MARATHON
    if (this.isDebuggingMarathon(context)) {
      detected.push({
        scenario: SCENARIOS.DEBUGGING_MARATHON,
        confidence: this.calculateDebugMarathonConfidence(context),
        context: {
          debuggingContext: {
            duration: this.calculateDebugDuration(context),
            approaches: context.errorMetrics?.approachesTried,
            repeatedAction: context.errorMetrics?.repeatedAction
          }
        }
      });
    }

    // Scenario: DEEP_FOCUS (lowest priority, only if no other scenarios)
    if (this.isInDeepFocus(context) && detected.length === 0) {
      detected.push({
        scenario: SCENARIOS.DEEP_FOCUS,
        confidence: this.calculateDeepFocusConfidence(context),
        context: {
          deepFocusContext: {
            durationMinutes: context.focusMetrics?.focusDuration,
            currentTask: this.inferCurrentTask(context),
            progressPercent: this.estimateProgress(context)
          }
        }
      });
    }

    return detected;
  }

  /**
   * Select the highest priority scenario from detected list
   */
  selectPriorityScenario(scenarios) {
    if (scenarios.length === 0) return null;

    // Priority weights for different scenarios
    const priorityWeights = {
      [SCENARIOS.STUCK_ON_ERROR]: 10,
      [SCENARIOS.BURNOUT_RISK]: 9,
      [SCENARIOS.DEBUGGING_MARATHON]: 8,
      [SCENARIOS.CONTEXT_SWITCHING]: 7,
      [SCENARIOS.REPETITIVE_PATTERN]: 6,
      [SCENARIOS.MEETING_PREP]: 5,
      [SCENARIOS.CODE_REVIEW_OPPORTUNITY]: 4,
      [SCENARIOS.LEARNING_MOMENT]: 3,
      [SCENARIOS.MORNING_BRIEF]: 2,
      [SCENARIOS.DEEP_FOCUS]: 1
    };

    // Sort by weighted score (priority * confidence)
    const scored = scenarios.map(s => ({
      ...s,
      score: (priorityWeights[s.scenario] || 5) * s.confidence
    }));

    scored.sort((a, b) => b.score - a.score);

    // Only return if confidence is high enough
    return scored[0].confidence >= 0.5 ? scored[0] : null;
  }

  /**
   * Generate brief using appropriate prompt and AI
   */
  async generateBrief(selectedScenario, fullContext) {
    const promptGenerator = prompts[selectedScenario.scenario];
    
    if (!promptGenerator) {
      throw new Error(`No prompt generator for scenario: ${selectedScenario.scenario}`);
    }

    // Generate the prompt configuration
    const promptConfig = promptGenerator({
      ...fullContext,
      ...selectedScenario.context
    });

    // Call AI to generate the brief
    console.log(`  📡 Generating brief with AI...`);
    
    const aiResponse = await this.callAIForBrief(promptConfig);
    
    return {
      ...aiResponse,
      scenario: selectedScenario.scenario,
      confidence: promptConfig.confidence,
      priority: promptConfig.priority,
      id: promptConfig.id,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Call AI provider to generate brief content
   */
  async callAIForBrief(promptConfig) {
    const provider = process.env.AI_PROVIDER || 'pieces';
    
    try {
      if (provider === 'zai' && aiService.zai) {
        return await this.callZAI(promptConfig);
      } else if (provider === 'gemini' && aiService.gemini) {
        return await this.callGemini(promptConfig);
      } else {
        // Fallback to pieces copilot
        return await this.callPiecesCopilot(promptConfig);
      }
    } catch (error) {
      console.error('  ✗ AI call failed:', error.message);
      return this.generateMinimalBrief(promptConfig);
    }
  }

  async callZAI(promptConfig) {
    const response = await aiService.zai.chat.completions.create({
      model: process.env.ZAI_MODEL || 'glm-4.7',
      messages: [
        {
          role: 'system',
          content: promptConfig.systemPrompt
        },
        {
          role: 'user',
          content: promptConfig.userPrompt
        }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  }

  async callGemini(promptConfig) {
    const fullPrompt = `${promptConfig.systemPrompt}\n\n${promptConfig.userPrompt}`;
    
    const response = await aiService.gemini.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: fullPrompt
    });

    const text = response.text;
    return this.extractJSONFromText(text);
  }

  async callPiecesCopilot(promptConfig) {
    // Use Pieces Copilot for generation
    const fullPrompt = `${promptConfig.systemPrompt}\n\n${promptConfig.userPrompt}\n\nRespond with valid JSON only.`;
    
    const response = await piecesCopilotService.askQuestion(fullPrompt);
    
    try {
      return this.extractJSONFromText(response);
    } catch (e) {
      return { rawResponse: response };
    }
  }

  extractJSONFromText(text) {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  }

  /**
   * Format brief for maximum actionability
   */
  formatForActionability(brief, scenario) {
    const formatters = {
      [SCENARIOS.STUCK_ON_ERROR]: (b) => ({
        title: `🐛 ${b.diagnosis?.likelyCause?.substring(0, 60) || 'Debugging Help'}`,
        description: b.solution?.description || b.rawResponse || '',
        type: 'blocker',
        priority: scenario.priority,
        actions: [
          {
            label: 'Try Fix',
            type: 'copy',
            payload: b.solution?.codeExample || ''
          },
          ...(b.resources?.[0]?.url ? [{
            label: 'View Docs',
            type: 'link',
            payload: b.resources[0].url
          }] : []),
          {
            label: 'Dismiss',
            type: 'dismiss'
          }
        ],
        metadata: {
          confidence: scenario.confidence,
          nextAction: b.nextAction,
          prevention: b.prevention
        }
      }),

      [SCENARIOS.CONTEXT_SWITCHING]: (b) => ({
        title: `🎯 Back to: ${b.recoveryPlan?.immediateAction?.substring(0, 50) || 'Focus Recovery'}`,
        description: `You were working on: ${b.interruptionSummary?.whatWasDoing || 'a task'}`,
        type: 'focus',
        priority: scenario.priority,
        actions: [
          {
            label: 'Resume Work',
            type: 'focus_mode',
            payload: b.recoveryPlan?.fileToOpen || ''
          },
          {
            label: 'Snooze 15m',
            type: 'snooze',
            payload: '15'
          },
          {
            label: 'Dismiss',
            type: 'dismiss'
          }
        ],
        metadata: {
          confidence: scenario.confidence,
          todos: b.contextRestore?.relevantTODOs
        }
      }),

      [SCENARIOS.BURNOUT_RISK]: (b) => ({
        title: `☕ ${b.breakRecommendation?.message?.substring(0, 50) || 'Time for a Break'}`,
        description: `${b.activity?.title || 'Take a break'} - ${b.activity?.description?.substring(0, 100) || ''}`,
        type: 'wellness',
        priority: scenario.priority,
        actions: [
          {
            label: 'Start Break',
            type: 'break_timer',
            payload: b.activity?.duration || '5'
          },
          {
            label: 'Snooze 30m',
            type: 'snooze',
            payload: '30'
          },
          {
            label: 'Dismiss',
            type: 'dismiss'
          }
        ],
        metadata: {
          confidence: scenario.confidence,
          returnPlan: b.returnPlan
        }
      }),

      [SCENARIOS.MORNING_BRIEF]: (b) => ({
        title: `🌅 ${b.greeting || 'Good Morning!'}`,
        description: b.yesterdayRecap?.oneSentence || 'Ready for today?',
        type: 'brief',
        priority: scenario.priority,
        actions: [
          {
            label: 'View Priorities',
            type: 'expand',
            payload: JSON.stringify(b.todayPriorities)
          },
          {
            label: 'Dismiss',
            type: 'dismiss'
          }
        ],
        metadata: {
          priorities: b.todayPriorities,
          watchOutFor: b.watchOutFor
        }
      }),

      [SCENARIOS.REPETITIVE_PATTERN]: (b) => ({
        title: `⚡ Automation Opportunity: ${b.pattern?.name?.substring(0, 40) || 'Pattern Detected'}`,
        description: `Save ${b.roi?.dailySavings || 'time'} per day by ${b.solution?.title || 'automating'}`,
        type: 'automation',
        priority: scenario.priority,
        actions: [
          {
            label: 'View Solution',
            type: 'expand',
            payload: JSON.stringify(b.solution)
          },
          {
            label: 'Copy Code',
            type: 'copy',
            payload: b.solution?.codeExample || ''
          },
          {
            label: 'Dismiss',
            type: 'dismiss'
          }
        ],
        metadata: {
          confidence: scenario.confidence,
          roi: b.roi
        }
      }),

      [SCENARIOS.DEEP_FOCUS]: (b) => ({
        title: `🧘 Deep Focus Mode`,
        description: `You've been focused for ${b.flowStatus?.duration || 'a while'}. ${b.breakStrategy?.suggestBreakAt || ''}`,
        type: 'focus',
        priority: scenario.priority,
        actions: [
          {
            label: 'Protect Focus',
            type: 'focus_mode',
            payload: '30'
          },
          {
            label: 'Dismiss',
            type: 'dismiss'
          }
        ],
        metadata: {
          confidence: scenario.confidence
        }
      }),

      [SCENARIOS.DEBUGGING_MARATHON]: (b) => ({
        title: `🔧 Debugging Strategy`,
        description: b.freshApproach?.description || 'Try a fresh approach',
        type: 'debugging',
        priority: scenario.priority,
        actions: [
          {
            label: 'Try Technique',
            type: 'expand',
            payload: JSON.stringify(b.freshApproach)
          },
          {
            label: 'Ask for Help',
            type: 'link',
            payload: 'https://stackoverflow.com/questions/ask'
          },
          {
            label: 'Dismiss',
            type: 'dismiss'
          }
        ],
        metadata: {
          confidence: scenario.confidence,
          whenToAskForHelp: b.whenToAskForHelp
        }
      })
    };

    const formatter = formatters[scenario.scenario];
    
    if (formatter) {
      return formatter(brief);
    }

    // Fallback formatting
    return {
      title: `💡 ${brief.title || 'Insight'}`,
      description: brief.description || brief.rawResponse || '',
      type: 'insight',
      priority: scenario.priority,
      actions: [
        { label: 'Dismiss', type: 'dismiss' }
      ],
      metadata: {
        confidence: scenario.confidence
      }
    };
  }

  /**
   * Check if scenario is on cooldown
   */
  isOnCooldown(scenario) {
    const lastTime = this.lastBriefTime.get(scenario);
    if (!lastTime) return false;
    
    return (Date.now() - lastTime) < this.minBriefInterval;
  }

  /**
   * Record brief in history
   */
  recordBrief(scenario) {
    this.lastBriefTime.set(scenario, Date.now());
    
    const history = this.scenarioHistory.get(scenario) || [];
    history.push({
      timestamp: new Date().toISOString(),
      scenario
    });
    
    // Keep last 10 entries
    if (history.length > 10) {
      history.shift();
    }
    
    this.scenarioHistory.set(scenario, history);
  }

  /**
   * Save brief as a suggestion in the database
   */
  async saveBriefAsSuggestion(brief) {
    try {
      const suggestion = new Suggestion({
        type: brief.type,
        title: brief.title,
        description: brief.description,
        priority: brief.priority,
        category: 'intelligent_brief',
        actions: brief.actions,
        triggerContext: {
          scenario: brief.metadata,
          source: 'intelligent_brief_service'
        },
        status: 'active',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
      });

      await suggestion.save();
    } catch (error) {
      console.error('  ✗ Error saving brief as suggestion:', error.message);
    }
  }

  // ============================================
  // SCENARIO DETECTION HELPERS
  // ============================================

  isStuckOnError(context) {
    const errorMetrics = context.errorMetrics;
    return errorMetrics && 
      (errorMetrics.durationMinutes > 20 || 
       errorMetrics.stackOverflowVisits > 0 ||
       errorMetrics.repeatedError);
  }

  isContextSwitching(context) {
    const focusMetrics = context.focusMetrics;
    return focusMetrics && 
      (focusMetrics.switchCount > 5 || 
       focusMetrics.timeSinceLastFocus > 10);
  }

  isBurnoutRisk(context) {
    const sessionHours = this.calculateSessionLength(context);
    const indicators = this.extractStressIndicators(context);
    return sessionHours > 4 || indicators.length >= 2;
  }

  hasRepetitivePattern(context) {
    const patternMetrics = context.patternMetrics;
    return patternMetrics && 
      patternMetrics.frequency > 3 && 
      patternMetrics.timeWasted > 10;
  }

  isDebuggingMarathon(context) {
    const errorMetrics = context.errorMetrics;
    return errorMetrics && 
      errorMetrics.debugDuration > 30 &&
      errorMetrics.approachesTried?.length > 2;
  }

  isInDeepFocus(context) {
    const focusMetrics = context.focusMetrics;
    return focusMetrics && 
      focusMetrics.focusDuration > 30 && 
      focusMetrics.switchCount < 2;
  }

  // ============================================
  // METRIC CALCULATION HELPERS
  // ============================================

  calculateActivityMetrics(activities) {
    if (!activities || activities.length === 0) {
      return { count: 0, topApps: [] };
    }

    const appCounts = {};
    activities.forEach(a => {
      const app = a.application || 'Unknown';
      appCounts[app] = (appCounts[app] || 0) + 1;
    });

    const topApps = Object.entries(appCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      count: activities.length,
      topApps,
      timeRange: {
        first: activities[activities.length - 1]?.created,
        last: activities[0]?.created
      }
    };
  }

  calculateFocusMetrics(files, activities) {
    if (!activities || activities.length < 2) {
      return { focusDuration: 0, switchCount: 0 };
    }

    // Count application switches
    let switchCount = 0;
    let lastApp = null;
    
    activities.forEach(a => {
      if (lastApp && a.application !== lastApp) {
        switchCount++;
      }
      lastApp = a.application;
    });

    // Estimate focus duration based on file activity
    const focusDuration = files && files.length > 0 
      ? Math.round((new Date() - new Date(files[0].updated)) / 60000)
      : 0;

    return {
      focusDuration,
      switchCount,
      uniqueApps: new Set(activities.map(a => a.application)).size
    };
  }

  detectErrorPatterns(visionEvents, activities) {
    const errorKeywords = ['error', 'exception', 'failed', 'debug', 'fix', 'bug'];
    
    // Check vision events for error-related text
    const errorEvents = (visionEvents || []).filter(v => 
      errorKeywords.some(keyword => 
        v.ocrText?.toLowerCase().includes(keyword)
      )
    );

    // Check for StackOverflow or documentation visits
    const helpVisits = (activities || []).filter(a => 
      a.description?.toLowerCase().includes('stackoverflow') ||
      a.description?.toLowerCase().includes('docs')
    );

    return {
      errorCount: errorEvents.length,
      stackOverflowVisits: helpVisits.length,
      durationMinutes: errorEvents.length > 0 ? 30 : 0,
      repeatedError: errorEvents.length > 3
    };
  }

  detectRepetitivePatterns(activities) {
    if (!activities || activities.length < 5) {
      return null;
    }

    // Simple pattern detection: same action repeated
    const actionCounts = {};
    activities.forEach(a => {
      const desc = a.description || 'unknown';
      actionCounts[desc] = (actionCounts[desc] || 0) + 1;
    });

    const patterns = Object.entries(actionCounts)
      .filter(([_, count]) => count > 2)
      .sort((a, b) => b[1] - a[1]);

    if (patterns.length > 0) {
      return {
        patternName: patterns[0][0],
        frequency: patterns[0][1],
        timeWasted: patterns[0][1] * 2, // Rough estimate
        applications: Object.keys(actionCounts)
      };
    }

    return null;
  }

  calculateSessionLength(context) {
    const sessionStart = this.estimateSessionStart(context.activities);
    if (!sessionStart) return 0;
    
    return Math.round((Date.now() - sessionStart) / (60 * 60 * 1000) * 10) / 10;
  }

  estimateSessionStart(activities) {
    if (!activities || activities.length === 0) return null;
    
    // Find a gap of >30 minutes in activity
    for (let i = activities.length - 1; i > 0; i--) {
      const current = new Date(activities[i].created);
      const previous = new Date(activities[i - 1].created);
      
      if (previous - current > 30 * 60 * 1000) {
        return current;
      }
    }
    
    return activities[activities.length - 1]?.created;
  }

  calculateTimeSinceBreak(context) {
    // Simplified: assume breaks are gaps in activity
    const activities = context.activities;
    if (!activities || activities.length < 2) return 0;
    
    const lastActivity = new Date(activities[0].created);
    return Math.round((Date.now() - lastActivity) / 60000);
  }

  extractStressIndicators(context) {
    const indicators = [];
    
    if (this.calculateSessionLength(context) > 5) {
      indicators.push('long_session');
    }
    
    if (context.errorMetrics?.errorCount > 5) {
      indicators.push('high_error_rate');
    }
    
    if (context.focusMetrics?.switchCount > 10) {
      indicators.push('high_context_switching');
    }
    
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      indicators.push('late_hours');
    }
    
    return indicators;
  }

  extractRecentApps(activities) {
    if (!activities) return [];
    
    const apps = activities
      .slice(0, 5)
      .map(a => a.application)
      .filter(Boolean);
    
    return [...new Set(apps)];
  }

  calculateTimeAway(context) {
    // Simplified calculation
    return 15; // Placeholder
  }

  getPreviousFocus(context) {
    const recentSummary = context.workstreamSummaries?.[0];
    return {
      task: recentSummary?.summary || 'Unknown task',
      lastFile: context.files?.[0]?.fullPath
    };
  }

  inferCurrentTask(context) {
    const recentSummary = context.workstreamSummaries?.[0];
    return recentSummary?.summary || 'Unknown';
  }

  estimateProgress(context) {
    // Placeholder - would need more sophisticated tracking
    return 50;
  }

  calculateDebugDuration(context) {
    return context.errorMetrics?.durationMinutes || 0;
  }

  // ============================================
  // CONFIDENCE CALCULATIONS
  // ============================================

  calculateStuckConfidence(context) {
    let confidence = 0.5;
    const errorMetrics = context.errorMetrics;
    
    if (errorMetrics?.durationMinutes > 30) confidence += 0.2;
    if (errorMetrics?.stackOverflowVisits > 0) confidence += 0.15;
    if (errorMetrics?.repeatedError) confidence += 0.1;
    
    return Math.min(0.95, confidence);
  }

  calculateContextSwitchConfidence(context) {
    let confidence = 0.5;
    const focusMetrics = context.focusMetrics;
    
    if (focusMetrics?.switchCount > 10) confidence += 0.2;
    if (focusMetrics?.timeSinceLastFocus > 20) confidence += 0.15;
    
    return Math.min(0.95, confidence);
  }

  calculateBurnoutRiskConfidence(context) {
    let confidence = 0.4;
    const indicators = this.extractStressIndicators(context);
    
    if (indicators.length >= 3) confidence += 0.3;
    else if (indicators.length >= 2) confidence += 0.2;
    
    if (this.calculateSessionLength(context) > 6) confidence += 0.2;
    
    return Math.min(0.9, confidence);
  }

  calculatePatternConfidence(context) {
    let confidence = 0.5;
    const patternMetrics = context.patternMetrics;
    
    if (patternMetrics?.frequency > 5) confidence += 0.2;
    if (patternMetrics?.timeWasted > 15) confidence += 0.15;
    
    return Math.min(0.9, confidence);
  }

  calculateDeepFocusConfidence(context) {
    let confidence = 0.5;
    const focusMetrics = context.focusMetrics;
    
    if (focusMetrics?.focusDuration > 45) confidence += 0.2;
    if (focusMetrics?.switchCount === 0) confidence += 0.15;
    
    return Math.min(0.9, confidence);
  }

  calculateDebugMarathonConfidence(context) {
    let confidence = 0.5;
    const errorMetrics = context.errorMetrics;
    
    if (errorMetrics?.durationMinutes > 60) confidence += 0.2;
    if (errorMetrics?.approachesTried?.length > 3) confidence += 0.15;
    
    return Math.min(0.9, confidence);
  }

  // ============================================
  // FALLBACK METHODS
  // ============================================

  generateFallbackBrief(userContext) {
    return {
      title: '💡 Quick Tip',
      description: 'Your AI assistant is learning your patterns. More personalized insights coming soon!',
      type: 'tip',
      priority: 3,
      actions: [
        { label: 'Dismiss', type: 'dismiss' }
      ],
      metadata: {
        confidence: 0.5,
        fallback: true
      }
    };
  }

  generateMinimalBrief(promptConfig) {
    return {
      title: `${promptConfig.scenario} Detected`,
      description: 'Analysis in progress...',
      rawResponse: 'Unable to generate detailed brief at this time.',
      priority: promptConfig.priority
    };
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get service status and statistics
   */
  getStatus() {
    return {
      scenarioHistory: Object.fromEntries(this.scenarioHistory),
      lastBriefTimes: Object.fromEntries(
        Array.from(this.lastBriefTime.entries()).map(([k, v]) => [k, new Date(v).toISOString()])
      ),
      availableScenarios: Object.values(SCENARIOS)
    };
  }

  /**
   * Manually trigger a specific scenario (for testing)
   */
  async triggerScenario(scenarioType, customContext = {}) {
    // Map scenario constants to prompt function names
    const scenarioToPromptMap = {
      [SCENARIOS.STUCK_ON_ERROR]: 'stuckOnError',
      [SCENARIOS.CONTEXT_SWITCHING]: 'focusRecovery',
      [SCENARIOS.BURNOUT_RISK]: 'wellnessCheck',
      [SCENARIOS.MORNING_BRIEF]: 'morningBrief',
      [SCENARIOS.REPETITIVE_PATTERN]: 'patternInsight',
      [SCENARIOS.DEEP_FOCUS]: 'deepFocus',
      [SCENARIOS.CODE_REVIEW_OPPORTUNITY]: 'codeReviewOpportunity',
      [SCENARIOS.LEARNING_MOMENT]: 'learningMoment',
      [SCENARIOS.DEBUGGING_MARATHON]: 'debuggingMarathon',
      [SCENARIOS.MEETING_PREP]: 'meetingPrep'
    };

    const promptName = scenarioToPromptMap[scenarioType];

    if (!promptName || !prompts[promptName]) {
      throw new Error(`Unknown scenario: ${scenarioType}`);
    }

    const mockContext = this.generateMockContext(scenarioType);
    
    const selectedScenario = {
      scenario: promptName,
      confidence: 0.9,
      context: mockContext
    };

    return await this.generateBrief(selectedScenario, customContext);
  }

  generateMockContext(scenarioType) {
    // Map scenario constants to prompt function names
    const scenarioToPromptMap = {
      [SCENARIOS.STUCK_ON_ERROR]: 'stuckOnError',
      [SCENARIOS.CONTEXT_SWITCHING]: 'focusRecovery',
      [SCENARIOS.BURNOUT_RISK]: 'wellnessCheck',
      [SCENARIOS.MORNING_BRIEF]: 'morningBrief',
      [SCENARIOS.REPETITIVE_PATTERN]: 'patternInsight',
      [SCENARIOS.DEEP_FOCUS]: 'deepFocus',
      [SCENARIOS.CODE_REVIEW_OPPORTUNITY]: 'codeReviewOpportunity',
      [SCENARIOS.LEARNING_MOMENT]: 'learningMoment',
      [SCENARIOS.DEBUGGING_MARATHON]: 'debuggingMarathon',
      [SCENARIOS.MEETING_PREP]: 'meetingPrep'
    };

    const promptName = scenarioToPromptMap[scenarioType];

    const mocks = {
      'stuckOnError': {
        errorContext: {
          errorPattern: 'Cannot read property of undefined',
          durationMinutes: 35,
          codeSnippet: 'const result = data.items.map(...)'
        }
      },
      'focusRecovery': {
        focusContext: {
          timeAwayMinutes: 20,
          switchCount: 8
        },
        previousFocus: {
          task: 'Implementing user authentication',
          lastFile: 'auth.js'
        }
      },
      'wellnessCheck': {
        wellnessContext: {
          sessionLengthHours: 5.5,
          minutesSinceBreak: 150,
          indicators: ['long_session', 'high_error_rate']
        }
      },
      'morningBrief': {
        yesterdayContext: {
          summary: 'Worked on authentication',
          files: ['auth.js', 'api.js']
        },
        todayContext: {
          todos: ['Complete auth', 'Write tests']
        }
      },
      'patternInsight': {
        patternContext: {
          patternName: 'Manual testing',
          frequency: 10,
          estimatedTimeWasted: 40
        }
      },
      'deepFocus': {
        deepFocusContext: {
          durationMinutes: 45,
          currentTask: 'Refactoring auth module'
        }
      },
      'codeReviewOpportunity': {
        codeContext: {
          recentFiles: ['auth.js'],
          timeSpent: 45,
          linesChanged: 50
        }
      },
      'learningMoment': {
        learningContext: {
          topic: 'React Hooks',
          resources: ['react.dev', 'mdn.io'],
          timeSpent: 20
        }
      },
      'debuggingMarathon': {
        debuggingContext: {
          issue: 'Memory leak',
          duration: 60,
          approaches: ['Console logs', 'Debugger']
        }
      },
      'meetingPrep': {
        meetingContext: {
          title: 'Daily Standup',
          type: 'standup',
          startsInMinutes: 10
        }
      }
    };

    return mocks[promptName] || {};
  }
}

// Export singleton instance
module.exports = new IntelligentBriefService();
