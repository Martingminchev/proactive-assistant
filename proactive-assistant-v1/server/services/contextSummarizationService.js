/**
 * ContextSummarizationService
 * 
 * An optimal context summarization system that transforms raw Pieces OS data
 * into AI-optimized context within a strict token budget.
 * 
 * Architecture: Multi-layer pipeline (Intake → Filter → Prioritize → Synthesize → Output)
 * Token Budget: 4000 tokens maximum for context
 * Priority Order: Current Focus → Blockers → Active Projects → General Activity → Patterns
 */

const pieces = require('@pieces.app/pieces-os-client');
const os = require('os');

/**
 * Token counter for budget management
 * Uses conservative estimates: ~4 chars/token for English text
 */
class TokenCounter {
  constructor() {
    this.CHAR_PER_TOKEN = 4;
    this.OVERHEAD_TOKENS = 50; // JSON structure, formatting overhead
  }

  /**
   * Estimate token count for text
   * @param {string} text - Text to count
   * @returns {number} Estimated token count
   */
  estimate(text) {
    if (!text) return 0;
    return Math.ceil(text.length / this.CHAR_PER_TOKEN) + this.OVERHEAD_TOKENS;
  }

  /**
   * Estimate tokens for an object (when serialized to JSON)
   * @param {Object} obj - Object to count
   * @returns {number} Estimated token count
   */
  estimateObject(obj) {
    return this.estimate(JSON.stringify(obj));
  }

  /**
   * Check if adding content would exceed budget
   * @param {number} current - Current token count
   * @param {string|Object} addition - Content to add
   * @param {number} budget - Token budget
   * @returns {boolean} True if within budget
   */
  canAdd(current, addition, budget = 4000) {
    const additionTokens = typeof addition === 'string' 
      ? this.estimate(addition) 
      : this.estimateObject(addition);
    return (current + additionTokens) <= budget;
  }
}

/**
 * Temporal weighting calculator
 * More recent items get higher scores
 */
class TemporalWeightCalculator {
  /**
   * Calculate temporal weight based on age
   * @param {Date|string} timestamp - Item timestamp
   * @param {Object} options - Weighting options
   * @returns {number} Weight between 0 and 1
   */
  static calculate(timestamp, options = {}) {
    const {
      halflife = 3600000, // 1 hour default
      maxAge = 86400000,   // 24 hours cutoff
      now = Date.now()
    } = options;

    const age = now - new Date(timestamp).getTime();
    
    // Beyond max age, weight is 0
    if (age > maxAge) return 0;
    
    // Exponential decay: weight = 0.5^(age/halflife)
    return Math.exp(-age / halflife * Math.LN2);
  }

  /**
   * Get time-based priority multiplier
   * @param {Date|string} timestamp - Item timestamp
   * @returns {number} Priority multiplier (1.0 to 3.0)
   */
  static getPriorityMultiplier(timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    const hours = age / 3600000;
    
    if (hours < 0.25) return 3.0;      // Last 15 min
    if (hours < 1) return 2.5;         // Last hour
    if (hours < 4) return 2.0;         // Last 4 hours
    if (hours < 8) return 1.5;         // Last 8 hours
    if (hours < 24) return 1.2;        // Last 24 hours
    return 1.0;                         // Older
  }
}

/**
 * Smart deduplication engine
 */
class DeduplicationEngine {
  constructor() {
    this.seen = new Map(); // key → { count, lastSeen, mergedData }
  }

  /**
   * Generate a deduplication key for an item
   * @param {Object} item - Item to key
   * @param {string} type - Item type
   * @returns {string} Deduplication key
   */
  generateKey(item, type) {
    switch (type) {
      case 'file':
        // Normalize path for dedup
        return `file:${(item.fullPath || item.name || '').toLowerCase().trim()}`;
      
      case 'website':
        // Normalize URL (remove query params, fragments)
        const url = (item.url || '').toLowerCase().split('?')[0].split('#')[0];
        return `website:${url}`;
      
      case 'project':
        return `project:${(item.name || item.topic || '').toLowerCase().trim()}`;
      
      case 'tag':
        return `tag:${(item.text || item).toLowerCase().trim()}`;
      
      default:
        return `${type}:${JSON.stringify(item).substring(0, 100)}`;
    }
  }

  /**
   * Add item to deduplication tracking
   * @param {Object} item - Item to track
   * @param {string} type - Item type
   * @returns {Object|null} Merged item if duplicate, null if new
   */
  track(item, type) {
    const key = this.generateKey(item, type);
    const existing = this.seen.get(key);
    
    if (existing) {
      // Merge with existing
      existing.count++;
      existing.lastSeen = new Date(Math.max(
        new Date(existing.lastSeen).getTime(),
        new Date(item.created || Date.now()).getTime()
      ));
      
      // Merge tags/topics
      if (item.tags) {
        existing.mergedData.tags = [...new Set([...(existing.mergedData.tags || []), ...item.tags])];
      }
      
      return existing.mergedData;
    }
    
    this.seen.set(key, {
      count: 1,
      firstSeen: item.created || new Date(),
      lastSeen: item.created || new Date(),
      mergedData: { ...item, _occurrences: 1 }
    });
    
    return null;
  }

  /**
   * Check if item is a duplicate
   * @param {Object} item - Item to check
   * @param {string} type - Item type
   * @returns {boolean} True if duplicate
   */
  isDuplicate(item, type) {
    const key = this.generateKey(item, type);
    return this.seen.has(key);
  }

  /**
   * Get deduplicated items with occurrence counts
   * @returns {Array} Items with _occurrences field
   */
  getDeduplicatedItems() {
    return Array.from(this.seen.values())
      .map(entry => ({
        ...entry.mergedData,
        _occurrences: entry.count,
        _firstSeen: entry.firstSeen,
        _lastSeen: entry.lastSeen
      }))
      .sort((a, b) => b._occurrences - a._occurrences);
  }

  /**
   * Reset deduplication state
   */
  reset() {
    this.seen.clear();
  }
}

/**
 * Main ContextSummarizationService class
 */
class ContextSummarizationService {
  constructor() {
    const platform = os.platform();
    const port = platform === 'linux' ? 5323 : 39300;
    
    this.configuration = new pieces.Configuration({
      basePath: `http://localhost:${port}`
    });

    // Initialize Pieces APIs
    this.qgptApi = new pieces.QGPTApi(this.configuration);
    this.assetsApi = new pieces.AssetsApi(this.configuration);
    this.wellKnownApi = new pieces.WellKnownApi(this.configuration);
    this.activitiesApi = new pieces.ActivitiesApi(this.configuration);
    this.workstreamSummariesApi = new pieces.WorkstreamSummariesApi(this.configuration);
    this.workstreamPatternEngineApi = new pieces.WorkstreamPatternEngineApi(this.configuration);
    this.ocrAnalysesApi = new pieces.OCRAnalysesApi(this.configuration);
    this.imageAnalysesApi = new pieces.ImageAnalysesApi(this.configuration);
    this.conversationsApi = new pieces.ConversationsApi(this.configuration);
    this.anchorsApi = new pieces.AnchorsApi(this.configuration);
    this.websitesApi = new pieces.WebsitesApi(this.configuration);
    this.workstreamEventsApi = new pieces.WorkstreamEventsApi(this.configuration);

    // Internal utilities
    this.tokenCounter = new TokenCounter();
    this.dedupEngine = new DeduplicationEngine();
    
    // Configuration
    this.config = {
      maxTokens: 4000,
      maxCurrentFocusItems: 20,
      maxBlockers: 5,
      maxProjects: 5,
      maxActivities: 15,
      maxPatterns: 5,
      recentWindowMs: 15 * 60 * 1000, // 15 minutes
      focusWindowMs: 60 * 60 * 1000,  // 1 hour
      blockerKeywords: ['error', 'bug', 'fix', 'fail', 'crash', 'exception', 'broken', 'issue', 'problem', 'stuck']
    };

    this.connected = false;
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  /**
   * Connect to Pieces OS
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) return;

    try {
      const health = await this.wellKnownApi.getWellKnownHealth();
      if (health.startsWith('ok')) {
        this.connected = true;
        console.log('✓ ContextSummarizationService connected to Pieces OS');
      }
    } catch (error) {
      console.error('✗ Failed to connect to Pieces OS:', error.message);
      throw error;
    }
  }

  // ============================================
  // MAIN ENTRY POINT
  // ============================================

  /**
   * Main entry point - synthesizes raw context into AI-optimized digest
   * 
   * @param {Object} rawContext - Optional pre-fetched context. If not provided, will fetch
   * @param {Object} options - Synthesis options
   * @returns {Promise<Object>} { digest, metadata, confidence }
   */
  async synthesizeContext(rawContext = null, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!this.connected) await this.connect();

      console.log('\n🔄 Starting context synthesis...\n');

      // Step 1: Intake - Fetch or validate raw data
      const context = rawContext || await this.fetchRawContext();
      
      // Step 2: Filter - Remove noise, extract relevant items
      const filtered = await this.filterContext(context);
      
      // Step 3: Prioritize - Rank by importance
      const prioritized = this.prioritizeContext(filtered);
      
      // Step 4: Synthesize - Condense into digestible chunks
      const synthesized = this.synthesizeToChunks(prioritized, options);
      
      // Step 5: Build output with token budget
      const digest = this.buildDigest(synthesized);

      const duration = Date.now() - startTime;
      
      console.log(`\n✓ Context synthesis complete in ${duration}ms`);
      console.log(`  Tokens used: ${digest.tokenCount}/${this.config.maxTokens}`);
      console.log(`  Confidence: ${(digest.confidence.overall * 100).toFixed(1)}%`);

      return {
        digest: digest.content,
        metadata: {
          duration,
          tokenCount: digest.tokenCount,
          itemsProcessed: filtered.totalItems,
          itemsIncluded: digest.itemCount,
          dataSources: Object.keys(context).filter(k => !k.startsWith('_'))
        },
        confidence: digest.confidence
      };

    } catch (error) {
      console.error('✗ Context synthesis failed:', error.message);
      return this.generateFallbackDigest(error);
    }
  }

  // ============================================
  // INTAKE LAYER - Data Fetching
  // ============================================

  /**
   * Fetch raw context from all Pieces APIs
   * @returns {Promise<Object>} Raw context from all sources
   */
  async fetchRawContext() {
    console.log('  📥 Fetching raw context from Pieces APIs...');
    const startTime = Date.now();

    const [
      visionEvents,
      activities,
      workstreamSummaries,
      assets,
      conversations,
      anchors,
      websites,
      ocrAnalyses,
      workstreamEvents
    ] = await Promise.all([
      this.getVisionEvents(100).catch(() => []),
      this.getActivities(50).catch(() => []),
      this.getWorkstreamSummaries(20).catch(() => []),
      this.getAssets(20).catch(() => []),
      this.getConversations(5).catch(() => []),
      this.getAnchors(30).catch(() => []),
      this.getWebsites(50).catch(() => []),
      this.getOCRAnalyses(20).catch(() => []),
      this.getWorkstreamEvents(30).catch(() => [])
    ]);

    const fetchTime = Date.now() - startTime;
    console.log(`  ✓ Fetched raw context in ${fetchTime}ms`);

    return {
      visionEvents,
      activities,
      workstreamSummaries,
      assets,
      conversations,
      anchors,
      websites,
      ocrAnalyses,
      workstreamEvents,
      _fetchTime: fetchTime,
      _timestamp: new Date().toISOString()
    };
  }

  // Individual API wrappers with data extraction
  async getVisionEvents(limit = 100) {
    const snapshot = await this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({
      transferables: true
    });
    
    return (snapshot.iterable || [])
      .sort((a, b) => new Date(b.created?.value || 0) - new Date(a.created?.value || 0))
      .slice(0, limit)
      .map(event => ({
        id: event.id,
        created: event.created?.value,
        application: event.application?.name || 'Unknown',
        textContent: event.textContent?.substring(0, 500) || '',
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
  }

  async getActivities(limit = 50) {
    const snapshot = await this.activitiesApi.activitiesSnapshot({});
    
    return (snapshot.iterable || [])
      .sort((a, b) => new Date(b.created?.value || 0) - new Date(a.created?.value || 0))
      .slice(0, limit)
      .map(activity => ({
        id: activity.id,
        created: activity.created?.value,
        application: activity.application?.name || 'Unknown',
        event: activity.event,
        rank: activity.rank || 0,
        type: this.classifyActivityType(activity)
      }));
  }

  async getWorkstreamSummaries(limit = 20) {
    const snapshot = await this.workstreamSummariesApi.workstreamSummariesSnapshot({});
    
    return (snapshot.iterable || [])
      .sort((a, b) => new Date(b.created?.value || 0) - new Date(a.created?.value || 0))
      .slice(0, limit)
      .map(summary => ({
        id: summary.id,
        created: summary.created?.value,
        updated: summary.updated?.value,
        summary: summary.summary?.text || summary.summary?.raw || '',
        application: summary.application?.name || 'Unknown',
        assets: summary.assets?.iterable?.map(a => ({ id: a.id, name: a.name })) || [],
        websites: summary.websites?.iterable?.map(w => ({ url: w.url, name: w.name })) || [],
        anchors: summary.anchors?.iterable?.map(a => ({ id: a.id, name: a.name, fullPath: a.fullpath })) || [],
        people: summary.persons?.iterable?.map(p => p.name) || [],
        tags: summary.tags?.iterable?.map(t => t.text) || []
      }));
  }

  async getAssets(limit = 20) {
    const snapshot = await this.assetsApi.assetsSnapshot({});
    
    return (snapshot.iterable || [])
      .slice(0, limit)
      .map(asset => ({
        id: asset.id,
        name: asset.name || 'Unnamed',
        type: this.classifyAssetType(asset),
        language: asset.original?.reference?.classification?.specific || null,
        tags: asset.tags?.iterable?.map(t => t.text) || [],
        content: asset.original?.reference?.fragment?.string?.raw?.substring(0, 500) || '',
        created: asset.created?.value,
        updated: asset.updated?.value
      }));
  }

  async getConversations(limit = 5) {
    const snapshot = await this.conversationsApi.conversationsSnapshot({ transferables: true });
    
    return (snapshot.iterable || [])
      .sort((a, b) => new Date(b.created?.value || 0) - new Date(a.created?.value || 0))
      .slice(0, limit)
      .map(convo => ({
        id: convo.id,
        name: convo.name || 'Unnamed Conversation',
        created: convo.created?.value,
        messageCount: convo.messages?.iterable?.length || 0,
        recentMessages: (convo.messages?.iterable || [])
          .slice(-3)
          .map(msg => ({
            role: msg.role,
            content: msg.fragment?.string?.raw?.substring(0, 200) || ''
          })),
        summary: convo.annotations?.iterable?.[0]?.text || ''
      }));
  }

  async getAnchors(limit = 30) {
    const snapshot = await this.anchorsApi.anchorsSnapshot({ transferables: true });
    
    return (snapshot.iterable || [])
      .sort((a, b) => new Date(b.created?.value || 0) - new Date(a.created?.value || 0))
      .slice(0, limit)
      .map(anchor => ({
        id: anchor.id,
        name: anchor.name || 'Unknown',
        fullPath: anchor.fullpath || '',
        created: anchor.created?.value,
        type: anchor.type
      }));
  }

  async getWebsites(limit = 50) {
    const snapshot = await this.websitesApi.websitesSnapshot({});
    
    return (snapshot.iterable || [])
      .sort((a, b) => new Date(b.created?.value || 0) - new Date(a.created?.value || 0))
      .slice(0, limit)
      .map(site => ({
        id: site.id,
        name: site.name || 'Unnamed',
        url: site.url,
        created: site.created?.value
      }));
  }

  async getOCRAnalyses(limit = 20) {
    const snapshot = await this.ocrAnalysesApi.ocrAnalysesSnapshot({ transferables: true });
    
    return (snapshot.iterable || [])
      .slice(0, limit)
      .map(analysis => ({
        id: analysis.id,
        created: analysis.created?.value,
        text: analysis.raw || analysis.text || '',
        confidence: analysis.confidence
      }));
  }

  async getWorkstreamEvents(limit = 30) {
    const snapshot = await this.workstreamEventsApi.workstreamEventsSnapshot({ transferables: true });
    
    return (snapshot.iterable || [])
      .sort((a, b) => new Date(b.created?.value || 0) - new Date(a.created?.value || 0))
      .slice(0, limit)
      .map(event => ({
        id: event.id,
        created: event.created?.value,
        summary: event.summary?.text || event.summary?.raw || '',
        application: event.application?.name || 'Unknown'
      }));
  }

  // ============================================
  // FILTERING LAYER - Noise Reduction
  // ============================================

  /**
   * Filter context to remove noise and irrelevant items
   * @param {Object} context - Raw context
   * @returns {Promise<Object>} Filtered context
   */
  async filterContext(context) {
    console.log('  🔍 Filtering context for relevance...');
    
    const now = Date.now();
    const focusWindow = this.config.focusWindowMs;
    
    // Reset deduplication engine
    this.dedupEngine.reset();

    // Filter vision events (focus on recent, with content)
    const relevantVisionEvents = context.visionEvents
      .filter(v => {
        // Must be within focus window
        const age = now - new Date(v.created || 0).getTime();
        if (age > focusWindow) return false;
        
        // Must have meaningful content
        if (!v.application || v.application === 'Unknown') return false;
        
        return true;
      });

    // Filter activities (high rank, recent)
    const relevantActivities = context.activities
      .filter(a => {
        const age = now - new Date(a.created || 0).getTime();
        // Keep high-rank activities even if older
        if (a.rank >= 7) return age < 24 * 3600000; // 24h for high rank
        return age < focusWindow;
      });

    // Filter workstream summaries (recent only)
    const relevantSummaries = context.workstreamSummaries
      .filter(s => {
        const age = now - new Date(s.created || 0).getTime();
        return age < 24 * 3600000; // 24 hours
      });

    // Filter anchors to actual file paths
    const relevantAnchors = context.anchors
      .filter(a => a.fullPath && !a.fullPath.includes('node_modules'));

    // Filter websites (remove generic/CDN URLs)
    const relevantWebsites = context.websites
      .filter(w => {
        if (!w.url) return false;
        // Filter out common non-informative URLs
        const skipPatterns = [
          'google.com/search',
          'localhost',
          'chrome://',
          'file://'
        ];
        return !skipPatterns.some(p => w.url.includes(p));
      });

    // Filter OCR to meaningful text
    const relevantOCR = context.ocrAnalyses
      .filter(o => o.text && o.text.length > 20 && o.text.length < 1000);

    const totalItems = 
      relevantVisionEvents.length +
      relevantActivities.length +
      relevantSummaries.length +
      context.assets.length +
      context.conversations.length +
      relevantAnchors.length +
      relevantWebsites.length +
      relevantOCR.length +
      context.workstreamEvents.length;

    console.log(`  ✓ Filtered to ${totalItems} relevant items`);

    return {
      visionEvents: relevantVisionEvents,
      activities: relevantActivities,
      workstreamSummaries: relevantSummaries,
      assets: context.assets,
      conversations: context.conversations,
      anchors: relevantAnchors,
      websites: relevantWebsites,
      ocrAnalyses: relevantOCR,
      workstreamEvents: context.workstreamEvents,
      totalItems,
      _timestamp: context._timestamp
    };
  }

  // ============================================
  // PRIORITIZATION LAYER - Importance Ranking
  // ============================================

  /**
   * Prioritize context items by importance
   * @param {Object} filtered - Filtered context
   * @returns {Object} Prioritized context with scores
   */
  prioritizeContext(filtered) {
    console.log('  📊 Prioritizing context items...');

    const now = Date.now();
    const recentWindow = this.config.recentWindowMs;

    // Score and categorize items
    const scored = {
      // TIER 1: Current Focus (highest priority)
      currentFocus: this.scoreVisionEvents(filtered.visionEvents, now, recentWindow),
      
      // TIER 2: Blockers and errors
      blockers: this.extractBlockers(filtered),
      
      // TIER 3: Active projects
      activeProjects: this.identifyActiveProjects(filtered),
      
      // TIER 4: General activity
      activities: this.scoreActivities(filtered.activities, now),
      
      // TIER 5: Historical patterns
      patterns: this.extractPatterns(filtered)
    };

    // Sort each tier by score
    Object.keys(scored).forEach(tier => {
      if (Array.isArray(scored[tier])) {
        scored[tier].sort((a, b) => b.score - a.score);
      }
    });

    console.log(`  ✓ Prioritized into ${Object.keys(scored).length} tiers`);

    return scored;
  }

  /**
   * Score vision events for current focus detection
   */
  scoreVisionEvents(events, now, recentWindow) {
    return events.map(event => {
      const age = now - new Date(event.created).getTime();
      const isRecent = age < recentWindow;
      
      // Base temporal score
      let score = TemporalWeightCalculator.getPriorityMultiplier(event.created);
      
      // Boost for having content
      if (event.textContent?.length > 50) score *= 1.3;
      if (event.title?.length > 0) score *= 1.2;
      
      // Boost for having file anchors
      if (event.anchors?.length > 0) score *= 1.4;
      
      // Boost for recent activity
      if (isRecent) score *= 1.5;

      return {
        ...event,
        score: Math.round(score * 100) / 100,
        isRecent,
        tier: 'currentFocus'
      };
    });
  }

  /**
   * Extract potential blockers from context
   */
  extractBlockers(filtered) {
    const blockers = [];
    const keywords = this.config.blockerKeywords;

    // Check workstream summaries for blocker indicators
    filtered.workstreamSummaries.forEach(summary => {
      const text = (summary.summary || '').toLowerCase();
      const matches = keywords.filter(k => text.includes(k));
      
      if (matches.length > 0) {
        blockers.push({
          type: 'summary_blocker',
          source: summary,
          indicators: matches,
          score: matches.length * 2 + (summary.summary?.length > 100 ? 1 : 0),
          tier: 'blocker'
        });
      }
    });

    // Check OCR text for error patterns
    filtered.ocrAnalyses.forEach(ocr => {
      const text = (ocr.text || '').toLowerCase();
      const errorPatterns = ['error:', 'exception:', 'failed', 'syntax error', 'undefined'];
      const matches = errorPatterns.filter(p => text.includes(p));
      
      if (matches.length > 0) {
        blockers.push({
          type: 'screen_error',
          source: ocr,
          indicators: matches,
          score: matches.length * 1.5,
          tier: 'blocker'
        });
      }
    });

    // Check activities for error events
    filtered.activities.forEach(activity => {
      if (activity.rank >= 8) {
        blockers.push({
          type: 'high_rank_activity',
          source: activity,
          score: activity.rank,
          tier: 'blocker'
        });
      }
    });

    return blockers.sort((a, b) => b.score - a.score);
  }

  /**
   * Identify active projects from context
   */
  identifyActiveProjects(filtered) {
    const projects = new Map();

    // Extract projects from anchors (file paths)
    filtered.anchors.forEach(anchor => {
      if (!anchor.fullPath) return;
      
      // Extract project name from path
      const parts = anchor.fullPath.split('/');
      const projectIndex = parts.findIndex(p => 
        !p.startsWith('.') && 
        !['Users', 'home', 'Documents', 'Desktop'].includes(p)
      );
      
      if (projectIndex >= 0 && projectIndex < parts.length - 1) {
        const projectName = parts[projectIndex];
        if (!projects.has(projectName)) {
          projects.set(projectName, {
            name: projectName,
            files: [],
            lastAccessed: anchor.created,
            score: 0
          });
        }
        
        const project = projects.get(projectName);
        project.files.push(anchor.fullPath);
        project.score += TemporalWeightCalculator.getPriorityMultiplier(anchor.created);
        
        if (new Date(anchor.created) > new Date(project.lastAccessed)) {
          project.lastAccessed = anchor.created;
        }
      }
    });

    // Extract projects from tags in summaries
    filtered.workstreamSummaries.forEach(summary => {
      summary.tags?.forEach(tag => {
        if (!projects.has(tag)) {
          projects.set(tag, {
            name: tag,
            files: [],
            tags: [tag],
            lastAccessed: summary.created,
            score: TemporalWeightCalculator.getPriorityMultiplier(summary.created) * 0.5
          });
        }
      });
    });

    return Array.from(projects.values())
      .map(p => ({
        ...p,
        score: Math.round(p.score * 100) / 100,
        fileCount: p.files.length,
        tier: 'project'
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Score activities by importance
   */
  scoreActivities(activities, now) {
    return activities.map(activity => {
      let score = activity.rank || 5;
      
      // Boost by recency
      score *= TemporalWeightCalculator.getPriorityMultiplier(activity.created);
      
      // Boost for asset events
      if (activity.type === 'asset') score *= 1.3;
      
      return {
        ...activity,
        score: Math.round(score * 100) / 100,
        tier: 'activity'
      };
    });
  }

  /**
   * Extract work patterns from context
   */
  extractPatterns(filtered) {
    const patterns = {
      topApplications: this.extractTopApplications(filtered.activities),
      topLanguages: this.extractTopLanguages(filtered.assets),
      topTags: this.extractTopTags(filtered),
      workingHours: this.estimateWorkingHours(filtered.activities),
      tier: 'pattern'
    };

    return [patterns];
  }

  /**
   * Extract top applications by usage
   */
  extractTopApplications(activities) {
    const counts = {};
    activities.forEach(a => {
      const app = a.application || 'Unknown';
      counts[app] = (counts[app] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Extract top programming languages
   */
  extractTopLanguages(assets) {
    const counts = {};
    assets.forEach(a => {
      if (a.language) {
        counts[a.language] = (counts[a.language] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Extract top tags/topics
   */
  extractTopTags(filtered) {
    const counts = {};
    
    filtered.workstreamSummaries.forEach(s => {
      s.tags?.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });

    filtered.assets.forEach(a => {
      a.tags?.forEach(t => {
        counts[t] = (counts[t] || 0) + 0.5;
      });
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count: Math.round(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Estimate working hours pattern
   */
  estimateWorkingHours(activities) {
    if (activities.length === 0) return null;

    const hours = activities.map(a => new Date(a.created).getHours());
    const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
    
    return {
      currentHour: avgHour,
      isWorkHours: avgHour >= 9 && avgHour <= 18,
      activityCount: activities.length
    };
  }

  // ============================================
  // SYNTHESIS LAYER - Chunk Creation
  // ============================================

  /**
   * Synthesize prioritized context into chunks
   * @param {Object} prioritized - Prioritized context
   * @param {Object} options - Synthesis options
   * @returns {Object} Synthesized chunks
   */
  synthesizeToChunks(prioritized, options = {}) {
    console.log('  🧩 Synthesizing into chunks...');

    return {
      // TIER 1: Current focus (what they're doing NOW)
      currentFocus: this.synthesizeCurrentFocus(prioritized.currentFocus),
      
      // TIER 2: Blockers and issues
      blockers: this.synthesizeBlockers(prioritized.blockers),
      
      // TIER 3: Active projects
      projects: this.synthesizeProjects(prioritized.activeProjects),
      
      // TIER 4: Recent activity summary
      activitySummary: this.synthesizeActivitySummary(prioritized.activities),
      
      // TIER 5: Work patterns
      patterns: prioritized.patterns[0]
    };
  }

  /**
   * Synthesize current focus from vision events
   */
  synthesizeCurrentFocus(visionEvents) {
    if (visionEvents.length === 0) {
      return {
        primaryApplication: 'Unknown',
        confidence: 0,
        recentFiles: [],
        recentUrls: [],
        context: 'No recent activity detected'
      };
    }

    // Get most recent events
    const recent = visionEvents.slice(0, 10);
    
    // Find dominant application
    const appCounts = {};
    recent.forEach(e => {
      appCounts[e.application] = (appCounts[e.application] || 0) + 1;
    });
    
    const primaryApp = Object.entries(appCounts)
      .sort((a, b) => b[1] - a[1])[0];

    // Extract recent files (deduplicated)
    const recentFiles = [...new Set(
      recent
        .flatMap(e => e.anchors?.map(a => a.fullPath) || [])
        .filter(Boolean)
    )].slice(0, 5);

    // Extract recent URLs
    const recentUrls = [...new Set(
      recent
        .map(e => e.url)
        .filter(Boolean)
    )].slice(0, 5);

    // Extract window titles for context
    const recentTitles = recent
      .map(e => e.title)
      .filter(Boolean)
      .slice(0, 5);

    // Calculate confidence based on data quality
    const confidence = Math.min(1, 
      (recentFiles.length * 0.1) + 
      (recentUrls.length * 0.1) + 
      (primaryApp ? primaryApp[1] / 10 : 0)
    );

    return {
      primaryApplication: primaryApp ? primaryApp[0] : 'Unknown',
      applicationUsage: appCounts,
      confidence: Math.round(confidence * 100) / 100,
      recentFiles,
      recentUrls,
      recentTitles,
      context: this.inferContextFromTitles(recentTitles),
      lastActivity: recent[0]?.created
    };
  }

  /**
   * Synthesize blockers into actionable format
   */
  synthesizeBlockers(blockers) {
    if (blockers.length === 0) return [];

    return blockers.slice(0, this.config.maxBlockers).map(b => ({
      type: b.type,
      indicators: b.indicators || [],
      description: b.source.summary || b.source.text || 'Potential issue detected',
      severity: b.score > 5 ? 'high' : b.score > 3 ? 'medium' : 'low',
      timestamp: b.source.created
    }));
  }

  /**
   * Synthesize projects into summary
   */
  synthesizeProjects(projects) {
    return projects.slice(0, this.config.maxProjects).map(p => ({
      name: p.name,
      fileCount: p.fileCount,
      lastAccessed: p.lastAccessed,
      score: p.score
    }));
  }

  /**
   * Synthesize activity summary
   */
  synthesizeActivitySummary(activities) {
    const recentCount = activities.filter(a => a.isRecent).length;
    const topTypes = this.extractTopActivityTypes(activities);
    
    return {
      totalRecent: activities.length,
      highPriorityCount: activities.filter(a => a.score > 7).length,
      topTypes,
      activityLevel: this.categorizeActivityLevel(activities.length)
    };
  }

  /**
   * Extract top activity types
   */
  extractTopActivityTypes(activities) {
    const counts = {};
    activities.forEach(a => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  /**
   * Categorize activity level
   */
  categorizeActivityLevel(count) {
    if (count > 30) return 'very_high';
    if (count > 15) return 'high';
    if (count > 5) return 'moderate';
    return 'low';
  }

  /**
   * Infer context from window titles
   */
  inferContextFromTitles(titles) {
    const indicators = {
      coding: ['.js', '.ts', '.py', '.java', 'vscode', 'cursor', 'editor', 'code'],
      debugging: ['debug', 'console', 'terminal', 'error', 'log'],
      browsing: ['chrome', 'firefox', 'browser', 'search'],
      communication: ['slack', 'discord', 'teams', 'email', 'mail'],
      documentation: ['docs', 'readme', 'documentation', 'wiki']
    };

    const titleString = titles.join(' ').toLowerCase();
    
    for (const [context, keywords] of Object.entries(indicators)) {
      if (keywords.some(k => titleString.includes(k))) {
        return context;
      }
    }

    return 'general';
  }

  // ============================================
  // OUTPUT LAYER - Final Digest Construction
  // ============================================

  /**
   * Build final digest within token budget
   * @param {Object} synthesized - Synthesized chunks
   * @returns {Object} Final digest with metadata
   */
  buildDigest(synthesized) {
    console.log('  📝 Building final digest...');

    let tokenCount = 0;
    const budget = this.config.maxTokens;
    const sections = [];

    // Priority order: Current Focus → Blockers → Projects → Activity → Patterns
    const tierOrder = [
      { key: 'currentFocus', label: 'CURRENT_FOCUS', maxTokens: 800 },
      { key: 'blockers', label: 'BLOCKERS', maxTokens: 600 },
      { key: 'projects', label: 'ACTIVE_PROJECTS', maxTokens: 500 },
      { key: 'activitySummary', label: 'ACTIVITY_SUMMARY', maxTokens: 400 },
      { key: 'patterns', label: 'WORK_PATTERNS', maxTokens: 300 }
    ];

    let itemCount = 0;

    for (const tier of tierOrder) {
      const data = synthesized[tier.key];
      if (!data) continue;

      // Check if we can fit this section
      const sectionText = JSON.stringify({ [tier.label]: data });
      const sectionTokens = this.tokenCounter.estimate(sectionText);

      if (tokenCount + sectionTokens > budget) {
        // Try to truncate
        const truncated = this.truncateSection(data, tier.maxTokens);
        if (truncated) {
          const truncatedTokens = this.tokenCounter.estimateObject({ [tier.label]: truncated });
          if (tokenCount + truncatedTokens <= budget) {
            sections.push({ label: tier.label, data: truncated });
            tokenCount += truncatedTokens;
            itemCount += this.countItems(truncated);
          }
        }
      } else {
        sections.push({ label: tier.label, data });
        tokenCount += sectionTokens;
        itemCount += this.countItems(data);
      }
    }

    // Calculate confidence scores
    const confidence = this.calculateConfidence(synthesized, sections);

    // Build final content
    const content = sections.reduce((acc, section) => {
      acc[section.label] = section.data;
      return acc;
    }, {});

    return {
      content,
      tokenCount,
      itemCount,
      confidence,
      coverage: sections.map(s => s.label)
    };
  }

  /**
   * Truncate a section to fit token budget
   */
  truncateSection(data, maxTokens) {
    if (Array.isArray(data)) {
      // For arrays, keep highest scored items
      const sorted = [...data].sort((a, b) => (b.score || 0) - (a.score || 0));
      let result = [];
      let tokens = 0;

      for (const item of sorted) {
        const itemTokens = this.tokenCounter.estimateObject(item);
        if (tokens + itemTokens > maxTokens) break;
        result.push(item);
        tokens += itemTokens;
      }

      return result.length > 0 ? result : null;
    }

    if (typeof data === 'object' && data !== null) {
      // For objects, truncate string fields
      const result = {};
      let tokens = 0;

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.length > 200) {
          result[key] = value.substring(0, 200) + '...';
          tokens += this.tokenCounter.estimate(result[key]);
        } else {
          result[key] = value;
          tokens += this.tokenCounter.estimateObject(value);
        }

        if (tokens > maxTokens) break;
      }

      return Object.keys(result).length > 0 ? result : null;
    }

    return data;
  }

  /**
   * Count items in data structure
   */
  countItems(data) {
    if (Array.isArray(data)) return data.length;
    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length;
    }
    return 1;
  }

  /**
   * Calculate confidence scores for the digest
   */
  calculateConfidence(synthesized, sections) {
    const scores = {
      currentFocus: synthesized.currentFocus?.confidence || 0,
      dataCoverage: sections.length / 5, // 5 possible tiers
      hasRecentData: synthesized.currentFocus?.lastActivity ? 
        (Date.now() - new Date(synthesized.currentFocus.lastActivity).getTime() < 3600000) : false
    };

    const overall = (
      scores.currentFocus * 0.4 +
      scores.dataCoverage * 0.4 +
      (scores.hasRecentData ? 0.2 : 0)
    );

    return {
      overall: Math.round(overall * 100) / 100,
      ...scores
    };
  }

  // ============================================
  // PUBLIC API METHODS
  // ============================================

  /**
   * Extract current focus from vision events and activities
   * 
   * @param {Array} visionEvents - Vision events from WPE
   * @param {Array} activities - Activity events
   * @returns {Object} { app, file, task, confidence }
   */
  inferCurrentFocus(visionEvents, activities) {
    console.log('  🎯 Inferring current focus...');

    if ((!visionEvents || visionEvents.length === 0) && 
        (!activities || activities.length === 0)) {
      return {
        app: 'Unknown',
        file: null,
        task: 'No recent activity',
        confidence: 0
      };
    }

    // Analyze vision events for current application
    const recentVision = (visionEvents || [])
      .filter(v => {
        const age = Date.now() - new Date(v.created || 0).getTime();
        return age < this.config.recentWindowMs;
      });

    // Get application from vision or activities
    const appCounts = {};
    recentVision.forEach(v => {
      appCounts[v.application] = (appCounts[v.application] || 0) + 1;
    });
    (activities || [])
      .filter(a => {
        const age = Date.now() - new Date(a.created || 0).getTime();
        return age < this.config.recentWindowMs;
      })
      .forEach(a => {
        appCounts[a.application] = (appCounts[a.application] || 0) + 0.5;
      });

    const primaryApp = Object.entries(appCounts)
      .sort((a, b) => b[1] - a[1])[0];

    // Extract current file from vision anchors
    const recentFiles = recentVision
      .flatMap(v => v.anchors?.map(a => a.fullPath) || [])
      .filter(Boolean);
    
    const currentFile = recentFiles[0] || null;

    // Infer task from window titles and URLs
    const titles = recentVision
      .map(v => v.title)
      .filter(Boolean);
    
    const urls = recentVision
      .map(v => v.url)
      .filter(Boolean);

    let task = 'General work';
    if (urls.some(u => u.includes('github'))) task = 'Code review/Development';
    else if (urls.some(u => u.includes('stackoverflow') || u.includes('docs'))) task = 'Research/Learning';
    else if (titles.some(t => t.includes('PR') || t.includes('Pull Request'))) task = 'Code review';
    else if (titles.some(t => t.includes('Issue') || t.includes('Bug'))) task = 'Debugging';

    // Calculate confidence
    const confidence = Math.min(1, 
      (primaryApp ? primaryApp[1] / 5 : 0) +
      (currentFile ? 0.3 : 0) +
      (titles.length > 0 ? 0.2 : 0)
    );

    return {
      app: primaryApp ? primaryApp[0] : 'Unknown',
      file: currentFile,
      task,
      confidence: Math.round(confidence * 100) / 100,
      supportingData: {
        recentFiles: recentFiles.slice(0, 5),
        recentUrls: urls.slice(0, 5),
        recentTitles: titles.slice(0, 5)
      }
    };
  }

  /**
   * Extract work patterns from summaries and activities
   * 
   * @param {Array} summaries - Workstream summaries
   * @param {Array} activities - Activity events
   * @returns {Object} { topics, projects, blockers, patterns }
   */
  extractWorkPatterns(summaries, activities) {
    console.log('  📈 Extracting work patterns...');

    // Extract topics from tags
    const topicCounts = {};
    (summaries || []).forEach(s => {
      s.tags?.forEach(tag => {
        topicCounts[tag] = (topicCounts[tag] || 0) + 1;
      });
    });

    const topics = Object.entries(topicCounts)
      .map(([name, frequency]) => ({ name, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    // Extract projects from activity context
    const projectSet = new Set();
    (summaries || []).forEach(s => {
      if (s.summary) {
        // Simple project extraction from summary text
        const projectMatch = s.summary.match(/project[:\s]+([\w-]+)/i);
        if (projectMatch) projectSet.add(projectMatch[1]);
      }
    });

    const projects = Array.from(projectSet).map(name => ({ name }));

    // Detect blockers
    const blockerKeywords = this.config.blockerKeywords;
    const blockers = [];

    (summaries || []).forEach(s => {
      const text = (s.summary || '').toLowerCase();
      const matches = blockerKeywords.filter(k => text.includes(k));
      if (matches.length > 0) {
        blockers.push({
          description: s.summary.substring(0, 200),
          indicators: matches,
          timestamp: s.created
        });
      }
    });

    // Detect patterns
    const patterns = {
      timeOfDay: this.analyzeTimeOfDay(activities),
      applicationSwitches: this.analyzeContextSwitches(activities),
      focusDuration: this.estimateFocusDuration(activities)
    };

    return {
      topics,
      projects,
      blockers: blockers.slice(0, 5),
      patterns
    };
  }

  /**
   * Build AI-optimized prompt from synthesized context
   * 
   * @param {Object} synthesizedContext - Output from synthesizeContext
   * @returns {string} Formatted prompt optimized for Pieces Agent
   */
  buildAIPrompt(synthesizedContext) {
    const { digest, metadata, confidence } = synthesizedContext;

    // Build confidence indicator
    const confidenceIndicator = confidence.overall > 0.7 ? 'HIGH' : 
                                confidence.overall > 0.4 ? 'MEDIUM' : 'LOW';

    // Build prompt sections
    const sections = [];

    // Header with confidence
    sections.push(`## USER CONTEXT [${confidenceIndicator} CONFIDENCE]`);
    sections.push(`Generated: ${new Date().toISOString()}`);
    sections.push(`Context Items: ${metadata.itemsIncluded}\n`);

    // Current Focus (most important)
    if (digest.CURRENT_FOCUS) {
      const cf = digest.CURRENT_FOCUS;
      sections.push('### CURRENT FOCUS (Active Now)');
      sections.push(`Primary Application: ${cf.primaryApplication}`);
      if (cf.recentFiles?.length > 0) {
        sections.push(`Active Files:\n${cf.recentFiles.map(f => `- ${f}`).join('\n')}`);
      }
      if (cf.recentUrls?.length > 0) {
        sections.push(`Active URLs:\n${cf.recentUrls.map(u => `- ${u}`).join('\n')}`);
      }
      if (cf.context && cf.context !== 'general') {
        sections.push(`Inferred Context: ${cf.context}`);
      }
      sections.push('');
    }

    // Blockers
    if (digest.BLOCKERS && digest.BLOCKERS.length > 0) {
      sections.push('### POTENTIAL BLOCKERS');
      digest.BLOCKERS.forEach(b => {
        sections.push(`- [${b.severity.toUpperCase()}] ${b.type}: ${b.indicators.join(', ')}`);
        if (b.description) sections.push(`  ${b.description.substring(0, 150)}`);
      });
      sections.push('');
    }

    // Active Projects
    if (digest.ACTIVE_PROJECTS && digest.ACTIVE_PROJECTS.length > 0) {
      sections.push('### ACTIVE PROJECTS');
      digest.ACTIVE_PROJECTS.forEach(p => {
        sections.push(`- ${p.name} (${p.fileCount} files, last: ${new Date(p.lastAccessed).toLocaleString()})`);
      });
      sections.push('');
    }

    // Activity Summary
    if (digest.ACTIVITY_SUMMARY) {
      const as = digest.ACTIVITY_SUMMARY;
      sections.push('### ACTIVITY SUMMARY');
      sections.push(`Level: ${as.activityLevel} | Recent items: ${as.totalRecent}`);
      if (as.topTypes?.length > 0) {
        sections.push(`Top activities: ${as.topTypes.map(t => t.type).join(', ')}`);
      }
      sections.push('');
    }

    // Work Patterns
    if (digest.WORK_PATTERNS) {
      const wp = digest.WORK_PATTERNS;
      sections.push('### WORK PATTERNS');
      if (wp.topApplications?.length > 0) {
        sections.push(`Applications: ${wp.topApplications.slice(0, 3).map(a => a.name).join(', ')}`);
      }
      if (wp.topTags?.length > 0) {
        sections.push(`Topics: ${wp.topTags.slice(0, 5).map(t => t.name).join(', ')}`);
      }
      sections.push('');
    }

    // Footer with instructions
    sections.push('---');
    sections.push('INSTRUCTIONS:');
    sections.push('- Provide specific, actionable assistance based on current focus');
    sections.push('- Address blockers first if present');
    sections.push('- Reference specific files/projects mentioned above');
    sections.push('- Keep responses concise and relevant to the context\n');

    return sections.join('\n');
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  classifyActivityType(activity) {
    const event = activity.event || {};
    if (event.asset) return 'asset';
    if (event.interaction) return 'interaction';
    if (event.session) return 'session';
    if (event.workstreamSummary) return 'workstream';
    return 'other';
  }

  classifyAssetType(asset) {
    const classification = asset.original?.reference?.classification;
    if (classification?.generic === 'CODE') return 'code';
    if (asset.websites?.iterable?.length > 0) return 'link';
    if (asset.original?.reference?.fragment?.string?.raw) return 'note';
    return 'other';
  }

  analyzeTimeOfDay(activities) {
    if (!activities || activities.length === 0) return null;
    
    const hours = activities.map(a => new Date(a.created).getHours());
    const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
    
    return {
      averageHour: avgHour,
      isDaytime: avgHour >= 6 && avgHour <= 18,
      isNighttime: avgHour < 6 || avgHour > 22
    };
  }

  analyzeContextSwitches(activities) {
    if (!activities || activities.length < 2) return { count: 0, frequency: 'low' };

    let switches = 0;
    for (let i = 1; i < activities.length; i++) {
      if (activities[i].application !== activities[i - 1].application) {
        switches++;
      }
    }

    const frequency = switches > activities.length * 0.5 ? 'high' : 
                      switches > activities.length * 0.25 ? 'medium' : 'low';

    return { count: switches, frequency };
  }

  estimateFocusDuration(activities) {
    if (!activities || activities.length < 2) return null;

    const timestamps = activities
      .map(a => new Date(a.created).getTime())
      .sort((a, b) => a - b);

    const duration = timestamps[timestamps.length - 1] - timestamps[0];
    const minutes = Math.floor(duration / 60000);

    return {
      minutes,
      category: minutes > 120 ? 'extended' : minutes > 60 ? 'long' : minutes > 30 ? 'medium' : 'short'
    };
  }

  generateFallbackDigest(error) {
    return {
      digest: {
        CURRENT_FOCUS: { primaryApplication: 'Unknown', confidence: 0 },
        error: error?.message || 'Unknown error'
      },
      metadata: {
        duration: 0,
        tokenCount: 0,
        itemsProcessed: 0,
        itemsIncluded: 0,
        error: true
      },
      confidence: {
        overall: 0,
        error: error?.message
      }
    };
  }
}

// Export singleton instance
module.exports = new ContextSummarizationService();

// Also export class for testing/customization
module.exports.ContextSummarizationService = ContextSummarizationService;
module.exports.TokenCounter = TokenCounter;
module.exports.TemporalWeightCalculator = TemporalWeightCalculator;
module.exports.DeduplicationEngine = DeduplicationEngine;
