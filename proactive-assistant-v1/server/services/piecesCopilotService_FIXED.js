const pieces = require('@pieces.app/pieces-os-client');
const os = require('os');

/**
 * FIXED Pieces Copilot Service
 * 
 * Critical fixes applied:
 * 1. Port discovery instead of hardcoded port
 * 2. Application registration via ConnectorApi
 * 3. WPE API calls use transferables: true
 * 4. Workstream summaries fetch annotations properly
 * 5. Graceful fallbacks for each API
 */

class PiecesCopilotService {
  constructor() {
    this.connected = false;
    this.registered = false;
    this.configuration = null;
    this.discoveredPort = null;
    
    // APIs will be initialized after port discovery
    this.qgptApi = null;
    this.assetsApi = null;
    this.wellKnownApi = null;
    this.activitiesApi = null;
    this.workstreamSummariesApi = null;
    this.annotationApi = null;  // NEW: For fetching summary content
    this.workstreamPatternEngineApi = null;
    this.ocrAnalysesApi = null;
    this.imageAnalysesApi = null;
    this.conversationsApi = null;
    this.anchorsApi = null;
    this.websitesApi = null;
    this.connectorApi = null;  // NEW: For app registration
    this.osApi = null;
  }

  /**
   * NEW: Discover the correct port for Pieces OS
   */
  async discoverPort() {
    const ports = [1000, 39300, 5323]; // Try common ports
    
    for (const port of ports) {
      try {
        console.log(`🔍 Trying port ${port}...`);
        const response = await fetch(`http://localhost:${port}/.well-known/health`);
        if (response.ok) {
          const health = await response.text();
          if (health.includes('ok')) {
            console.log(`✓ Found Pieces OS on port ${port}`);
            return port;
          }
        }
      } catch (e) {
        // Port not available, try next
      }
    }
    
    throw new Error('Pieces OS not found on any port (tried: 1000, 39300, 5323)');
  }

  /**
   * NEW: Register application with Pieces OS
   */
  async registerApplication() {
    try {
      const platform = os.platform();
      const platformEnum = platform === 'darwin' ? 'Macos' : 
                          platform === 'win32' ? 'Windows' : 'Linux';
      
      const result = await this.connectorApi.connect({
        seededConnectorConnection: {
          application: {
            name: 'ProactiveAIAssistant',
            version: '3.0.0',
            platform: platformEnum
          }
        }
      });
      
      this.registered = true;
      console.log('✓ Application registered with Pieces OS');
      return result;
    } catch (error) {
      console.error('✗ Failed to register application:', error.message);
      // Continue anyway - some APIs may still work
    }
  }

  async connect() {
    if (this.connected) {
      return;
    }

    try {
      // Step 1: Discover port
      this.discoveredPort = await this.discoverPort();
      
      // Step 2: Create configuration
      this.configuration = new pieces.Configuration({
        basePath: `http://localhost:${this.discoveredPort}`
      });

      // Step 3: Initialize all APIs
      this.qgptApi = new pieces.QGPTApi(this.configuration);
      this.assetsApi = new pieces.AssetsApi(this.configuration);
      this.wellKnownApi = new pieces.WellKnownApi(this.configuration);
      this.activitiesApi = new pieces.ActivitiesApi(this.configuration);
      this.workstreamSummariesApi = new pieces.WorkstreamSummariesApi(this.configuration);
      this.annotationApi = new pieces.AnnotationApi(this.configuration);  // NEW
      this.workstreamPatternEngineApi = new pieces.WorkstreamPatternEngineApi(this.configuration);
      this.ocrAnalysesApi = new pieces.OCRAnalysesApi(this.configuration);
      this.imageAnalysesApi = new pieces.ImageAnalysesApi(this.configuration);
      this.conversationsApi = new pieces.ConversationsApi(this.configuration);
      this.anchorsApi = new pieces.AnchorsApi(this.configuration);
      this.websitesApi = new pieces.WebsitesApi(this.configuration);
      this.connectorApi = new pieces.ConnectorApi(this.configuration);  // NEW
      this.osApi = new pieces.OSApi(this.configuration);

      // Step 4: Health check
      const health = await this.wellKnownApi.getWellKnownHealth();
      
      if (health.includes('ok')) {
        this.connected = true;
        console.log(`✓ Connected to Pieces OS on port ${this.discoveredPort}`);
        
        // Step 5: Register application
        await this.registerApplication();
      } else {
        throw new Error(`Unexpected health response: ${health}`);
      }
    } catch (error) {
      console.error('✗ Failed to connect to Pieces OS:', error.message);
      throw error;
    }
  }

  /**
   * NEW: Ensure WPE is activated
   */
  async ensureWPEActive() {
    try {
      const status = await this.workstreamPatternEngineApi
        .workstreamPatternEngineProcessorsVisionStatus();
      
      if (!status.vision) {
        console.log('🔌 Activating WPE...');
        await this.workstreamPatternEngineApi
          .workstreamPatternEngineProcessorsVisionActivate();
        console.log('✓ WPE activated');
      }
      
      return { active: true, status };
    } catch (error) {
      console.error('✗ WPE activation failed:', error.message);
      return { active: false, error: error.message };
    }
  }

  /**
   * FIXED: Get vision events with proper parameters
   */
  async getVisionEvents(limit = 50) {
    try {
      if (!this.connected) await this.connect();

      // Ensure WPE is active
      const wpeStatus = await this.ensureWPEActive();
      if (!wpeStatus.active) {
        console.log('⚠ WPE not active, skipping vision events');
        return [];
      }

      // CRITICAL FIX: Use transferables: true to get actual content
      const snapshot = await this.workstreamPatternEngineApi
        .workstreamPatternEngineProcessorsVisionEventsSnapshot({
          transferables: true  // ✅ REQUIRED for OCR text
        });

      const rawEvents = snapshot.iterable || [];
      
      const events = rawEvents
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit)
        .map(event => ({
          id: event.id,
          created: event.created?.value,
          application: event.application?.name || 'Unknown',
          textContent: event.textContent || '',  // OCR text
          title: event.title || '',
          url: event.url || '',
          hasScreenshot: !!event.image,
          anchors: event.anchors?.iterable?.map(a => ({
            id: a.id,
            fullPath: a.fullpath,
            name: a.name
          })) || [],
          tags: event.tags?.iterable?.map(t => t.text) || []
        }));

      console.log(`✓ Retrieved ${events.length} vision events (${events.filter(e => e.textContent).length} with OCR)`);
      return events;
    } catch (error) {
      console.error('✗ Error fetching vision events:', error.message);
      return [];
    }
  }

  /**
   * FIXED: Get workstream summaries with proper annotation fetching
   */
  async getWorkstreamSummaries(limit = 10) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.workstreamSummariesApi
        .workstreamSummariesSnapshot({
          transferables: true
        });

      const rawSummaries = snapshot.iterable || [];
      
      const sortedSummaries = rawSummaries
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);

      // CRITICAL FIX: Fetch summary content from annotations
      const summaries = [];
      for (const summary of sortedSummaries) {
        let summaryText = '';
        
        // Fetch annotation content
        if (summary.annotations?.iterable?.length > 0) {
          for (const annotationRef of summary.annotations.iterable) {
            try {
              const annotation = await this.annotationApi
                .annotationSpecificAnnotationSnapshot(annotationRef.id);
              
              // Look for SUMMARY type annotation
              if (annotation.type === 'SUMMARY' || annotation.type === 'DESCRIPTION') {
                summaryText = annotation.text || annotation.raw || '';
                break;
              }
            } catch (e) {
              // Continue to next annotation
            }
          }
        }
        
        summaries.push({
          id: summary.id,
          created: summary.created?.value,
          updated: summary.updated?.value,
          summary: summaryText,  // ✅ Now correctly extracted from annotation
          application: summary.application?.name || 'Unknown',
          assets: summary.assets?.iterable?.map(a => ({
            id: a.id,
            name: a.name
          })) || [],
          websites: summary.websites?.iterable?.map(w => ({
            url: w.url,
            name: w.name
          })) || [],
          anchors: summary.anchors?.iterable?.map(a => ({
            id: a.id,
            name: a.name,
            fullPath: a.fullpath
          })) || [],
          people: summary.persons?.iterable?.map(p => p.name) || [],
          tags: summary.tags?.iterable?.map(t => t.text) || []
        });
      }

      console.log(`✓ Retrieved ${summaries.length} workstream summaries (${summaries.filter(s => s.summary).length} with content)`);
      return summaries;
    } catch (error) {
      console.error('✗ Error fetching workstream summaries:', error.message);
      return [];
    }
  }

  /**
   * IMPROVED: Get reliable context with quality indicators
   */
  async getComprehensiveContext() {
    console.log('\n📊 Fetching comprehensive context from Pieces OS...\n');
    
    const startTime = Date.now();
    const context = {
      // Tier 1: Most reliable
      assets: [],
      conversations: [],
      
      // Tier 2: Moderately reliable (now fixed)
      workstreamSummaries: [],
      visionEvents: [],
      anchors: [],
      websites: [],
      
      // Tier 3: Limited value
      activities: [],
      
      // Metadata
      quality: {},
      warnings: [],
      fetchTime: 0
    };

    // Fetch all data in parallel where possible
    try {
      // Tier 1: Always fetch these (most reliable)
      [context.assets, context.conversations] = await Promise.all([
        this.getRecentAssets(20),
        this.getConversations(5)
      ]);
      
      context.quality.assets = context.assets.length > 0 ? 'good' : 'empty';
      context.quality.conversations = context.conversations.length > 0 ? 'good' : 'empty';
    } catch (error) {
      context.warnings.push('Tier 1 APIs failed: ' + error.message);
    }

    try {
      // Tier 2: Fetch with fixes applied
      [context.workstreamSummaries, context.anchors, context.websites] = await Promise.all([
        this.getWorkstreamSummaries(10),
        this.getAnchors(20),
        this.getRecentWebsites(20)
      ]);
      
      context.quality.workstreamSummaries = context.workstreamSummaries.filter(s => s.summary).length > 0 
        ? 'good' 
        : (context.workstreamSummaries.length > 0 ? 'empty_content' : 'empty');
      context.quality.anchors = context.anchors.length > 0 ? 'good' : 'empty';
      context.quality.websites = context.websites.length > 0 ? 'good' : 'empty';
    } catch (error) {
      context.warnings.push('Tier 2 APIs failed: ' + error.message);
    }

    try {
      // Tier 2.5: Vision events (WPE-dependent)
      context.visionEvents = await this.getVisionEvents(30);
      
      if (context.visionEvents.length > 0) {
        const withOcr = context.visionEvents.filter(e => e.textContent).length;
        context.quality.visionEvents = withOcr > 0 ? 'good' : 'no_ocr';
      } else {
        context.quality.visionEvents = 'unavailable';
        context.warnings.push('WPE: No vision events - ensure screen recording permission is granted');
      }
    } catch (error) {
      context.quality.visionEvents = 'error';
      context.warnings.push('WPE failed: ' + error.message);
    }

    try {
      // Tier 3: Activities (limited value)
      context.activities = await this.getRecentActivities(50);
      context.quality.activities = context.activities.length > 0 ? 'limited' : 'empty';
    } catch (error) {
      context.warnings.push('Activities API failed: ' + error.message);
    }

    context.fetchTime = Date.now() - startTime;
    
    // Print quality report
    console.log('\n📋 Context Quality Report:');
    Object.entries(context.quality).forEach(([api, quality]) => {
      const icon = quality === 'good' ? '✓' : (quality === 'limited' ? '~' : '✗');
      console.log(`  ${icon} ${api}: ${quality}`);
    });
    
    if (context.warnings.length > 0) {
      console.log('\n⚠ Warnings:');
      context.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    console.log(`\n⏱ Fetch time: ${context.fetchTime}ms\n`);

    return context;
  }

  // ============ UNCHANGED METHODS (already working) ============

  async getRecentAssets(limit = 20) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.assetsApi.assetsSnapshot({});
      const rawAssets = snapshot.iterable.slice(0, limit);
      
      const assets = rawAssets.map(asset => ({
        id: asset.id,
        name: asset.name || 'Unnamed',
        type: this.detectAssetType(asset),
        language: asset.original?.reference?.classification?.specific || null,
        tags: asset.tags?.iterable?.map(t => t.text) || [],
        description: asset.annotations?.iterable?.[0]?.text || '',
        content: asset.original?.reference?.fragment?.string?.raw?.substring(0, 1500) || '',
        websites: asset.websites?.iterable?.map(w => ({ url: w.url, name: w.name })) || [],
        people: asset.persons?.iterable?.map(p => p.name) || [],
        created: asset.created?.value,
        updated: asset.updated?.value
      }));
      
      return assets;
    } catch (error) {
      console.error('✗ Error fetching assets:', error.message);
      return [];
    }
  }

  detectAssetType(asset) {
    const classification = asset.original?.reference?.classification;
    if (classification?.generic === 'CODE') return 'code';
    if (asset.websites?.iterable?.length > 0) return 'link';
    if (asset.original?.reference?.fragment?.string?.raw) return 'note';
    return 'other';
  }

  async getRecentActivities(limit = 50) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.activitiesApi.activitiesSnapshot({});
      const rawActivities = snapshot.iterable || [];
      
      const sortedActivities = rawActivities
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);

      const activities = sortedActivities.map(activity => {
        const event = activity.event || {};
        return {
          id: activity.id,
          created: activity.created?.value,
          application: activity.application?.name || 'Unknown',
          assetEvent: event.asset ? {
            assetId: event.asset.asset?.id,
            description: this.getAssetEventDescription(event.asset)
          } : null,
          interactionEvent: event.interaction ? {
            description: event.interaction.description,
            element: event.interaction.element
          } : null,
          rank: activity.rank || 0
        };
      });

      return activities;
    } catch (error) {
      console.error('✗ Error fetching activities:', error.message);
      return [];
    }
  }

  getAssetEventDescription(assetEvent) {
    const pairs = assetEvent.identifierDescriptionPair || {};
    if (pairs.created) return 'created';
    if (pairs.updated) return 'updated';
    if (pairs.deleted) return 'deleted';
    if (pairs.referenced) return 'viewed/referenced';
    if (pairs.searched) return 'searched';
    return 'accessed';
  }

  async getRecentWebsites(limit = 20) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.websitesApi.websitesSnapshot({});
      const rawWebsites = snapshot.iterable || [];
      
      const websites = rawWebsites.slice(0, limit).map(w => ({
        id: w.id,
        name: w.name || 'Unnamed',
        url: w.url,
        created: w.created?.value,
        updated: w.updated?.value
      }));
      
      return websites;
    } catch (error) {
      console.error('✗ Error fetching websites:', error.message);
      return [];
    }
  }

  async getConversations(limit = 10) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.conversationsApi.conversationsSnapshot({
        transferables: true
      });
      
      const rawConversations = snapshot.iterable || [];
      
      const sortedConversations = rawConversations
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);

      const conversations = sortedConversations.map(convo => ({
        id: convo.id,
        name: convo.name || 'Unnamed Conversation',
        created: convo.created?.value,
        updated: convo.updated?.value,
        messageCount: convo.messages?.iterable?.length || 0,
        recentMessages: (convo.messages?.iterable || []).slice(-5).map(msg => ({
          role: msg.role,
          content: msg.fragment?.string?.raw?.substring(0, 500) || '',
          created: msg.created?.value
        })),
        assets: convo.assets?.iterable?.map(a => a.id) || [],
        summary: convo.annotations?.iterable?.[0]?.text || ''
      }));

      return conversations;
    } catch (error) {
      console.error('✗ Error fetching conversations:', error.message);
      return [];
    }
  }

  async getAnchors(limit = 30) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.anchorsApi.anchorsSnapshot({
        transferables: true
      });
      
      const rawAnchors = snapshot.iterable || [];
      
      const sortedAnchors = rawAnchors
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);

      const anchors = sortedAnchors.map(anchor => ({
        id: anchor.id,
        name: anchor.name || 'Unknown',
        fullPath: anchor.fullpath || '',
        created: anchor.created?.value,
        updated: anchor.updated?.value,
        type: anchor.type,
        assets: anchor.assets?.iterable?.map(a => ({
          id: a.id,
          name: a.name
        })) || [],
        description: anchor.annotations?.iterable?.[0]?.text || ''
      }));

      return anchors;
    } catch (error) {
      console.error('✗ Error fetching anchors:', error.message);
      return [];
    }
  }

  async getComprehensiveAgentAnalysis() {
    const startTime = Date.now();
    
    try {
      console.log('🧠 Getting comprehensive analysis from Pieces Agent...\n');
      
      // Get context with quality indicators
      const context = await this.getComprehensiveContext();
      
      // Check if we have any meaningful context
      const hasMeaningfulContext = 
        context.assets.length > 0 ||
        context.workstreamSummaries.filter(s => s.summary).length > 0 ||
        context.visionEvents.filter(e => e.textContent).length > 0;
      
      if (!hasMeaningfulContext) {
        console.log('⚠ No meaningful context available');
        return {
          success: false,
          content: null,
          contextAvailable: context.quality,
          duration: Date.now() - startTime
        };
      }

      // Build prompt for Pieces Agent
      const prompt = this.buildAgentPrompt(context);
      
      // Query Pieces Agent
      const relevant = await this.findRelevantContext(context);
      const result = await this.qgptApi.question({
        qGPTQuestionInput: {
          query: prompt,
          relevant: relevant
        }
      });

      const content = result.answers?.iterable?.[0]?.text || '';
      const duration = Date.now() - startTime;
      
      console.log(`✓ Agent analysis complete (${duration}ms)`);
      
      return {
        success: true,
        content,
        contextAvailable: context.quality,
        duration
      };
    } catch (error) {
      console.error('✗ Agent analysis failed:', error.message);
      return {
        success: false,
        content: null,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  buildAgentPrompt(context) {
    const sections = [];
    
    // Add workstream summaries if available
    if (context.workstreamSummaries.filter(s => s.summary).length > 0) {
      sections.push('## WORKSTREAM SUMMARIES (AI-generated activity summaries):');
      context.workstreamSummaries
        .filter(s => s.summary)
        .slice(0, 5)
        .forEach(s => {
          sections.push(`[${s.application}] ${s.summary.substring(0, 500)}`);
        });
      sections.push('');
    }
    
    // Add vision events if available
    if (context.visionEvents.filter(e => e.textContent).length > 0) {
      sections.push('## RECENT SCREEN CONTEXT (OCR from screenshots):');
      context.visionEvents
        .filter(e => e.textContent)
        .slice(0, 10)
        .forEach(e => {
          sections.push(`[${e.application}] ${e.textContent.substring(0, 200)}`);
        });
      sections.push('');
    }
    
    // Add recent assets
    if (context.assets.length > 0) {
      sections.push('## RECENT SAVED ASSETS:');
      context.assets.slice(0, 10).forEach(a => {
        sections.push(`- ${a.name} [${a.language || 'unknown'}]`);
      });
      sections.push('');
    }
    
    // Add recent files/anchors
    if (context.anchors.length > 0) {
      sections.push('## RECENT FILES:');
      context.anchors.slice(0, 10).forEach(a => {
        sections.push(`- ${a.fullPath || a.name}`);
      });
      sections.push('');
    }
    
    sections.push('## YOUR TASK:');
    sections.push('Analyze this user\'s work context and provide:');
    sections.push('1. What they are currently working on');
    sections.push('2. What blockers or challenges they might have');
    sections.push('3. Specific, actionable suggestions');
    sections.push('4. Quick wins they could achieve');
    
    return sections.join('\n');
  }

  async findRelevantContext(context) {
    try {
      const assetIds = context.assets.slice(0, 10).map(a => a.id).filter(Boolean);
      
      const relevanceInput = {
        qGPTRelevanceInput: {
          query: 'recent work activity projects code',
          options: { database: true }
        }
      };

      if (assetIds.length > 0) {
        relevanceInput.qGPTRelevanceInput.assets = {
          iterable: assetIds
        };
      }

      const result = await this.qgptApi.relevance(relevanceInput);
      return result.relevant || { iterable: [] };
    } catch (error) {
      console.error('✗ Error finding relevant context:', error.message);
      return { iterable: [] };
    }
  }

  extractActivityPatterns(assets) {
    const languages = [...new Set(assets.filter(a => a.language).map(a => a.language))];
    const allTags = [...new Set(assets.flatMap(a => a.tags))];
    
    return {
      languages,
      allTags,
      activityLevel: assets.length
    };
  }

  extractActivityContext(activities, workstreamSummaries) {
    const appUsage = {};
    activities.forEach(activity => {
      const app = activity.application || 'Unknown';
      appUsage[app] = (appUsage[app] || 0) + 1;
    });

    const topApps = Object.entries(appUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, activityCount: count }));

    return {
      topApplications: topApps,
      totalActivities: activities.length
    };
  }

  getStatus() {
    return {
      connected: this.connected,
      registered: this.registered,
      port: this.discoveredPort,
      platform: os.platform()
    };
  }
}

module.exports = new PiecesCopilotService();
