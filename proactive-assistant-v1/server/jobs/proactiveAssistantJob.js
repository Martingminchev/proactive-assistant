const cron = require('node-cron');
const piecesCopilotService = require('../services/piecesCopilotService');
const aiService = require('../services/aiService');
const intelligentBriefService = require('../services/intelligentBriefService');
const interruptionManager = require('../services/interruptionManager');
const Suggestion = require('../models/Suggestion');
const DismissedSuggestion = require('../models/DismissedSuggestion');

class ProactiveAssistantJob {
  constructor() {
    // Run every 10 minutes
    this.cronExpression = '*/10 * * * *';
    this.isRunning = false;
    this.lastRun = null;
    this.lastError = null;
  }

  start() {
    console.log('⏰ Scheduling Proactive Assistant Job (every 10 minutes)...');
    
    cron.schedule(this.cronExpression, async () => {
      await this.run();
    });

    console.log('✓ Proactive Assistant Job scheduled successfully');
  }

  async run() {
    if (this.isRunning) {
      console.log('⚠ Proactive Assistant Job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('\n========================================');
      console.log('🔄 Proactive Assistant Check');
      console.log('    (Pieces Agent-Centric Flow)');
      console.log('========================================');
      console.log(`📅 Time: ${new Date().toISOString()}\n`);
      
      // Reactivate any snoozed suggestions whose time has passed
      await Suggestion.reactivateSnoozed();
      
      // Clean up expired suggestions
      await Suggestion.cleanupExpired();
      
      // Clean up expired dismissal records
      await DismissedSuggestion.cleanupExpired();
      
      // Check if we should interrupt the user at all
      const interruptionCheck = await interruptionManager.shouldInterrupt({
        signals: await this.collectActivitySignals(),
        userId: 'default'
      });
      
      if (!interruptionCheck.should) {
        console.log(`⏭ Skipping proactive check: ${interruptionCheck.reason}`);
        this.lastRun = new Date();
        this.isRunning = false;
        return;
      }
      
      console.log(`✅ Interruption approved: ${interruptionCheck.flowState} state, level ${interruptionCheck.level}`);
      
      // Connect to Pieces
      await this.connectPieces();
      
      // Step 1: Get comprehensive analysis from Pieces Agent (single query)
      console.log('🧠 Step 1: Getting comprehensive analysis from Pieces Agent...\n');
      const agentAnalysis = await piecesCopilotService.getComprehensiveAgentAnalysis();
      
      if (!agentAnalysis.success) {
        console.log('⚠ Agent analysis failed, skipping suggestion generation');
        this.lastRun = new Date();
        return;
      }
      
      // Step 2: Format analysis into suggestions
      console.log('📝 Step 2: Formatting analysis into suggestions...\n');
      const suggestions = await aiService.formatSuggestionsAsJSON(agentAnalysis);
      
      if (suggestions && suggestions.length > 0) {
        // Filter suggestions through interruption manager
        const signals = await this.collectActivitySignals();
        const appropriateSuggestions = await interruptionManager.filterAppropriateSuggestions(
          suggestions, 
          signals,
          'default'
        );
        
        if (appropriateSuggestions.length > 0) {
          // Save only the appropriate suggestions
          await this.saveSuggestions(
            appropriateSuggestions, 
            { 
              analysisLength: agentAnalysis.content?.length || 0,
              flowState: interruptionCheck.flowState,
              level: interruptionCheck.level
            }
          );
          console.log(`✓ Generated and saved ${appropriateSuggestions.length} appropriate suggestions (from ${suggestions.length} total)`);
        } else {
          console.log('⚪ No appropriate suggestions for current user state');
        }
      } else {
        console.log('⚪ No new suggestions generated');
      }

      // Step 3: Generate intelligent contextual briefs
      console.log('\n🧠 Step 3: Checking for contextual scenarios...\n');
      const intelligentBrief = await intelligentBriefService.generateIntelligentBrief();
      
      if (intelligentBrief) {
        console.log(`✓ Generated intelligent brief: ${intelligentBrief.title}`);
      } else {
        console.log('⚪ No contextual scenarios detected');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('\n========================================');
      console.log('✅ Proactive Assistant Check Complete');
      console.log(`⏱ Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
      console.log('========================================\n');
      
      this.lastRun = new Date();
      this.lastError = null;
      
    } catch (error) {
      console.error('\n========================================');
      console.error('❌ Proactive Assistant Check Failed');
      console.error('========================================');
      console.error(`Error: ${error.message}`);
      this.lastError = error.message;
    } finally {
      this.isRunning = false;
    }
  }

  async connectPieces() {
    try {
      if (!piecesCopilotService.connected) {
        console.log('🔌 Connecting to Pieces OS...');
        await piecesCopilotService.connect();
      }
    } catch (error) {
      console.error('✗ Failed to connect to Pieces OS:', error.message);
      throw error;
    }
  }

  async collectActivitySignals() {
    // Collect activity signals from Pieces OS or other sources
    // This is a placeholder - in production, this would gather real signals
    const now = Date.now();
    
    // Try to get real signals from Pieces context if available
    let signals = {
      timeOnCurrentTask: 0,
      errorFrequency: 0,
      backspaceRatio: 0,
      typingVelocity: 0,
      tabSwitchRate: 0,
      idleTime: 0,
      recentKeystrokes: []
    };
    
    try {
      // Attempt to get context from Pieces OS service
      const context = await piecesCopilotService.getActivityContext?.();
      if (context) {
        signals = {
          ...signals,
          ...context
        };
      }
    } catch (e) {
      // Fallback to default signals
    }
    
    return signals;
  }

  async saveSuggestions(suggestions, metadata = {}) {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Expire in 1 hour
    const provider = process.env.AI_PROVIDER || 'pieces';
    
    const savedSuggestions = [];
    
    for (const suggestion of suggestions) {
      try {
        // Ensure default dismiss action is present
        const actions = suggestion.actions || [];
        if (!actions.some(a => a.type === 'dismiss')) {
          actions.push({
            label: 'Dismiss',
            type: 'dismiss'
          });
        }
        
        // Add interruption level to actions if present
        if (suggestion._interruptionLevel) {
          actions.push({
            label: `Level ${suggestion._interruptionLevel}`,
            type: 'info',
            payload: `interruption_level:${suggestion._interruptionLevel}`
          });
        }
        
        const newSuggestion = new Suggestion({
          type: suggestion.type || 'tip',
          title: suggestion.title,
          description: suggestion.description,
          priority: suggestion.priority || 5,
          category: suggestion.category || 'general',
          actions: actions,
          triggerContext: {
            keywords: suggestion.keywords || [],
            source: 'pieces_agent_analysis',
            analysisLength: metadata.analysisLength || 0,
            flowState: metadata.flowState || 'unknown',
            interruptionLevel: metadata.level || 1
          },
          status: 'active',
          expiresAt,
          provider
        });
        
        await newSuggestion.save();
        savedSuggestions.push(newSuggestion);
      } catch (error) {
        console.error(`✗ Error saving suggestion "${suggestion.title}":`, error.message);
      }
    }
    
    return savedSuggestions;
  }

  async runNow() {
    console.log('🔵 Manually triggering Proactive Assistant Check...\n');
    await this.run();
  }

  getStatus() {
    return {
      scheduled: this.cronExpression,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      lastError: this.lastError,
      piecesConnected: piecesCopilotService.connected,
      provider: process.env.AI_PROVIDER || 'pieces'
    };
  }
}

module.exports = new ProactiveAssistantJob();
