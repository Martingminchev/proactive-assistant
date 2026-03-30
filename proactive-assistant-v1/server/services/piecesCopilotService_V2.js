/**
 * Pieces Copilot Service V2 - Fixed Version
 * 
 * Fixes applied:
 * 1. Workstream Summaries: Correctly extracts text from annotations.iterable
 * 2. Vision Events: Correctly extracts OCR text from textual.ocr.raw
 * 3. Conversations: Fetches messages separately using ConversationMessagesApi
 * 4. OCR Analyses: Removed broken API call (OCR now comes from vision events)
 * 5. Port discovery: Added support for ports 1000, 39300, 5323
 * 6. Application registration: Added proper app registration
 * 7. Data quality indicators: Added quality scoring for each context type
 * 8. Error handling: Added comprehensive try-catch for each API
 */

const pieces = require('@pieces.app/pieces-os-client');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

class PiecesCopilotServiceV2 {
  constructor() {
    this.configuration = null;
    this.appId = null;
    
    // API instances (initialized after connection)
    this.qgptApi = null;
    this.assetsApi = null;
    this.wellKnownApi = null;
    this.activitiesApi = null;
    this.workstreamSummariesApi = null;
    this.workstreamPatternEngineApi = null;
    this.conversationsApi = null;
    this.conversationMessagesApi = null;
    this.anchorsApi = null;
    this.workstreamEventsApi = null;
    this.searchApi = null;
    this.websitesApi = null;
    this.applicationsApi = null;
    
    this.connected = false;
    this.connectionInfo = null;
  }

  /**
   * Discover Pieces OS port by trying multiple ports
   */
  async discoverPort() {
    const platform = os.platform();
    // Priority order: 1000 (newest), 39300 (Windows/Mac default), 5323 (Linux default)
    const portsToTry = platform === 'linux' 
      ? [5323, 1000, 39300] 
      : [1000, 39300, 5323];
    
    for (const port of portsToTry) {
      try {
        const config = new pieces.Configuration({
          basePath: `http://localhost:${port}`
        });
        const wellKnown = new pieces.WellKnownApi(config);
        const health = await wellKnown.getWellKnownHealth();
        
        if (health && (health.startsWith('ok') || health.includes('ok'))) {
          console.log(`✓ Discovered Pieces OS on port ${port}`);
          return { port, config, wellKnown };
        }
      } catch (error) {
        console.log(`  Port ${port} not available: ${error.message}`);
      }
    }
    
    throw new Error('Could not connect to Pieces OS on any port (tried: ' + portsToTry.join(', ') + ')');
  }

  /**
   * Register application with Pieces OS
   */
  async registerApplication() {
    try {
      const appName = `proactive-assistant-${os.hostname()}`;
      const localApplication = await this.applicationsApi.applicationsSnapshot({});
      
      // Check if app already exists
      const existingApp = localApplication.iterable?.find(app => 
        app.name?.toLowerCase().includes('proactive-assistant')
      );
      
      if (existingApp) {
        this.appId = existingApp.id;
        console.log(`✓ Using existing application: ${this.appId}`);
        return this.appId;
      }
      
      // Create new application
      const newApp = await this.applicationsApi.applicationsRegister({
        application: {
          name: appName,
          version: '2.0.0',
          platform: os.platform()
        }
      });
      
      this.appId = newApp.id;
      console.log(`✓ Registered new application: ${this.appId}`);
      return this.appId;
    } catch (error) {
      // Registration might fail if endpoint is deprecated, generate local ID
      this.appId = `proactive-assistant-${uuidv4()}`;
      console.log(`⚠ Application registration failed, using local ID: ${this.appId}`);
      return this.appId;
    }
  }

  async connect() {
    try {
      if (this.connected) {
        return true;
      }
      
      // Step 1: Discover port
      console.log('🔍 Discovering Pieces OS...');
      const discovery = await this.discoverPort();
      this.configuration = discovery.config;
      
      // Step 2: Initialize APIs
      this.qgptApi = new pieces.QGPTApi(this.configuration);
      this.assetsApi = new pieces.AssetsApi(this.configuration);
      this.wellKnownApi = discovery.wellKnown;
      this.activitiesApi = new pieces.ActivitiesApi(this.configuration);
      this.workstreamSummariesApi = new pieces.WorkstreamSummariesApi(this.configuration);
      this.workstreamPatternEngineApi = new pieces.WorkstreamPatternEngineApi(this.configuration);
      this.conversationsApi = new pieces.ConversationsApi(this.configuration);
      this.conversationMessagesApi = new pieces.ConversationMessagesApi(this.configuration);
      this.anchorsApi = new pieces.AnchorsApi(this.configuration);
      this.workstreamEventsApi = new pieces.WorkstreamEventsApi(this.configuration);
      this.searchApi = new pieces.SearchApi(this.configuration);
      this.websitesApi = new pieces.WebsitesApi(this.configuration);
      this.applicationsApi = new pieces.ApplicationsApi(this.configuration);
      
      // Step 3: Register application
      await this.registerApplication();
      
      // Step 4: Health check
      const health = await this.wellKnownApi.getWellKnownHealth();
      
      if (health && (health.startsWith('ok') || health.includes('ok'))) {
        this.connected = true;
        this.connectionInfo = {
          port: discovery.port,
          appId: this.appId,
          platform: os.platform(),
          health
        };
        console.log('✓ Connected to Pieces OS successfully');
        return true;
      } else {
        throw new Error(`Unexpected health response: ${health}`);
      }
    } catch (error) {
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
        console.error('✗ Pieces OS is not running. Please start Pieces OS first.');
      } else {
        console.error('✗ Failed to connect to Pieces OS:', error.message);
      }
      throw error;
    }
  }

  // ============================================
  // DATA EXTRACTION HELPERS (FIXED)
  // ============================================

  /**
   * FIXED: Extract summary text from workstream summary
   * The summary text is stored in annotations.iterable[0].text, not summary.text
   */
  extractSummaryText(summary) {
    // Try multiple possible locations for summary text
    const possibleLocations = [
      () => summary.annotations?.iterable?.[0]?.text,           // Primary location
      () => summary.annotations?.iterable?.[0]?.raw,            // Alternative
      () => summary.name,                                        // Use name as fallback
      () => summary.id?.substring(0, 8),                        // ID as last resort
    ];
    
    for (const getter of possibleLocations) {
      try {
        const text = getter();
        if (text && typeof text === 'string' && text.trim()) {
          return text.trim();
        }
      } catch (e) {
        // Continue to next location
      }
    }
    
    return '';
  }

  /**
   * FIXED: Extract OCR text from vision event
   * The OCR text is stored in textual.ocr.raw, not textContent
   */
  extractVisionText(event) {
    // Try multiple possible locations for vision text
    const possibleLocations = [
      () => event.textual?.ocr?.raw,                            // Primary: OCR raw text
      () => event.textual?.ocr?.string?.raw,                   // Alternative structure
      () => event.textual?.extracted?.raw,                     // Extracted text
      () => event.textual?.extracted?.string?.raw,             // Alternative
      () => event.source?.name,                                // Window name
      () => event.source?.application?.name,                   // Application name
    ];
    
    for (const getter of possibleLocations) {
      try {
        const text = getter();
        if (text && typeof text === 'string' && text.trim()) {
          return text.trim();
        }
      } catch (e) {
        // Continue to next location
      }
    }
    
    return '';
  }

  /**
   * Extract message content from conversation message
   */
  extractMessageContent(message) {
    const possibleLocations = [
      () => message.fragment?.string?.raw,
      () => message.fragment?.string?.text,
      () => message.text,
      () => message.raw,
      () => message.content,
    ];
    
    for (const getter of possibleLocations) {
      try {
        const text = getter();
        if (text && typeof text === 'string' && text.trim()) {
          return text.trim();
        }
      } catch (e) {
        // Continue
      }
    }
    
    return '';
  }

  // ============================================
  // CORE DATA FETCHING METHODS (WITH FIXES)
  // ============================================

  async getRecentAssets(limit = 20) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.assetsApi.assetsSnapshot({});
      const rawAssets = snapshot.iterable?.slice(0, limit) || [];
      
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
      
      return {
        data: assets,
        count: assets.length,
        quality: this.calculateQualityScore(assets, 'assets')
      };
    } catch (error) {
      console.error('✗ Error fetching recent assets:', error.message);
      return { data: [], count: 0, quality: { score: 0, error: error.message } };
    }
  }

  /**
   * FIXED: Workstream Summaries - correctly extracts text from annotations
   */
  async getWorkstreamSummaries(limit = 10) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.workstreamSummariesApi.workstreamSummariesSnapshot({
        transferables: true
      });
      
      const rawSummaries = snapshot.iterable || [];
      
      // Sort by created date (most recent first) and limit
      const sortedSummaries = rawSummaries
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);
      
      // FIXED: Extract data using correct field paths
      const summaries = sortedSummaries.map(summary => {
        const text = this.extractSummaryText(summary);
        const hasAnnotations = !!(summary.annotations?.iterable?.length > 0);
        
        return {
          id: summary.id,
          created: summary.created?.value,
          updated: summary.updated?.value,
          // FIXED: Use the extracted text from annotations
          summary: text,
          summaryLength: text.length,
          hasAnnotations: hasAnnotations,
          annotationCount: summary.annotations?.iterable?.length || 0,
          // Application context
          application: summary.applications?.iterable?.[0]?.name || 
                       summary.application?.name || 
                       'Unknown',
          // Associated assets/content
          assets: summary.assets?.iterable?.map(a => ({
            id: a.id,
            name: a.name
          })) || [],
          // Websites/URLs referenced
          websites: summary.websites?.iterable?.map(w => ({
            url: w.url,
            name: w.name
          })) || [],
          // Anchors (specific locations in files/pages)
          anchors: summary.anchors?.iterable?.map(a => ({
            id: a.id,
            name: a.name,
            fullPath: a.fullpath
          })) || [],
          // People mentioned/involved
          people: summary.persons?.iterable?.map(p => p.name).filter(Boolean) || [],
          // Tags/topics
          tags: summary.tags?.iterable?.map(t => t.text).filter(Boolean) || []
        };
      });
      
      // Calculate quality metrics
      const withContent = summaries.filter(s => s.summaryLength > 0).length;
      
      return {
        data: summaries,
        count: summaries.length,
        withContent,
        quality: {
          score: summaries.length > 0 ? Math.round((withContent / summaries.length) * 100) : 0,
          hasAnnotations: summaries.some(s => s.hasAnnotations),
          averageLength: summaries.reduce((acc, s) => acc + s.summaryLength, 0) / (summaries.length || 1)
        }
      };
    } catch (error) {
      console.error('✗ Error fetching workstream summaries:', error.message);
      return { 
        data: [], 
        count: 0, 
        withContent: 0,
        quality: { score: 0, error: error.message } 
      };
    }
  }

  /**
   * FIXED: Vision Events - correctly extracts OCR text from textual.ocr.raw
   */
  async getVisionEvents(limit = 50) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({
        transferables: true
      });
      
      const rawEvents = snapshot.iterable || [];
      
      // Sort by timestamp (most recent first) and limit
      const sortedEvents = rawEvents
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);

      // FIXED: Extract meaningful data using correct field paths
      const events = sortedEvents.map(event => {
        const ocrText = this.extractVisionText(event);
        
        return {
          id: event.id,
          created: event.created?.value,
          // Source information
          source: {
            name: event.source?.name || '',
            application: event.source?.application?.name || 'Unknown',
            platform: event.source?.platform
          },
          // FIXED: OCR text from textual.ocr.raw
          ocrText: ocrText,
          ocrLength: ocrText.length,
          hasOCR: ocrText.length > 0,
          // Extracted material (if available)
          extracted: event.textual?.extracted ? {
            type: event.textual.extracted.type,
            text: event.textual.extracted.raw || ''
          } : null
        };
      });

      // Calculate quality metrics
      const withOCR = events.filter(e => e.hasOCR).length;
      
      return {
        data: events,
        count: events.length,
        withOCR,
        quality: {
          score: events.length > 0 ? Math.round((withOCR / events.length) * 100) : 0,
          hasVision: events.length > 0,
          averageOCRLength: events.reduce((acc, e) => acc + e.ocrLength, 0) / (events.length || 1)
        }
      };
    } catch (error) {
      console.error('✗ Error fetching vision events:', error.message);
      return { 
        data: [], 
        count: 0, 
        withOCR: 0,
        quality: { score: 0, error: error.message } 
      };
    }
  }

  /**
   * FIXED: Conversations - fetch messages separately using ConversationMessagesApi
   */
  async getConversations(limit = 10) {
    try {
      if (!this.connected) await this.connect();

      // Fetch all messages first (they're separate from conversations)
      let allMessages = [];
      try {
        const messagesSnapshot = await this.conversationMessagesApi.messagesSnapshot({
          transferables: true
        });
        allMessages = messagesSnapshot.iterable || [];
      } catch (msgError) {
        console.log('  ⚠ Could not fetch messages separately:', msgError.message);
      }

      const snapshot = await this.conversationsApi.conversationsSnapshot({
        transferables: true
      });
      
      const rawConversations = snapshot.iterable || [];
      
      // Sort by most recent and limit
      const sortedConversations = rawConversations
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);

      const conversations = sortedConversations.map(convo => {
        // FIXED: Match messages to conversations
        // Messages have a conversation reference
        const convoMessages = allMessages.filter(msg => 
          msg.conversation?.id === convo.id
        );
        
        // Also check if messages are embedded in the conversation
        const embeddedMessages = convo.messages?.iterable || [];
        const allConvoMessages = [...embeddedMessages, ...convoMessages];
        
        return {
          id: convo.id,
          name: convo.name || 'Unnamed Conversation',
          created: convo.created?.value,
          updated: convo.updated?.value,
          type: convo.type,
          // FIXED: Proper message count from combined sources
          messageCount: allConvoMessages.length,
          // Recent messages (last 5)
          recentMessages: allConvoMessages
            .sort((a, b) => {
              const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
              const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
              return dateB - dateA;
            })
            .slice(0, 5)
            .map(msg => ({
              role: msg.role,
              content: this.extractMessageContent(msg).substring(0, 500),
              created: msg.created?.value
            })),
          // Associated assets
          assets: convo.assets?.iterable?.map(a => a.id) || [],
          // Summary/annotations
          summary: convo.annotations?.iterable?.[0]?.text || '',
          model: convo.model?.name || convo.model?.id || 'Unknown'
        };
      });

      // Calculate quality metrics
      const withMessages = conversations.filter(c => c.messageCount > 0).length;
      
      return {
        data: conversations,
        count: conversations.length,
        withMessages,
        quality: {
          score: conversations.length > 0 ? Math.round((withMessages / conversations.length) * 100) : 0,
          totalMessages: conversations.reduce((acc, c) => acc + c.messageCount, 0)
        }
      };
    } catch (error) {
      console.error('✗ Error fetching conversations:', error.message);
      return { 
        data: [], 
        count: 0, 
        withMessages: 0,
        quality: { score: 0, error: error.message } 
      };
    }
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
          sessionEvent: event.session ? { description: 'Session activity' } : null,
          workstreamEvent: event.workstreamSummary ? {
            summaryId: event.workstreamSummary.summary?.id
          } : null,
          rank: activity.rank || 0
        };
      });
      
      return {
        data: activities,
        count: activities.length,
        quality: this.calculateQualityScore(activities, 'activities')
      };
    } catch (error) {
      console.error('✗ Error fetching recent activities:', error.message);
      return { data: [], count: 0, quality: { score: 0, error: error.message } };
    }
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
      
      return {
        data: websites,
        count: websites.length,
        quality: this.calculateQualityScore(websites, 'websites')
      };
    } catch (error) {
      console.error('✗ Error fetching recent websites:', error.message);
      return { data: [], count: 0, quality: { score: 0, error: error.message } };
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

      return {
        data: anchors,
        count: anchors.length,
        quality: this.calculateQualityScore(anchors, 'anchors')
      };
    } catch (error) {
      console.error('✗ Error fetching anchors:', error.message);
      return { data: [], count: 0, quality: { score: 0, error: error.message } };
    }
  }

  async getWorkstreamEvents(limit = 50) {
    try {
      if (!this.connected) await this.connect();

      const snapshot = await this.workstreamEventsApi.workstreamEventsSnapshot({
        transferables: true
      });
      
      const rawEvents = snapshot.iterable || [];
      
      const sortedEvents = rawEvents
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);

      const events = sortedEvents.map(event => ({
        id: event.id,
        created: event.created?.value,
        summary: event.summary?.text || event.summary?.raw || '',
        application: event.application?.name || 'Unknown',
        trigger: event.trigger ? {
          type: event.trigger.type,
          description: event.trigger.description
        } : null,
        workstreamSummaryId: event.workstreamSummary?.id
      }));

      return {
        data: events,
        count: events.length,
        quality: this.calculateQualityScore(events, 'workstreamEvents')
      };
    } catch (error) {
      console.error('✗ Error fetching workstream events:', error.message);
      return { data: [], count: 0, quality: { score: 0, error: error.message } };
    }
  }

  /**
   * REMOVED: getOCRAnalyses - This API was failing
   * OCR text is now obtained from vision events (getVisionEvents)
   */

  async getVisionStatus() {
    try {
      if (!this.connected) await this.connect();

      const status = await this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsVisionStatus();
      
      return {
        active: status.vision || false,
        status: status,
        quality: {
          score: status.vision ? 100 : 0,
          active: status.vision || false
        }
      };
    } catch (error) {
      console.error('✗ Error getting vision status:', error.message);
      return { 
        active: false, 
        status: null, 
        quality: { score: 0, error: error.message } 
      };
    }
  }

  async getVisionSources() {
    try {
      if (!this.connected) await this.connect();

      const sources = await this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsSources();
      const applications = sources.iterable || [];
      
      return {
        data: applications.map(app => ({
          id: app.id,
          name: app.name,
          platform: app.platform
        })),
        count: applications.length,
        quality: this.calculateQualityScore(applications, 'visionSources')
      };
    } catch (error) {
      console.error('✗ Error fetching vision sources:', error.message);
      return { data: [], count: 0, quality: { score: 0, error: error.message } };
    }
  }

  // ============================================
  // QUALITY SCORING
  // ============================================

  calculateQualityScore(data, type) {
    if (!data || data.length === 0) {
      return { score: 0, reason: 'No data available' };
    }

    let score = 100;
    let issues = [];

    switch (type) {
      case 'assets':
        // Check if assets have content
        const assetsWithContent = data.filter(a => a.content && a.content.length > 0).length;
        if (assetsWithContent < data.length * 0.5) {
          score -= 30;
          issues.push('Many assets missing content');
        }
        break;
        
      case 'conversations':
        // Check if conversations have messages
        const convosWithMessages = data.filter(c => c.messageCount > 0).length;
        if (convosWithMessages < data.length * 0.5) {
          score -= 40;
          issues.push('Many conversations missing messages');
        }
        break;
        
      case 'visionEvents':
        // Check if vision events have OCR
        const eventsWithOCR = data.filter(e => e.hasOCR).length;
        if (eventsWithOCR < data.length * 0.3) {
          score -= 50;
          issues.push('Vision events missing OCR text');
        }
        break;
        
      default:
        // Generic quality check
        const withData = data.filter(item => 
          Object.values(item).some(v => v !== null && v !== undefined && v !== '')
        ).length;
        if (withData < data.length * 0.5) {
          score -= 30;
          issues.push('Many items missing data');
        }
    }

    return {
      score: Math.max(0, score),
      count: data.length,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  // ============================================
  // COMPREHENSIVE CONTEXT (FIXED)
  // ============================================

  async getComprehensiveContext() {
    console.log('\n📊 Fetching comprehensive context from all Pieces APIs (V2)...\n');
    
    const startTime = Date.now();
    
    // Fetch all data sources with individual error handling
    const results = await Promise.all([
      this.getVisionStatus().catch(e => ({ error: e.message, quality: { score: 0 } })),
      this.getVisionEvents(30).catch(e => ({ data: [], quality: { score: 0, error: e.message } })),
      this.getVisionSources().catch(e => ({ data: [], quality: { score: 0, error: e.message } })),
      this.getRecentAssets(20).catch(e => ({ data: [], quality: { score: 0, error: e.message } })),
      this.getRecentActivities(50).catch(e => ({ data: [], quality: { score: 0, error: e.message } })),
      this.getWorkstreamSummaries(10).catch(e => ({ data: [], quality: { score: 0, error: e.message } })),
      this.getWorkstreamEvents(30).catch(e => ({ data: [], quality: { score: 0, error: e.message } })),
      this.getConversations(5).catch(e => ({ data: [], quality: { score: 0, error: e.message } })),
      this.getAnchors(20).catch(e => ({ data: [], quality: { score: 0, error: e.message } })),
      this.getRecentWebsites(20).catch(e => ({ data: [], quality: { score: 0, error: e.message } }))
    ]);

    const [
      visionStatus,
      visionEvents,
      visionSources,
      assets,
      activities,
      workstreamSummaries,
      workstreamEvents,
      conversations,
      anchors,
      websites
    ] = results;

    // Calculate overall quality score
    const qualityScores = [
      visionEvents.quality?.score || 0,
      assets.quality?.score || 0,
      activities.quality?.score || 0,
      workstreamSummaries.quality?.score || 0,
      conversations.quality?.score || 0,
      anchors.quality?.score || 0,
      websites.quality?.score || 0
    ];
    
    const overallQuality = Math.round(
      qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    );

    const fetchTime = Date.now() - startTime;
    
    console.log(`\n✓ Comprehensive context fetched in ${fetchTime}ms`);
    console.log(`  Overall Quality Score: ${overallQuality}%`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  - Vision Status: ${visionStatus.active ? '✅ Active' : '❌ Inactive'}`);
    console.log(`  - Vision Events: ${visionEvents.count} (${visionEvents.withOCR || 0} with OCR)`);
    console.log(`  - Vision Sources: ${visionSources.count} apps tracked`);
    console.log(`  - Assets: ${assets.count} items`);
    console.log(`  - Activities: ${activities.count} events`);
    console.log(`  - Workstream Summaries: ${workstreamSummaries.count} (${workstreamSummaries.withContent || 0} with content)`);
    console.log(`  - Workstream Events: ${workstreamEvents.count} events`);
    console.log(`  - Conversations: ${conversations.count} (${conversations.withMessages || 0} with messages)`);
    console.log(`  - Anchors: ${anchors.count} file locations`);
    console.log(`  - Websites: ${websites.count} sites`);

    return {
      // Raw data
      visionStatus: visionStatus.status || null,
      visionEvents: visionEvents.data,
      visionSources: visionSources.data,
      assets: assets.data,
      activities: activities.data,
      workstreamSummaries: workstreamSummaries.data,
      workstreamEvents: workstreamEvents.data,
      conversations: conversations.data,
      anchors: anchors.data,
      websites: websites.data,
      
      // Quality indicators
      quality: {
        overall: overallQuality,
        visionEvents: visionEvents.quality,
        assets: assets.quality,
        activities: activities.quality,
        workstreamSummaries: workstreamSummaries.quality,
        workstreamEvents: workstreamEvents.quality,
        conversations: conversations.quality,
        anchors: anchors.quality,
        websites: websites.quality
      },
      
      // Metadata
      fetchTime,
      timestamp: new Date().toISOString(),
      connectionInfo: this.connectionInfo
    };
  }

  // ============================================
  // COMPREHENSIVE AGENT ANALYSIS (FIXED)
  // ============================================

  async getComprehensiveAgentAnalysis() {
    console.log('\n🧠 Gathering context and querying Pieces Agent (V2)...\n');
    const startTime = Date.now();

    try {
      if (!this.connected) {
        await this.connect();
      }

      // Step 1: Fetch all context data with quality indicators
      console.log('  📦 Fetching context data...');
      
      const [
        anchors,
        websites,
        activities,
        workstreamSummaries,
        visionEvents,
        conversations
      ] = await Promise.all([
        this.getAnchors(30),
        this.getRecentWebsites(30),
        this.getRecentActivities(50),
        this.getWorkstreamSummaries(10),
        this.getVisionEvents(20),
        this.getConversations(5)
      ]);

      const contextTime = Date.now() - startTime;
      console.log(`  ✓ Context fetched in ${contextTime}ms`);
      console.log(`    - Files: ${anchors.count}, Websites: ${websites.count}`);
      console.log(`    - Activities: ${activities.count}, Summaries: ${workstreamSummaries.count}`);
      console.log(`    - Vision Events: ${visionEvents.count} (${visionEvents.withOCR} with OCR)`);
      console.log(`    - Conversations: ${conversations.count} (${conversations.withMessages} with messages)`);

      // Step 2: Build context summary with quality indicators
      const recentFiles = anchors.data
        .slice(0, 15)
        .map(a => a.fullPath || a.name)
        .filter(Boolean);
        
      const recentSites = websites.data
        .slice(0, 15)
        .map(w => `${w.name}: ${w.url}`)
        .filter(Boolean);
        
      const recentApps = this.extractTopApps(activities.data).slice(0, 5);
      
      // FIXED: Use correctly extracted summary texts
      const summaryTexts = workstreamSummaries.data
        .filter(s => s.summaryLength > 0)
        .slice(0, 5)
        .map(s => s.summary);
        
      // FIXED: Use correctly extracted vision context
      const visionContext = visionEvents.data
        .filter(v => v.ocrLength > 0)
        .slice(0, 10)
        .map(v => `${v.source.application}: ${v.ocrText.substring(0, 100)}...`);
        
      // FIXED: Include conversation context
      const conversationContext = conversations.data
        .filter(c => c.messageCount > 0)
        .slice(0, 3)
        .map(c => `${c.name} (${c.messageCount} messages)`);

      // Step 3: Build comprehensive prompt
      const contextBlock = `
## RECENT ACTIVITY DATA FROM YOUR SYSTEM:

### Files Accessed (${recentFiles.length}):
${recentFiles.length > 0 ? recentFiles.map(f => `- ${f}`).join('\n') : '- No recent files tracked'}

### Websites Visited (${recentSites.length}):
${recentSites.length > 0 ? recentSites.map(s => `- ${s}`).join('\n') : '- No recent websites tracked'}

### Applications Used:
${recentApps.length > 0 ? recentApps.map(a => `- ${a.name} (${a.count} activities)`).join('\n') : '- No application data'}

### Work Session Summaries (${summaryTexts.length}):
${summaryTexts.length > 0 ? summaryTexts.map(s => `- ${s.substring(0, 200)}${s.length > 200 ? '...' : ''}`).join('\n') : '- No session summaries available'}

### Screen Context / OCR Text (${visionContext.length} events):
${visionContext.length > 0 ? visionContext.map(v => `- ${v}`).join('\n') : '- No vision/OCR data available'}

### Recent Conversations (${conversationContext.length}):
${conversationContext.length > 0 ? conversationContext.map(c => `- ${c}`).join('\n') : '- No conversation data available'}

### Data Quality Indicators:
- Workstream Summaries: ${workstreamSummaries.quality?.score || 0}% (${workstreamSummaries.withContent}/${workstreamSummaries.count} with content)
- Vision Events with OCR: ${visionEvents.quality?.score || 0}% (${visionEvents.withOCR}/${visionEvents.count} with OCR)
- Conversations with Messages: ${conversations.quality?.score || 0}% (${conversations.withMessages}/${conversations.count} with messages)
      `.trim();

      // Step 4: Query the agent
      console.log('  🤖 Querying agent with context...');
      
      const prompt = `You are analyzing a developer's recent activity. Here is the data captured from their system:

${contextBlock}

Based on this activity data, provide a comprehensive analysis:

1. **Current Focus**: What specific project or task are they working on? Reference actual file paths and websites from the data.

2. **Progress**: What have they accomplished based on the files modified and sites visited?

3. **Blockers**: Any signs of being stuck (repeated visits to same documentation, error-related searches, etc.)?

4. **Research Context**: What topics are they researching based on the websites and documentation visited?

5. **Recommendations**: 3-5 specific, actionable recommendations based on this activity.

6. **Quick Win**: One small thing they could do in the next 15 minutes to make progress.

Be specific and reference the actual data provided above. Note any data quality issues if certain information is missing.`;

      const result = await this.qgptApi.question({
        qGPTQuestionInput: { 
          query: prompt, 
          relevant: { iterable: [] } 
        }
      });

      const analysis = result.answers?.iterable?.[0]?.text || 
                       result.answers?.iterable?.[0]?.string || '';

      const duration = Date.now() - startTime;
      console.log(`  ✓ Analysis complete in ${duration}ms (${analysis.length} chars)`);

      return {
        success: !!analysis && analysis.length > 100,
        content: analysis,
        duration,
        contextAvailable: {
          files: recentFiles.length,
          websites: recentSites.length,
          activities: activities.count,
          summaries: summaryTexts.length,
          visionEvents: visionEvents.count,
          conversations: conversations.count
        },
        quality: {
          workstreamSummaries: workstreamSummaries.quality,
          visionEvents: visionEvents.quality,
          conversations: conversations.quality,
          overall: Math.round(
            ((workstreamSummaries.quality?.score || 0) + 
             (visionEvents.quality?.score || 0) + 
             (conversations.quality?.score || 0)) / 3
          )
        }
      };
    } catch (error) {
      console.error('✗ Error getting comprehensive agent analysis:', error.message);
      return {
        success: false,
        content: '',
        error: error.message,
        contextAvailable: {},
        quality: { overall: 0 }
      };
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  detectAssetType(asset) {
    const classification = asset.original?.reference?.classification;
    if (classification?.generic === 'CODE') return 'code';
    if (asset.websites?.iterable?.length > 0) return 'link';
    if (asset.original?.reference?.fragment?.string?.raw) return 'note';
    return 'other';
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

  extractTopApps(activities) {
    const appCounts = {};
    activities.forEach(a => {
      const app = a.application || 'Unknown';
      appCounts[app] = (appCounts[app] || 0) + 1;
    });
    return Object.entries(appCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }

  // ============================================
  // LEGACY COMPATIBILITY METHODS
  // ============================================

  async askCopilot(query, relevantContext) {
    try {
      if (!this.connected) await this.connect();

      const questionInput = {
        query: query,
        relevant: relevantContext || { iterable: [] }
      };

      const result = await this.qgptApi.question({
        qGPTQuestionInput: questionInput
      });

      if (result.answers?.iterable?.length > 0) {
        const bestAnswer = result.answers.iterable[0];
        return bestAnswer.string || bestAnswer.text || '';
      }

      return null;
    } catch (error) {
      console.error('✗ Error asking Pieces Copilot:', error.message);
      throw error;
    }
  }

  async streamConversation(query, contextAssets = []) {
    try {
      if (!this.connected) await this.connect();

      const streamInput = {
        question: {
          query: query,
          relevant: {
            iterable: contextAssets
          }
        },
        agent: true
      };

      const streamResult = await this.qgptApi.qgptStream({
        qGPTStreamInput: streamInput
      });

      console.log('✓ Stream connection established');
      return streamResult;
    } catch (error) {
      console.error('✗ Error streaming conversation:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PiecesCopilotServiceV2();
