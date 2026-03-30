const pieces = require('@pieces.app/pieces-os-client');
const os = require('os');

class PiecesCopilotService {
  constructor() {
    const platform = os.platform();
    const port = platform === 'linux' ? 5323 : 39300;    
    this.configuration = new pieces.Configuration({
      basePath: `http://localhost:${port}`
    });
    
    this.qgptApi = new pieces.QGPTApi(this.configuration);
    this.assetsApi = new pieces.AssetsApi(this.configuration);
    this.wellKnownApi = new pieces.WellKnownApi(this.configuration);
    this.activitiesApi = new pieces.ActivitiesApi(this.configuration);
    this.workstreamSummariesApi = new pieces.WorkstreamSummariesApi(this.configuration);
    
    // New APIs for comprehensive context
    this.workstreamPatternEngineApi = new pieces.WorkstreamPatternEngineApi(this.configuration);
    this.ocrAnalysesApi = new pieces.OCRAnalysesApi(this.configuration);
    this.imageAnalysesApi = new pieces.ImageAnalysesApi(this.configuration);
    this.conversationsApi = new pieces.ConversationsApi(this.configuration);
    this.anchorsApi = new pieces.AnchorsApi(this.configuration);
    this.workstreamEventsApi = new pieces.WorkstreamEventsApi(this.configuration);
    this.searchApi = new pieces.SearchApi(this.configuration);
    this.websitesApi = new pieces.WebsitesApi(this.configuration);
    
    this.connected = false;
  }

  async connect() {
    try {
      if (this.connected) {
        console.log('Already connected to Pieces OS');
        return;
      }
      
      // Use health check to verify Pieces OS is running
      const health = await this.wellKnownApi.getWellKnownHealth();
      
      if (health.startsWith('ok')) {
        this.connected = true;
        console.log('✓ Connected to Pieces OS');
      } else {
        throw new Error(`Unexpected health response: ${health}`);
      }
    } catch (error) {
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        console.error('✗ Pieces OS is not running. Please start Pieces OS first.');
      } else {
        console.error('✗ Failed to connect to Pieces OS:', error.message);
      }
      throw error;
    }
  }

  async getRecentAssets(limit = 20) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.assetsApi.assetsSnapshot({});
      const rawAssets = snapshot.iterable.slice(0, limit);
      
      // Extract rich context from each asset
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
      
      console.log(`✓ Retrieved ${assets.length} recent assets with rich context`);
      return assets;
    } catch (error) {
      console.error('✗ Error fetching recent assets:', error.message);
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

  extractActivityPatterns(assets) {
    const languages = [...new Set(assets.filter(a => a.language).map(a => a.language))];
    const allTags = [...new Set(assets.flatMap(a => a.tags))];
    const recentWebsites = assets.flatMap(a => a.websites).slice(0, 10);
    const contentTypes = this.countByType(assets);
    
    return {
      languages,
      allTags,
      contentTypes,
      recentWebsites,
      activityLevel: assets.length
    };
  }

  extractActivityContext(activities, workstreamSummaries) {
    // Group activities by application
    const appUsage = {};
    activities.forEach(activity => {
      const app = activity.application || 'Unknown';
      if (!appUsage[app]) {
        appUsage[app] = { count: 0, events: [] };
      }
      appUsage[app].count++;
      
      // Track what kind of events occurred
      if (activity.assetEvent) {
        appUsage[app].events.push({
          type: 'asset',
          action: activity.assetEvent.description
        });
      }
      if (activity.interactionEvent) {
        appUsage[app].events.push({
          type: 'interaction',
          description: activity.interactionEvent.description
        });
      }
    });

    // Extract all websites from workstream summaries
    const allWebsites = [];
    const allAnchors = [];
    const summaryTexts = [];
    const allPeople = new Set();
    const allTags = new Set();

    workstreamSummaries.forEach(summary => {
      if (summary.summary) {
        summaryTexts.push({
          created: summary.created,
          text: summary.summary
        });
      }
      summary.websites?.forEach(w => allWebsites.push(w));
      summary.anchors?.forEach(a => allAnchors.push(a));
      summary.people?.forEach(p => allPeople.add(p));
      summary.tags?.forEach(t => allTags.add(t));
    });

    // Calculate activity timeline
    const now = new Date();
    const last24h = activities.filter(a => {
      if (!a.created) return false;
      const activityDate = new Date(a.created);
      return (now - activityDate) < 24 * 60 * 60 * 1000;
    });

    // Find most active applications
    const topApps = Object.entries(appUsage)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        activityCount: data.count,
        eventTypes: [...new Set(data.events.map(e => e.type))]
      }));

    return {
      // Application usage patterns
      topApplications: topApps,
      totalApplications: Object.keys(appUsage).length,
      
      // Activity metrics
      totalActivities: activities.length,
      activitiesLast24h: last24h.length,
      
      // Workstream insights
      workstreamSummaryCount: workstreamSummaries.length,
      recentSummaries: summaryTexts.slice(0, 5),
      
      // Content accessed
      websitesVisited: allWebsites.slice(0, 15),
      filesAccessed: allAnchors.slice(0, 15),
      
      // People and topics
      peopleInvolved: [...allPeople].slice(0, 10),
      topicsWorkedOn: [...allTags].slice(0, 20),
      
      // High-priority activities (high rank)
      importantActivities: activities
        .filter(a => a.rank && a.rank >= 5)
        .slice(0, 10)
    };
  }

  countByType(assets) {
    return assets.reduce((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {});
  }

  async summarizeContext(assets) {
    try {
      const prompt = `Briefly summarize what this person has been working on based on these saved items: ${JSON.stringify(assets.map(a => ({ name: a.name, type: a.type, tags: a.tags })))}`;
      
      const result = await this.qgptApi.question({
        qGPTQuestionInput: { query: prompt, relevant: { iterable: [] } }
      });
      
      return result.answers?.iterable?.[0]?.text || '';
    } catch (error) {
      console.error('✗ Error summarizing context:', error.message);
      return '';
    }
  }

  async getRecentWebsites(limit = 20) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.websitesApi.websitesSnapshot({});
      const rawWebsites = snapshot.iterable || [];
      
      const websites = rawWebsites.slice(0, limit).map(w => ({
        id: w.id,
        name: w.name || 'Unnamed',
        url: w.url,
        created: w.created?.value,
        updated: w.updated?.value
      }));
      
      console.log(`✓ Retrieved ${websites.length} recent websites`);
      return websites;
    } catch (error) {
      console.error('✗ Error fetching recent websites:', error.message);
      return [];
    }
  }

  async getRecentActivities(limit = 50) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.activitiesApi.activitiesSnapshot({});
      const rawActivities = snapshot.iterable || [];
      
      // Sort by created date (most recent first) and limit
      const sortedActivities = rawActivities
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);
      
      // Extract meaningful data from each activity
      const activities = sortedActivities.map(activity => {
        const event = activity.event || {};
        return {
          id: activity.id,
          created: activity.created?.value,
          application: activity.application?.name || 'Unknown',
          // Event types
          assetEvent: event.asset ? {
            assetId: event.asset.asset?.id,
            description: this.getAssetEventDescription(event.asset)
          } : null,
          interactionEvent: event.interaction ? {
            description: event.interaction.description,
            element: event.interaction.element
          } : null,
          sessionEvent: event.session ? {
            description: 'Session activity'
          } : null,
          workstreamEvent: event.workstreamSummary ? {
            summaryId: event.workstreamSummary.summary?.id
          } : null,
          // Rank indicates importance (higher = more important)
          rank: activity.rank || 0
        };
      });
      
      console.log(`✓ Retrieved ${activities.length} recent activities`);
      return activities;
    } catch (error) {
      console.error('✗ Error fetching recent activities:', error.message);
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

  async getWorkstreamSummaries(limit = 10) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.workstreamSummariesApi.workstreamSummariesSnapshot({});
      const rawSummaries = snapshot.iterable || [];
      
      // Sort by created date (most recent first) and limit
      const sortedSummaries = rawSummaries
        .sort((a, b) => {
          const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
          const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
          return dateB - dateA;
        })
        .slice(0, limit);
      
      // Extract meaningful data from each summary
      const summaries = sortedSummaries.map(summary => ({
        id: summary.id,
        created: summary.created?.value,
        updated: summary.updated?.value,
        // The summary annotation contains the AI-generated description
        summary: summary.summary?.text || summary.summary?.raw || '',
        // Application context
        application: summary.application?.name || 'Unknown',
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
        people: summary.persons?.iterable?.map(p => p.name) || [],
        // Tags/topics
        tags: summary.tags?.iterable?.map(t => t.text) || []
      }));
      
      console.log(`✓ Retrieved ${summaries.length} workstream summaries (LTM roll-ups)`);
      return summaries;
    } catch (error) {
      console.error('✗ Error fetching workstream summaries:', error.message);
      return [];
    }
  }

  async getAssetsByType(type, limit = 5) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.assetsApi.assetsSnapshot({});
      const filtered = snapshot.iterable
        .filter(asset => {
          if (asset.type && typeof asset.type === 'string') {
            return asset.type.toLowerCase().includes(type.toLowerCase());
          }
          return false;
        })
        .slice(0, limit);
      
      console.log(`✓ Retrieved ${filtered.length} assets of type: ${type}`);
      return filtered;
    } catch (error) {
      console.error(`✗ Error fetching assets by type ${type}:`, error.message);
      return [];
    }
  }
  
  async searchAssets(query) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.assetsApi.assetsSnapshot({});
      const results = snapshot.iterable.filter(asset => {
        if (asset.name) {
          return asset.name.toLowerCase().includes(query.toLowerCase());
        }
        return false;
      });
      
      console.log(`✓ Found ${results.length} assets matching: "${query}"`);
      return results;
    } catch (error) {
      console.error('✗ Error searching assets:', error.message);
      return [];
    }
  }

  async findRelevantContext(piecesContext) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const relevanceInput = {
        query: "recent work, code projects, technical tasks, development progress",
        options: {
          database: true
        }
      };

      if (piecesContext.recentAssets && piecesContext.recentAssets.length > 0) {
        relevanceInput.assets = {
          iterable: piecesContext.recentAssets.map(a => a.id).filter(id => id)
        };
      }

      const relevanceResult = await this.qgptApi.relevance({
        qGPTRelevanceInput: relevanceInput
      });

      const relevant = relevanceResult.relevant || { iterable: [] };
      console.log(`✓ Found ${relevant.iterable.length} relevant context items`);
      return relevant;
    } catch (error) {
      console.error('✗ Error finding relevant context:', error.message);
      return { iterable: [] };
    }
  }

  buildDailyBriefPrompt(piecesContext, newsArticles) {
    const contextSummary = `
Recent Work Summary:
- Total Recent Assets: ${piecesContext.totalAssets || 0}
- Recent Code Snippets: ${piecesContext.codeSnippets?.length || 0}
- Work Activity Items: ${piecesContext.recentAssets?.length || 0}

Latest Tech News (Titles):
${newsArticles.map(a => `- ${a.title}`).join('\n')}
    `.trim();

    return `
You are a proactive AI assistant and Chief of Staff for a developer. Based on the following information, generate a daily brief:

${contextSummary}

Your tasks:
1. 💡 Code Improvements: Suggest 2-3 specific improvements for code/workflows based on the user's recent work context. Be practical and actionable.
2. 📰 Relevant News: From the provided news list, recommend 2-3 articles that align with the user's technical interests and recent work. Explain why each is relevant.
3. 🚀 MVP Idea: Propose 1 small, achievable project idea based on the intersection of their recent work and trends from the news.

IMPORTANT: Return your response as valid JSON with this exact structure:
{
  "improvements": [
    {
      "title": "Short descriptive title",
      "description": "Detailed explanation of the improvement suggestion with code examples if applicable",
      "relevanceScore": 8
    }
  ],
  "news": [
    {
      "title": "Article title",
      "description": "Why this is relevant to the user",
      "url": "article_url",
      "relevanceScore": 9
    }
  ],
  "mvpIdea": [
    {
      "title": "Project name",
      "description": "Detailed description of the MVP idea including features and implementation approach"
    }
  ]
}

Keep descriptions concise but detailed enough to be actionable. Relevance scores should be between 0-10.
    `.trim();
  }

  async askCopilot(query, relevantContext) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const questionInput = {
        query: query,
        relevant: relevantContext
      };

      const result = await this.qgptApi.question({
        qGPTQuestionInput: questionInput
      });

      if (result.answers && result.answers.iterable && result.answers.iterable.length > 0) {
        const bestAnswer = result.answers.iterable[0];
        const responseText = bestAnswer.string || bestAnswer.text;
        
        try {
          const parsed = JSON.parse(responseText);
          console.log('✓ Successfully parsed Pieces Copilot response');
          return parsed;
        } catch (parseError) {
          console.error('✗ Failed to parse JSON, attempting to extract...');
          
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.error('✗ Could not extract valid JSON');
            }
          }
          
          console.log('Returning raw response as fallback');
          return {
            improvements: [{
              title: 'Daily Brief',
              description: responseText,
              relevanceScore: 5
            }],
            news: [],
            mvpIdea: []
          };
        }
      }

      console.log('✗ No answers received from Pieces Copilot');
      return null;
    } catch (error) {
      console.error('✗ Error asking Pieces Copilot:', error.message);
      throw error;
    }
  }

  async generateDailyBrief(piecesContext, newsArticles) {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Starting daily brief generation...');
      
      const relevantContext = await this.findRelevantContext(piecesContext);
      const prompt = this.buildDailyBriefPrompt(piecesContext, newsArticles);
      
      const briefData = await this.askCopilot(prompt, relevantContext);
      
      if (!briefData) {
        throw new Error('Failed to generate brief data from Pieces Copilot');
      }

      const generationTime = Date.now() - startTime;
      console.log(`✓ Daily brief generated in ${generationTime}ms`);
      
      return {
        ...briefData,
        generationTime
      };
    } catch (error) {
      console.error('✗ Error generating daily brief:', error.message);
      throw error;
    }
  }

  async streamConversation(query, contextAssets = []) {
    try {
      if (!this.connected) {
        await this.connect();
      }

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

  // ============================================
  // NEW COMPREHENSIVE CONTEXT APIS
  // ============================================

  async getVisionStatus() {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const status = await this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsVisionStatus();
      console.log(`✓ WPE Vision Status: ${status.vision ? 'Active' : 'Inactive'}`);
      return {
        active: status.vision || false,
        status: status
      };
    } catch (error) {
      console.error('✗ Error getting vision status:', error.message);
      return { active: false, status: null };
    }
  }

  async getVisionEvents(limit = 50) {
    try {
      if (!this.connected) {
        await this.connect();
      }

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

      // Extract meaningful data from each vision event
      const events = sortedEvents.map(event => ({
        id: event.id,
        created: event.created?.value,
        application: event.application?.name || 'Unknown',
        // Text content captured from screen (OCR)
        textContent: event.textContent || '',
        // Window/tab title
        title: event.title || '',
        // URL if browser
        url: event.url || '',
        // Screenshot metadata (not the actual image)
        hasScreenshot: !!event.image,
        // Associated anchors (file paths)
        anchors: event.anchors?.iterable?.map(a => ({
          id: a.id,
          fullPath: a.fullpath,
          name: a.name
        })) || [],
        // Tags/topics identified
        tags: event.tags?.iterable?.map(t => t.text) || []
      }));

      console.log(`✓ Retrieved ${events.length} vision events (screen context)`);
      return events;
    } catch (error) {
      console.error('✗ Error fetching vision events:', error.message);
      return [];
    }
  }

  async getVisionSources() {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const sources = await this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsSources();
      const applications = sources.iterable || [];
      
      console.log(`✓ Retrieved ${applications.length} tracked applications`);
      return applications.map(app => ({
        id: app.id,
        name: app.name,
        platform: app.platform
      }));
    } catch (error) {
      console.error('✗ Error fetching vision sources:', error.message);
      return [];
    }
  }

  async getOCRAnalyses(limit = 20) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.ocrAnalysesApi.ocrAnalysesSnapshot({
        transferables: true
      });
      
      const rawAnalyses = snapshot.iterable || [];
      
      // Extract meaningful OCR data
      const analyses = rawAnalyses.slice(0, limit).map(analysis => ({
        id: analysis.id,
        created: analysis.created?.value,
        // The extracted text from the image
        text: analysis.raw || analysis.text || '',
        // Confidence score if available
        confidence: analysis.confidence,
        // Associated image analysis
        imageId: analysis.image?.id
      }));

      console.log(`✓ Retrieved ${analyses.length} OCR analyses (text from screenshots)`);
      return analyses;
    } catch (error) {
      console.error('✗ Error fetching OCR analyses:', error.message);
      return [];
    }
  }

  async getImageAnalyses(limit = 10) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.imageAnalysesApi.imageAnalysesSnapshot({
        transferables: true
      });
      
      const rawAnalyses = snapshot.iterable || [];
      
      const analyses = rawAnalyses.slice(0, limit).map(analysis => ({
        id: analysis.id,
        created: analysis.created?.value,
        // Description/analysis of the image content
        description: analysis.description || '',
        // Associated OCR if any
        ocrId: analysis.ocr?.id,
        // Tags/labels identified in image
        tags: analysis.tags?.iterable?.map(t => t.text) || []
      }));

      console.log(`✓ Retrieved ${analyses.length} image analyses`);
      return analyses;
    } catch (error) {
      console.error('✗ Error fetching image analyses:', error.message);
      return [];
    }
  }

  async getConversations(limit = 10) {
    try {
      if (!this.connected) {
        await this.connect();
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

      const conversations = sortedConversations.map(convo => ({
        id: convo.id,
        name: convo.name || 'Unnamed Conversation',
        created: convo.created?.value,
        updated: convo.updated?.value,
        // Get message summaries
        messageCount: convo.messages?.iterable?.length || 0,
        // Recent messages (last 5)
        recentMessages: (convo.messages?.iterable || []).slice(-5).map(msg => ({
          role: msg.role,
          content: msg.fragment?.string?.raw?.substring(0, 500) || '',
          created: msg.created?.value
        })),
        // Associated assets
        assets: convo.assets?.iterable?.map(a => a.id) || [],
        // Annotations/summary
        summary: convo.annotations?.iterable?.[0]?.text || ''
      }));

      console.log(`✓ Retrieved ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      console.error('✗ Error fetching conversations:', error.message);
      return [];
    }
  }

  async getAnchors(limit = 30) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.anchorsApi.anchorsSnapshot({
        transferables: true
      });
      
      const rawAnchors = snapshot.iterable || [];
      
      // Sort by most recent
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
        // Type of anchor (file, directory, etc.)
        type: anchor.type,
        // Associated assets
        assets: anchor.assets?.iterable?.map(a => ({
          id: a.id,
          name: a.name
        })) || [],
        // Annotation/description
        description: anchor.annotations?.iterable?.[0]?.text || ''
      }));

      console.log(`✓ Retrieved ${anchors.length} anchors (file locations)`);
      return anchors;
    } catch (error) {
      console.error('✗ Error fetching anchors:', error.message);
      return [];
    }
  }

  async getWorkstreamEvents(limit = 50) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const snapshot = await this.workstreamEventsApi.workstreamEventsSnapshot({
        transferables: true
      });
      
      const rawEvents = snapshot.iterable || [];
      
      // Sort by most recent
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
        // Event type and description
        summary: event.summary?.text || event.summary?.raw || '',
        // Associated application
        application: event.application?.name || 'Unknown',
        // Trigger information
        trigger: event.trigger,
        // Associated workstream summary
        workstreamSummaryId: event.workstreamSummary?.id
      }));

      console.log(`✓ Retrieved ${events.length} workstream events`);
      return events;
    } catch (error) {
      console.error('✗ Error fetching workstream events:', error.message);
      return [];
    }
  }

  async neuralSearch(query, limit = 10) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const result = await this.searchApi.neuralCodeSearch({
        query: query
      });
      
      const assets = result.iterable || [];
      console.log(`✓ Neural search found ${assets.length} results for: "${query}"`);
      return assets.slice(0, limit).map(a => ({
        id: a.id,
        name: a.name,
        score: a.score
      }));
    } catch (error) {
      console.error('✗ Error performing neural search:', error.message);
      return [];
    }
  }

  async fullTextSearch(query, limit = 10) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const result = await this.searchApi.fullTextSearch({
        query: query
      });
      
      const assets = result.iterable || [];
      console.log(`✓ Full text search found ${assets.length} results for: "${query}"`);
      return assets.slice(0, limit).map(a => ({
        id: a.id,
        name: a.name,
        score: a.score
      }));
    } catch (error) {
      console.error('✗ Error performing full text search:', error.message);
      return [];
    }
  }

  async getComprehensiveContext() {
    console.log('\n📊 Fetching comprehensive context from all Pieces APIs...\n');
    
    const startTime = Date.now();
    
    // Fetch all data sources in parallel for efficiency
    const [
      visionStatus,
      visionEvents,
      visionSources,
      ocrAnalyses,
      imageAnalyses,
      assets,
      activities,
      workstreamSummaries,
      workstreamEvents,
      conversations,
      anchors,
      websites,
      agentInsights
    ] = await Promise.all([
      this.getVisionStatus(),
      this.getVisionEvents(30),
      this.getVisionSources(),
      this.getOCRAnalyses(15),
      this.getImageAnalyses(10),
      this.getRecentAssets(20),
      this.getRecentActivities(50),
      this.getWorkstreamSummaries(10),
      this.getWorkstreamEvents(30),
      this.getConversations(5),
      this.getAnchors(20),
      this.getRecentWebsites(20),
      this.queryAgentForContext()
    ]);

    // Extract patterns from all data
    const assetPatterns = this.extractActivityPatterns(assets);
    const activityContext = this.extractActivityContext(activities, workstreamSummaries);
    
    // Identify current focus based on recent vision events
    const currentFocus = this.identifyCurrentFocus(visionEvents, anchors);
    
    // Extract recent screen text (OCR)
    const recentScreenText = ocrAnalyses
      .filter(o => o.text)
      .map(o => o.text)
      .slice(0, 5);

    const fetchTime = Date.now() - startTime;
    
    console.log(`\n✓ Comprehensive context fetched in ${fetchTime}ms`);
    console.log(`  - Vision Events: ${visionEvents.length}`);
    console.log(`  - OCR Analyses: ${ocrAnalyses.length}`);
    console.log(`  - Image Analyses: ${imageAnalyses.length}`);
    console.log(`  - Assets: ${assets.length}`);
    console.log(`  - Activities: ${activities.length}`);
    console.log(`  - Workstream Summaries: ${workstreamSummaries.length}`);
    console.log(`  - Workstream Events: ${workstreamEvents.length}`);
    console.log(`  - Conversations: ${conversations.length}`);
    console.log(`  - Anchors: ${anchors.length}`);
    console.log(`  - Websites: ${websites.length}`);
    console.log(`  - Agent Insights: ${agentInsights.length}`);
    console.log(`  - WPE Active: ${visionStatus.active}`);
    
    return {
      // Raw data
      visionStatus,
      visionEvents,
      visionSources,
      ocrAnalyses,
      imageAnalyses,
      assets,
      activities,
      workstreamSummaries,
      workstreamEvents,
      conversations,
      anchors,
      websites,
      agentInsights,
      
      // Processed patterns
      patterns: assetPatterns,
      activityContext,
      currentFocus,
      recentScreenText,
      
      // Metadata
      fetchTime,
      timestamp: new Date().toISOString()
    };
  }

  identifyCurrentFocus(visionEvents, anchors) {
    // Analyze recent vision events to determine current focus
    const recentEvents = visionEvents.slice(0, 10);
    
    // Count applications
    const appCounts = {};
    recentEvents.forEach(event => {
      const app = event.application;
      appCounts[app] = (appCounts[app] || 0) + 1;
    });
    
    // Find most active application
    const topApp = Object.entries(appCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    // Get recent file paths from anchors
    const recentFiles = anchors
      .filter(a => a.fullPath)
      .slice(0, 5)
      .map(a => a.fullPath);
    
    // Get recent URLs from vision events
    const recentUrls = recentEvents
      .filter(e => e.url)
      .map(e => e.url)
      .slice(0, 5);
    
    // Get recent window titles
    const recentTitles = recentEvents
      .filter(e => e.title)
      .map(e => e.title)
      .slice(0, 5);

    // Aggregate tags from recent events
    const allTags = recentEvents.flatMap(e => e.tags);
    const tagCounts = {};
    allTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    return {
      currentApplication: topApp ? topApp[0] : 'Unknown',
      applicationUsage: appCounts,
      recentFiles,
      recentUrls,
      recentTitles,
      topTags,
      activityLevel: recentEvents.length
    };
  }

  // ============================================
  // AGENT QUERIES FOR DEEPER CONTEXT
  // ============================================

  async queryAgentForContext() {
    console.log('\n🔍 Querying Pieces agent for deeper context...\n');
    
    try {
      if (!this.connected) {
        await this.connect();
      }

      // Ask specific questions to gather deeper context
      const questions = [
        'What technologies and programming languages have I been actively using recently?',
        'What specific problems or challenges have I been trying to solve?',
        'What are the main projects or tasks I\'ve been working on?',
        'What websites and resources have I been researching frequently in my browser?',
        'Based on my recent browser and application activity, what is my current focus?',
        'Are there any recurring roadblocks or errors I have encountered in the last few hours?'
      ];

      const responses = [];
      
      for (const question of questions) {
        try {
          const result = await this.qgptApi.question({
            qGPTQuestionInput: { 
              query: question, 
              relevant: { iterable: [] }
            }
          });
          
          const answer = result.answers?.iterable?.[0]?.text || 
                        result.answers?.iterable?.[0]?.string || '';
          
          if (answer) {
            responses.push({
              question,
              answer: answer.substring(0, 500)
            });
          }
        } catch (e) {
          console.log(`  ⚠ Could not get answer for: "${question.substring(0, 40)}..."`);
        }
      }

      console.log(`✓ Got ${responses.length} context insights from Pieces agent`);
      return responses;
    } catch (error) {
      console.error('✗ Error querying agent for context:', error.message);
      return [];
    }
  }

  async getAgentInsights(topic) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const result = await this.qgptApi.question({
        qGPTQuestionInput: {
          query: `Based on my recent activity, provide insights about: ${topic}`,
          relevant: { iterable: [] }
        }
      });

      return result.answers?.iterable?.[0]?.text || 
             result.answers?.iterable?.[0]?.string || '';
    } catch (error) {
      console.error('✗ Error getting agent insights:', error.message);
      return '';
    }
  }

  async getContextualRecommendation(context) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const prompt = `Based on the following context about the user's recent activity, suggest ONE specific and actionable recommendation:
      
Context: ${JSON.stringify(context).substring(0, 2000)}

Provide a helpful, specific recommendation that would be useful for this person right now.`;

      const result = await this.qgptApi.question({
        qGPTQuestionInput: {
          query: prompt,
          relevant: { iterable: [] }
        }
      });

      return result.answers?.iterable?.[0]?.text || 
             result.answers?.iterable?.[0]?.string || '';
    } catch (error) {
      console.error('✗ Error getting contextual recommendation:', error.message);
      return '';
    }
  }

  // ============================================
  // COMPREHENSIVE AGENT ANALYSIS (NEW SIMPLIFIED APPROACH)
  // ============================================

  async getComprehensiveAgentAnalysis() {
    console.log('\n🧠 Gathering context and querying Pieces Agent...\n');
    const startTime = Date.now();

    try {
      if (!this.connected) {
        await this.connect();
      }

      // Step 1: Fetch raw context data to provide to the agent
      console.log('  📦 Fetching context data...');
      const [anchors, websites, activities, workstreamSummaries, visionEvents] = await Promise.all([
        this.getAnchors(30).catch(() => []),
        this.getRecentWebsites(30).catch(() => []),
        this.getRecentActivities(50).catch(() => []),
        this.getWorkstreamSummaries(10).catch(() => []),
        this.getVisionEvents(20).catch(() => [])
      ]);

      const contextTime = Date.now() - startTime;
      console.log(`  ✓ Context fetched in ${contextTime}ms`);
      console.log(`    - Files: ${anchors.length}, Websites: ${websites.length}`);
      console.log(`    - Activities: ${activities.length}, Summaries: ${workstreamSummaries.length}`);
      console.log(`    - Vision Events: ${visionEvents.length}`);

      // Step 2: Build context summary for the agent
      const recentFiles = anchors.slice(0, 15).map(a => a.fullPath || a.name).filter(Boolean);
      const recentSites = websites.slice(0, 15).map(w => `${w.name}: ${w.url}`).filter(Boolean);
      const recentApps = this.extractTopApps(activities).slice(0, 5);
      const summaryTexts = workstreamSummaries.slice(0, 5).map(s => s.summary || s.text).filter(Boolean);
      const visionContext = visionEvents.slice(0, 10).map(v => v.application?.name || v.name).filter(Boolean);

      const contextBlock = `
## RECENT ACTIVITY DATA FROM YOUR SYSTEM:

### Files Accessed (${recentFiles.length}):
${recentFiles.length > 0 ? recentFiles.map(f => `- ${f}`).join('\n') : '- No recent files tracked'}

### Websites Visited (${recentSites.length}):
${recentSites.length > 0 ? recentSites.map(s => `- ${s}`).join('\n') : '- No recent websites tracked'}

### Applications Used:
${recentApps.length > 0 ? recentApps.map(a => `- ${a.name} (${a.count} activities)`).join('\n') : '- No application data'}

### Work Session Summaries:
${summaryTexts.length > 0 ? summaryTexts.map(s => `- ${s.substring(0, 200)}`).join('\n') : '- No session summaries available'}

### Recent Screen Context:
${visionContext.length > 0 ? visionContext.join(', ') : 'No vision data'}
      `.trim();

      // Step 3: Query the agent with the context
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

Be specific and reference the actual data provided above. If certain data is missing, acknowledge it but still provide useful analysis based on what is available.`;

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

      // Include metadata about what context was available
      return {
        success: !!analysis && analysis.length > 100,
        content: analysis,
        duration,
        contextAvailable: {
          files: recentFiles.length,
          websites: recentSites.length,
          activities: activities.length,
          summaries: summaryTexts.length,
          visionEvents: visionContext.length
        }
      };
    } catch (error) {
      console.error('✗ Error getting comprehensive agent analysis:', error.message);
      return {
        success: false,
        content: '',
        error: error.message,
        contextAvailable: {}
      };
    }
  }

  // ============================================
  // MULTI-STAGE INTELLIGENCE GATHERING (LEGACY)
  // ============================================

  async getMultiStageIntelligence() {
    console.log('\n🧠 Starting multi-stage intelligence gathering from Pieces...\n');
    const startTime = Date.now();

    try {
      if (!this.connected) {
        await this.connect();
      }

      // Stage 1: Work Stream Summary - High-level focus and project progress
      const workStreamPrompt = `Analyze my recent activity and provide a concise summary of:
1. What projects or tasks I've been actively working on
2. My current primary focus area
3. Key accomplishments or progress made in the last 24 hours
4. Any patterns in my work rhythm (e.g., concentrated coding sessions, research phases)

Be specific - reference actual file names, project names, or topics you can see in my activity.`;

      // Stage 2: Technical Deep Dive - Code patterns, libraries, and logic
      const technicalPrompt = `Based on my recent coding activity, provide technical insights:
1. What programming languages and frameworks am I actively using?
2. What specific code patterns or architectures am I implementing?
3. What libraries, APIs, or tools have I been working with?
4. Are there any code quality observations or potential improvements?

Reference specific files, functions, or code snippets where possible.`;

      // Stage 3: Browser & Research Context - Research topics and documentation
      const researchPrompt = `Analyze my browser and research activity:
1. What topics or technologies am I actively researching?
2. What documentation, tutorials, or resources have I been consulting?
3. What problems am I trying to solve based on my search patterns?
4. Are there any learning paths or skill development areas evident?

Include specific URLs, article titles, or documentation pages if visible.`;

      // Stage 4: Blocker Analysis - Errors and frustration patterns
      const blockerPrompt = `Identify potential roadblocks or challenges:
1. Are there any recurring errors or issues I've been encountering?
2. Do you see patterns suggesting I'm stuck on a particular problem?
3. Are there any context switches suggesting difficulty or distraction?
4. What technical challenges might benefit from guidance or a different approach?

Be specific about error messages, problematic code areas, or repeated attempts at something.`;

      // Execute all stages in parallel for efficiency
      const [workStream, technical, research, blockers] = await Promise.all([
        this.queryAgentStage('workStream', workStreamPrompt),
        this.queryAgentStage('technical', technicalPrompt),
        this.queryAgentStage('research', researchPrompt),
        this.queryAgentStage('blockers', blockerPrompt)
      ]);

      // Also fetch raw counts for context metadata
      const [anchors, websites, activities] = await Promise.all([
        this.getAnchors(30),
        this.getRecentWebsites(20),
        this.getRecentActivities(50)
      ]);

      const fetchTime = Date.now() - startTime;
      console.log(`\n✓ Multi-stage intelligence gathered in ${fetchTime}ms`);

      return {
        stages: {
          workStream,
          technical,
          research,
          blockers
        },
        metadata: {
          filesAccessed: anchors.length,
          websitesVisited: websites.length,
          totalActivities: activities.length,
          topApplications: this.extractTopApps(activities),
          fetchTime,
          timestamp: new Date().toISOString()
        },
        // Include raw data for additional context
        rawData: {
          recentFiles: anchors.slice(0, 10).map(a => a.fullPath || a.name),
          recentWebsites: websites.slice(0, 10).map(w => ({ name: w.name, url: w.url }))
        }
      };
    } catch (error) {
      console.error('✗ Error in multi-stage intelligence gathering:', error.message);
      return {
        stages: {
          workStream: { success: false, content: '' },
          technical: { success: false, content: '' },
          research: { success: false, content: '' },
          blockers: { success: false, content: '' }
        },
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString()
        },
        rawData: { recentFiles: [], recentWebsites: [] }
      };
    }
  }

  async queryAgentStage(stageName, prompt) {
    console.log(`  📍 Stage: ${stageName}...`);
    try {
      const result = await this.qgptApi.question({
        qGPTQuestionInput: {
          query: prompt,
          relevant: { iterable: [] }
        }
      });

      const content = result.answers?.iterable?.[0]?.text ||
                      result.answers?.iterable?.[0]?.string || '';

      if (content) {
        console.log(`    ✓ ${stageName}: Got ${content.length} chars`);
        return { success: true, content };
      } else {
        console.log(`    ⚠ ${stageName}: No content returned`);
        return { success: false, content: '' };
      }
    } catch (error) {
      console.log(`    ✗ ${stageName}: ${error.message}`);
      return { success: false, content: '', error: error.message };
    }
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
  // RAW CONTEXT FOR AI - NO FIELD MAPPING
  // ============================================

  async getRawContext() {
    console.log('\n📊 Fetching RAW context from Pieces APIs (for AI parsing)...\n');
    
    const startTime = Date.now();
    
    try {
      if (!this.connected) {
        await this.connect();
      }

      // Fetch raw responses from all APIs in parallel
      const [
        visionSnapshot,
        activitiesSnapshot,
        summariesSnapshot,
        anchorsSnapshot,
        assetsSnapshot,
        conversationsSnapshot,
        websitesSnapshot,
        ocrSnapshot,
        imageSnapshot,
        workstreamEventsSnapshot,
        visionSources,
        agentInsights
      ] = await Promise.all([
        this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({ transferables: true }).catch(e => ({ iterable: [] })),
        this.activitiesApi.activitiesSnapshot({}).catch(e => ({ iterable: [] })),
        this.workstreamSummariesApi.workstreamSummariesSnapshot({}).catch(e => ({ iterable: [] })),
        this.anchorsApi.anchorsSnapshot({ transferables: true }).catch(e => ({ iterable: [] })),
        this.assetsApi.assetsSnapshot({}).catch(e => ({ iterable: [] })),
        this.conversationsApi.conversationsSnapshot({ transferables: true }).catch(e => ({ iterable: [] })),
        this.websitesApi.websitesSnapshot({}).catch(e => ({ iterable: [] })),
        this.ocrAnalysesApi.ocrAnalysesSnapshot({ transferables: true }).catch(e => ({ iterable: [] })),
        this.imageAnalysesApi.imageAnalysesSnapshot({ transferables: true }).catch(e => ({ iterable: [] })),
        this.workstreamEventsApi.workstreamEventsSnapshot({ transferables: true }).catch(e => ({ iterable: [] })),
        this.getVisionSources().catch(e => []),
        this.queryAgentForContext().catch(e => [])
      ]);

      // Get counts for logging
      const visionCount = visionSnapshot.iterable?.length || 0;
      const activitiesCount = activitiesSnapshot.iterable?.length || 0;
      const summariesCount = summariesSnapshot.iterable?.length || 0;
      const anchorsCount = anchorsSnapshot.iterable?.length || 0;
      const assetsCount = assetsSnapshot.iterable?.length || 0;
      const conversationsCount = conversationsSnapshot.iterable?.length || 0;
      const websitesCount = websitesSnapshot.iterable?.length || 0;
      const ocrCount = ocrSnapshot.iterable?.length || 0;
      const imageCount = imageSnapshot.iterable?.length || 0;
      const workstreamEventsCount = workstreamEventsSnapshot.iterable?.length || 0;

      console.log(`  - Vision Events: ${visionCount}`);
      console.log(`  - Activities: ${activitiesCount}`);
      console.log(`  - Workstream Summaries: ${summariesCount}`);
      console.log(`  - Anchors: ${anchorsCount}`);
      console.log(`  - Assets: ${assetsCount}`);
      console.log(`  - Conversations: ${conversationsCount}`);
      console.log(`  - Websites: ${websitesCount}`);
      console.log(`  - OCR Analyses: ${ocrCount}`);
      console.log(`  - Image Analyses: ${imageCount}`);
      console.log(`  - Workstream Events: ${workstreamEventsCount}`);
      console.log(`  - Agent Insights: ${agentInsights.length}`);

      // Truncate to manage token limits and stringify for AI
      // Use a custom replacer to handle circular references and limit depth
      const safeStringify = (obj, limit) => {
        try {
          const items = (obj.iterable || obj || []).slice(0, limit);
          return JSON.stringify(items, (key, value) => {
            // Skip very large binary/base64 data
            if (typeof value === 'string' && value.length > 1000) {
              return value.substring(0, 500) + '... [truncated]';
            }
            // Skip circular references
            if (key === 'schema' || key === 'format' || key === 'formats') {
              return undefined;
            }
            return value;
          }, 2);
        } catch (e) {
          return '[]';
        }
      };

      const fetchTime = Date.now() - startTime;
      console.log(`\n✓ Raw context fetched in ${fetchTime}ms`);

      return {
        visionEvents: safeStringify(visionSnapshot, 10),
        activities: safeStringify(activitiesSnapshot, 20),
        workstreamSummaries: safeStringify(summariesSnapshot, 5),
        anchors: safeStringify(anchorsSnapshot, 15),
        assets: safeStringify(assetsSnapshot, 10),
        conversations: safeStringify(conversationsSnapshot, 3),
        websites: safeStringify(websitesSnapshot, 15),
        ocrAnalyses: safeStringify(ocrSnapshot, 5),
        imageAnalyses: safeStringify(imageSnapshot, 5),
        workstreamEvents: safeStringify(workstreamEventsSnapshot, 10),
        visionSources: JSON.stringify(visionSources),
        agentInsights: JSON.stringify(agentInsights),
        metadata: {
          fetchTime,
          timestamp: new Date().toISOString(),
          counts: {
            visionEvents: visionCount,
            activities: activitiesCount,
            workstreamSummaries: summariesCount,
            anchors: anchorsCount,
            assets: assetsCount,
            conversations: conversationsCount,
            websites: websitesCount,
            ocrAnalyses: ocrCount,
            imageAnalyses: imageCount,
            workstreamEvents: workstreamEventsCount,
            agentInsights: agentInsights.length
          }
        }
      };
    } catch (error) {
      console.error('✗ Error fetching raw context:', error.message);
      return {
        visionEvents: '[]',
        activities: '[]',
        workstreamSummaries: '[]',
        anchors: '[]',
        assets: '[]',
        conversations: '[]',
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

module.exports = new PiecesCopilotService();
