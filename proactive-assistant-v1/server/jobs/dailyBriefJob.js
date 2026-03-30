const cron = require('node-cron');
const piecesCopilotService = require('../services/piecesCopilotService');
const aiService = require('../services/aiService');
const newsService = require('../services/newsService');
const Brief = require('../models/Brief');
const Settings = require('../models/Settings');
const UserPreference = require('../models/UserPreference');

class DailyBriefJob {
  constructor() {
    this.cronExpression = '0 8 * * *';
    this.isRunning = false;
  }

  start() {
    console.log('⏰ Scheduling Daily Brief Job for 8:00 AM...');
    
    cron.schedule(this.cronExpression, async () => {
      await this.generateDailyBrief();
    });

    console.log('✓ Daily Brief Job scheduled successfully');
  }

  async generateDailyBrief() {
    if (this.isRunning) {
      console.log('⚠ Daily Brief Job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const provider = process.env.AI_PROVIDER || 'pieces';
    
    try {
      console.log('\n========================================');
      console.log('🚀 Starting Daily Brief Generation');
      console.log('    (Pieces Agent-Centric Flow)');
      console.log('========================================\n');
      console.log(`📅 Started at: ${new Date().toISOString()}`);
      console.log(`🤖 AI Provider: ${provider}\n`);
      
      // Step 1: Connect to Pieces OS
      await this.connectPieces();
      
      // Step 2: Get comprehensive analysis from Pieces Agent (single query)
      console.log('🧠 Step 1: Getting comprehensive analysis from Pieces Agent...\n');
      const agentAnalysis = await piecesCopilotService.getComprehensiveAgentAnalysis();
      
      if (!agentAnalysis.success) {
        console.log('⚠ Agent analysis failed, attempting fallback...');
      }
      
      // Step 3: Fetch supplementary data in parallel
      console.log('📦 Step 2: Fetching supplementary data...');
      const [newsArticles, goals] = await Promise.all([
        newsService.getTechNews(5).catch(() => []),
        UserPreference.getPreferences().then(p => p.goals || []).catch(() => [])
      ]);
      console.log(`✓ News: ${newsArticles.length} articles`);
      console.log(`✓ Goals: ${goals.length} active\n`);
      
      // Step 4: Format analysis into display-ready JSON
      console.log(`📝 Step 3: Formatting brief with ${provider}...\n`);
      let briefData;
      
      if ((provider === 'zai' || provider === 'gemini') && agentAnalysis.success) {
        briefData = await aiService.formatBriefAsJSON(agentAnalysis, newsArticles, goals);
      }
      
      // Fallback if formatting failed
      if (!briefData) {
        console.log('⚠ Formatting failed, using fallback...');
        briefData = aiService.generateFallbackFromAnalysis(agentAnalysis);
      }

      // Step 5: Save to database
      console.log('💾 Step 4: Saving brief to database...\n');
      
      const brief = new Brief({
        // Core content
        greeting: briefData.greeting || '',
        activitySummary: briefData.activitySummary || '',
        focusArea: briefData.focusArea || null,
        items: briefData.items || [],
        dailyChallenge: briefData.dailyChallenge || null,
        reflection: briefData.reflection || null,
        quickTip: briefData.quickTip || '',
        
        // Map items to recommendations for backward compatibility
        recommendations: (briefData.items || []).map(item => ({
          category: item.type || 'general',
          title: item.title,
          description: item.description,
          url: item.url,
          relevanceScore: item.priority,
          timeToComplete: item.timeEstimate
        })),
        
        // Metadata
        provider: provider,
        contextSummary: {
          goalsCount: goals.length,
          analysisLength: agentAnalysis.content?.length || 0,
          analysisDuration: agentAnalysis.duration || 0
        },
        generationTime: Date.now() - startTime
      });

      await brief.save();

      const totalDuration = Date.now() - startTime;
      
      console.log('\n========================================');
      console.log('✅ Daily Brief Generation Complete!');
      console.log('========================================');
      console.log(`📊 Brief ID: ${brief._id}`);
      console.log(`📅 Date: ${brief.date.toISOString()}`);
      console.log(`🤖 Provider: ${provider}`);
      console.log(`📝 Items: ${brief.items?.length || 0}`);
      console.log(`🎯 Focus: ${brief.focusArea?.title || 'Not determined'}`);
      console.log(`⏱ Total Time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)\n`);
      
      return brief;
      
    } catch (error) {
      console.error('\n========================================');
      console.error('❌ Daily Brief Generation Failed!');
      console.error('========================================');
      console.error(`Error: ${error.message}`);
      console.error(`Stack: ${error.stack}\n`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async connectPieces() {
    try {
      if (!piecesCopilotService.connected) {
        console.log('🔌 Connecting to Pieces OS...');
        await piecesCopilotService.connect();
      } else {
        console.log('✓ Pieces OS already connected');
      }
    } catch (error) {
      console.error('✗ Failed to connect to Pieces OS:', error.message);
      throw error;
    }
  }

  async fetchRichContext() {
    console.log('📦 Fetching rich context from Pieces OS...\n');
    
    // Get saved assets (snippets, links, notes)
    const assets = await piecesCopilotService.getRecentAssets(20);
    console.log(`✓ Saved Assets: ${assets.length}`);
    
    // Get recent activities (what user viewed, clicked, interacted with)
    const activities = await piecesCopilotService.getRecentActivities(50);
    console.log(`✓ Recent Activities: ${activities.length}`);
    
    // Get workstream summaries (LTM roll-ups - AI-generated descriptions of work sessions)
    const workstreamSummaries = await piecesCopilotService.getWorkstreamSummaries(10);
    console.log(`✓ Workstream Summaries: ${workstreamSummaries.length}`);

    // Get conversations (recent chat history)
    const conversations = await piecesCopilotService.getConversations(5);
    console.log(`✓ Recent Conversations: ${conversations.length}`);

    // Get anchors (file locations)
    const anchors = await piecesCopilotService.getAnchors(20);
    console.log(`✓ Anchors: ${anchors.length}`);

    // Get websites
    const websites = await piecesCopilotService.getRecentWebsites(20);
    console.log(`✓ Websites: ${websites.length}`);
    
    // Extract patterns from saved assets
    const assetPatterns = piecesCopilotService.extractActivityPatterns(assets);
    
    // Extract rich context from activities and workstream summaries
    const activityContext = piecesCopilotService.extractActivityContext(activities, workstreamSummaries);
    
    // Get user preferences and goals
    console.log('\n📋 Fetching user preferences and goals...');
    let userPreferences = {};
    try {
      const prefs = await UserPreference.getPreferences();
      userPreferences = prefs.getPreferenceSummary();
      console.log(`✓ User Goals: ${userPreferences.goals?.length || 0}`);
      console.log(`✓ Feedback History: ${userPreferences.feedbackCount || 0} items`);
    } catch (e) {
      console.log('⚠ Could not fetch user preferences');
    }
    
    // Optionally query Pieces agent for deeper insights
    let agentInsights = [];
    try {
      const settings = await Settings.getSettings();
      if (settings.usePiecesSummary) {
        console.log('\n🔍 Querying Pieces agent for deeper insights...');
        agentInsights = await piecesCopilotService.queryAgentForContext();
      }
    } catch (e) {
      console.log('⚠ Could not get agent insights');
    }
    
    console.log(`\n📊 Context Summary:`);
    console.log(`  Languages: ${assetPatterns.languages.join(', ') || 'None'}`);
    console.log(`  Tags: ${assetPatterns.allTags.slice(0, 5).join(', ') || 'None'}${assetPatterns.allTags.length > 5 ? '...' : ''}`);
    console.log(`  Top Apps: ${activityContext.topApplications.map(a => a.name).join(', ') || 'None'}`);
    console.log(`  Websites Visited: ${activityContext.websitesVisited.length}`);
    console.log(`  Files Accessed: ${activityContext.filesAccessed.length}`);
    console.log(`  Activities (24h): ${activityContext.activitiesLast24h}`);
    console.log(`  Active Goals: ${userPreferences.goals?.length || 0}`);
    
    // Optional: Get Pieces to pre-summarize context
    let piecesSummary = '';
    if (process.env.USE_PIECES_SUMMARY === 'true') {
      console.log('\n📝 Getting Pieces summary...');
      piecesSummary = await piecesCopilotService.summarizeContext(assets);
      if (piecesSummary) {
        console.log('✓ Got summary from Pieces');
      }
    }
    
    // Combine all patterns
    const patterns = {
      ...assetPatterns,
      // Add activity-derived patterns
      topApplications: activityContext.topApplications,
      websitesVisited: activityContext.websitesVisited,
      filesAccessed: activityContext.filesAccessed,
      topicsWorkedOn: activityContext.topicsWorkedOn,
      peopleInvolved: activityContext.peopleInvolved
    };
    
    return {
      assets,
      activities,
      workstreamSummaries,
      conversations,
      anchors,
      websites,
      activityContext,
      patterns,
      piecesSummary,
      userPreferences,
      agentInsights
    };
  }

  async runNow() {
    console.log('🔵 Manually triggering Daily Brief Job...\n');
    await this.generateDailyBrief();
  }

  getStatus() {
    return {
      scheduled: this.cronExpression,
      isRunning: this.isRunning,
      piecesConnected: piecesCopilotService.connected,
      provider: process.env.AI_PROVIDER || 'pieces'
    };
  }
}

module.exports = new DailyBriefJob();
