/**
 * Context Health Service
 * 
 * Monitors the health and quality of Pieces context integration.
 * Periodically polls all Pieces APIs, tracks metrics, identifies issues,
 * and provides actionable recommendations.
 */

const pieces = require('@pieces.app/pieces-os-client');
const os = require('os');

class ContextHealthService {
  constructor() {
    const platform = os.platform();
    const port = platform === 'linux' ? 5323 : 39300;
    this.configuration = new pieces.Configuration({
      basePath: `http://localhost:${port}`
    });

    // API clients
    this.wellKnownApi = new pieces.WellKnownApi(this.configuration);
    this.assetsApi = new pieces.AssetsApi(this.configuration);
    this.workstreamSummariesApi = new pieces.WorkstreamSummariesApi(this.configuration);
    this.workstreamPatternEngineApi = new pieces.WorkstreamPatternEngineApi(this.configuration);
    this.activitiesApi = new pieces.ActivitiesApi(this.configuration);
    this.workstreamEventsApi = new pieces.WorkstreamEventsApi(this.configuration);
    this.ocrAnalysesApi = new pieces.OCRAnalysesApi(this.configuration);
    this.imageAnalysesApi = new pieces.ImageAnalysesApi(this.configuration);
    this.conversationsApi = new pieces.ConversationsApi(this.configuration);
    this.anchorsApi = new pieces.AnchorsApi(this.configuration);
    this.websitesApi = new pieces.WebsitesApi(this.configuration);

    // Cache configuration
    this.cacheDuration = 45000; // 45 seconds
    this.lastCheck = null;
    this.cachedHealth = null;
    this.isChecking = false;

    // Historical data for trend analysis
    this.history = [];
    this.maxHistorySize = 50;

    // Start periodic polling
    this.startPolling();
  }

  /**
   * Start periodic health polling
   */
  startPolling() {
    // Initial check after 5 seconds
    setTimeout(() => this.performHealthCheck(), 5000);
    
    // Poll every 60 seconds
    this.pollingInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000);

    console.log('✓ Context health monitoring started');
  }

  /**
   * Stop periodic polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('✗ Context health monitoring stopped');
    }
  }

  /**
   * Get current health snapshot (cached or fresh)
   */
  async getHealthSnapshot() {
    const now = Date.now();
    
    // Return cached data if fresh
    if (this.cachedHealth && this.lastCheck && (now - this.lastCheck) < this.cacheDuration) {
      return {
        ...this.cachedHealth,
        cached: true,
        cacheAge: Math.round((now - this.lastCheck) / 1000)
      };
    }

    // Perform fresh check if not already checking
    if (!this.isChecking) {
      await this.performHealthCheck();
    }

    return this.cachedHealth || this.getDefaultHealth();
  }

  /**
   * Get detailed diagnostic data
   */
  async getDetailedDiagnostics() {
    const health = await this.getHealthSnapshot();
    
    return {
      ...health,
      history: this.getHistorySummary(),
      diagnostics: await this.runDiagnostics(),
      config: {
        cacheDuration: this.cacheDuration,
        pollingInterval: 60000,
        maxHistorySize: this.maxHistorySize
      }
    };
  }

  /**
   * Perform comprehensive health check across all APIs
   */
  async performHealthCheck() {
    if (this.isChecking) return;
    this.isChecking = true;

    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Check Pieces connectivity
      const connectivity = await this.checkConnectivity();
      
      // Check all APIs in parallel with individual error handling
      const [
        assets,
        workstreamSummaries,
        visionEvents,
        activities,
        workstreamEvents,
        ocrAnalyses,
        imageAnalyses,
        conversations,
        anchors,
        websites,
        visionStatus
      ] = await Promise.all([
        this.checkAssets(),
        this.checkWorkstreamSummaries(),
        this.checkVisionEvents(),
        this.checkActivities(),
        this.checkWorkstreamEvents(),
        this.checkOCRAnalyses(),
        this.checkImageAnalyses(),
        this.checkConversations(),
        this.checkAnchors(),
        this.checkWebsites(),
        this.checkVisionStatus()
      ]);

      // Calculate overall metrics
      const apis = {
        assets,
        workstreamSummaries,
        visionEvents,
        activities,
        workstreamEvents,
        ocrAnalyses,
        imageAnalyses,
        conversations,
        anchors,
        websites
      };

      const overallQuality = this.calculateOverallQuality(apis, visionStatus);
      const status = this.determineOverallStatus(apis, connectivity, overallQuality);
      const recommendations = this.generateRecommendations(apis, visionStatus, connectivity);

      const health = {
        status,
        piecesConnected: connectivity.connected,
        lastUpdated: timestamp,
        checkDuration: Date.now() - startTime,
        apis,
        visionStatus,
        overallContextQuality: overallQuality,
        recommendations,
        summary: this.generateSummary(apis, overallQuality)
      };

      // Cache and store history
      this.cachedHealth = health;
      this.lastCheck = Date.now();
      this.addToHistory(health);

      this.isChecking = false;
      return health;

    } catch (error) {
      this.isChecking = false;
      console.error('✗ Health check failed:', error.message);
      
      const errorHealth = {
        status: 'unhealthy',
        piecesConnected: false,
        lastUpdated: timestamp,
        checkDuration: Date.now() - startTime,
        error: error.message,
        apis: {},
        overallContextQuality: 0,
        recommendations: ['Critical: Health check system error - ' + error.message]
      };

      this.cachedHealth = errorHealth;
      this.lastCheck = Date.now();
      return errorHealth;
    }
  }

  /**
   * Check Pieces OS connectivity
   */
  async checkConnectivity() {
    try {
      const health = await this.wellKnownApi.getWellKnownHealth();
      return {
        connected: health.startsWith('ok'),
        status: health,
        error: null
      };
    } catch (error) {
      return {
        connected: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check Assets API health
   */
  async checkAssets() {
    try {
      const startTime = Date.now();
      const snapshot = await this.assetsApi.assetsSnapshot({});
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;
      
      // Check for content quality
      const withDescription = items.filter(a => 
        a.annotations?.iterable?.length > 0 || 
        a.description ||
        a.original?.reference?.fragment?.string?.raw?.length > 0
      ).length;

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        quality: items.length > 0 ? 'good' : 'empty',
        metrics: {
          withDescription,
          withContent: items.filter(a => a.original?.reference?.fragment?.string?.raw).length,
          withTags: items.filter(a => a.tags?.iterable?.length > 0).length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Workstream Summaries API health
   */
  async checkWorkstreamSummaries() {
    try {
      const startTime = Date.now();
      const snapshot = await this.workstreamSummariesApi.workstreamSummariesSnapshot({});
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      // Check for annotation/content quality issue
      const withContent = items.filter(s => {
        const summary = s.summary?.text || s.summary?.raw || '';
        const hasAnnotation = s.annotations?.iterable?.length > 0;
        return summary.length > 0 || hasAnnotation;
      }).length;

      let quality = 'good';
      if (items.length > 0 && withContent === 0) {
        quality = 'empty_content';
      } else if (items.length > 0 && withContent < items.length * 0.5) {
        quality = 'sparse_content';
      }

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        withContent,
        quality,
        metrics: {
          withWebsites: items.filter(s => s.websites?.iterable?.length > 0).length,
          withAnchors: items.filter(s => s.anchors?.iterable?.length > 0).length,
          withPeople: items.filter(s => s.persons?.iterable?.length > 0).length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        withContent: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Vision Events API health
   */
  async checkVisionEvents() {
    try {
      const startTime = Date.now();
      const snapshot = await this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({
        transferables: true
      });
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      // Check for OCR content issue
      const withOcr = items.filter(v => 
        v.textContent && v.textContent.length > 0
      ).length;

      let quality = 'good';
      if (items.length > 0 && withOcr === 0) {
        quality = 'no_ocr';
      } else if (items.length > 0 && withOcr < items.length * 0.3) {
        quality = 'low_ocr';
      }

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        withOcr,
        quality,
        metrics: {
          withScreenshots: items.filter(v => v.image).length,
          withUrls: items.filter(v => v.url).length,
          withTitles: items.filter(v => v.title).length,
          applications: [...new Set(items.map(v => v.application?.name).filter(Boolean))]
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        withOcr: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Activities API health
   */
  async checkActivities() {
    try {
      const startTime = Date.now();
      const snapshot = await this.activitiesApi.activitiesSnapshot({});
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      // Get recent activities (last 24h)
      const now = new Date();
      const recentCount = items.filter(a => {
        if (!a.created?.value) return false;
        const itemDate = new Date(a.created.value);
        return (now - itemDate) < 24 * 60 * 60 * 1000;
      }).length;

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        quality: items.length > 0 ? 'good' : 'empty',
        metrics: {
          recent24h: recentCount,
          withAssetEvents: items.filter(a => a.event?.asset).length,
          withInteractionEvents: items.filter(a => a.event?.interaction).length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Workstream Events API health
   */
  async checkWorkstreamEvents() {
    try {
      const startTime = Date.now();
      const snapshot = await this.workstreamEventsApi.workstreamEventsSnapshot({ transferables: true });
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        quality: items.length > 0 ? 'good' : 'empty',
        metrics: {
          withSummary: items.filter(e => e.summary?.text || e.summary?.raw).length,
          withApplication: items.filter(e => e.application?.name).length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check OCR Analyses API health
   */
  async checkOCRAnalyses() {
    try {
      const startTime = Date.now();
      const snapshot = await this.ocrAnalysesApi.ocrAnalysesSnapshot({ transferables: true });
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      // Check for actual text content
      const withText = items.filter(o => 
        (o.raw && o.raw.length > 0) || 
        (o.text && o.text.length > 0)
      ).length;

      let quality = 'good';
      if (items.length > 0 && withText === 0) {
        quality = 'no_text';
      }

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        withText,
        quality,
        metrics: {
          withConfidence: items.filter(o => typeof o.confidence === 'number').length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        withText: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Image Analyses API health
   */
  async checkImageAnalyses() {
    try {
      const startTime = Date.now();
      const snapshot = await this.imageAnalysesApi.imageAnalysesSnapshot({ transferables: true });
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        quality: items.length > 0 ? 'good' : 'empty',
        metrics: {
          withDescription: items.filter(i => i.description).length,
          withOcr: items.filter(i => i.ocr?.id).length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Conversations API health
   */
  async checkConversations() {
    try {
      const startTime = Date.now();
      const snapshot = await this.conversationsApi.conversationsSnapshot({ transferables: true });
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        quality: items.length > 0 ? 'good' : 'empty',
        metrics: {
          withMessages: items.filter(c => c.messages?.iterable?.length > 0).length,
          totalMessages: items.reduce((sum, c) => sum + (c.messages?.iterable?.length || 0), 0)
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Anchors API health
   */
  async checkAnchors() {
    try {
      const startTime = Date.now();
      const snapshot = await this.anchorsApi.anchorsSnapshot({ transferables: true });
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        quality: items.length > 0 ? 'good' : 'empty',
        metrics: {
          withFullPath: items.filter(a => a.fullpath).length,
          withAssets: items.filter(a => a.assets?.iterable?.length > 0).length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Websites API health
   */
  async checkWebsites() {
    try {
      const startTime = Date.now();
      const snapshot = await this.websitesApi.websitesSnapshot({});
      const responseTime = Date.now() - startTime;
      
      const items = snapshot.iterable || [];
      const lastItem = items.length > 0 ? items[0] : null;

      return {
        status: 'ok',
        count: items.length,
        responseTime,
        lastItem: lastItem?.created?.value || null,
        quality: items.length > 0 ? 'good' : 'empty',
        metrics: {
          withUrl: items.filter(w => w.url).length,
          withName: items.filter(w => w.name).length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        count: 0,
        error: error.message,
        quality: 'error'
      };
    }
  }

  /**
   * Check Vision Status (WPE)
   */
  async checkVisionStatus() {
    try {
      const status = await this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsVisionStatus();
      return {
        active: status.vision || false,
        calibration: status.calibration,
        error: null
      };
    } catch (error) {
      return {
        active: false,
        calibration: null,
        error: error.message
      };
    }
  }

  /**
   * Calculate overall context quality score (0-1)
   */
  calculateOverallQuality(apis, visionStatus) {
    let score = 0;
    let weights = 0;

    // Weight factors for different APIs
    const weightsConfig = {
      assets: 0.15,
      workstreamSummaries: 0.20,
      visionEvents: 0.20,
      activities: 0.10,
      workstreamEvents: 0.10,
      ocrAnalyses: 0.10,
      conversations: 0.05,
      anchors: 0.05,
      websites: 0.05
    };

    // Calculate weighted score for each API
    for (const [apiName, apiData] of Object.entries(apis)) {
      const weight = weightsConfig[apiName] || 0.05;
      weights += weight;

      if (apiData.status === 'error') {
        // Error reduces score significantly
        score += weight * 0.1;
      } else if (apiData.count === 0) {
        // Empty data
        score += weight * 0.2;
      } else {
        // Calculate quality based on count and quality indicators
        let apiScore = 0.5; // Base score for having data

        // Bonus for quantity (diminishing returns after 100 items)
        apiScore += Math.min(apiData.count / 200, 0.25);

        // Bonus/penalty for quality indicators
        if (apiData.quality === 'good') {
          apiScore += 0.25;
        } else if (apiData.quality === 'empty_content' || apiData.quality === 'no_ocr') {
          apiScore -= 0.3;
        } else if (apiData.quality === 'sparse_content' || apiData.quality === 'low_ocr') {
          apiScore -= 0.15;
        }

        score += weight * Math.max(0, Math.min(1, apiScore));
      }
    }

    // Vision status bonus/penalty
    if (!visionStatus.active) {
      score *= 0.7; // 30% penalty if vision is not active
    }

    return Math.round((score / Math.max(weights, 1)) * 100) / 100;
  }

  /**
   * Determine overall health status
   */
  determineOverallStatus(apis, connectivity, overallQuality) {
    if (!connectivity.connected) {
      return 'unhealthy';
    }

    const errorCount = Object.values(apis).filter(a => a.status === 'error').length;
    const totalApis = Object.keys(apis).length;

    if (errorCount > totalApis / 2) {
      return 'unhealthy';
    }

    if (errorCount > 0 || overallQuality < 0.4) {
      return 'degraded';
    }

    if (overallQuality < 0.6) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(apis, visionStatus, connectivity) {
    const recommendations = [];

    // Connectivity issues
    if (!connectivity.connected) {
      recommendations.push('🔴 Pieces OS not connected - ensure Pieces OS is running');
      return recommendations;
    }

    // Vision/WPE issues
    if (!visionStatus.active) {
      recommendations.push('📹 WPE Vision not active - check screen recording permissions in Pieces OS settings');
    }

    // Vision events quality
    if (apis.visionEvents.quality === 'no_ocr') {
      recommendations.push('🔍 Vision events lack OCR text - check OCR engine is enabled in Pieces OS');
    } else if (apis.visionEvents.quality === 'low_ocr') {
      recommendations.push('⚠️ Low OCR coverage in vision events - consider adjusting WPE capture settings');
    }

    // Workstream summaries quality
    if (apis.workstreamSummaries.quality === 'empty_content') {
      recommendations.push('📄 Workstream summaries have no content - investigate annotation storage or summary generation');
    } else if (apis.workstreamSummaries.quality === 'sparse_content') {
      recommendations.push('📄 Many workstream summaries lack content - check summary generation pipeline');
    }

    // OCR analyses
    if (apis.ocrAnalyses.quality === 'no_text') {
      recommendations.push('📝 OCR analyses exist but contain no text - verify OCR processing is working');
    }

    // Low data warnings
    if (apis.visionEvents.count === 0) {
      recommendations.push('📊 No vision events captured - enable Workstream Pattern Engine in Pieces OS');
    }

    if (apis.assets.count === 0) {
      recommendations.push('📦 No assets found - start saving code snippets and notes to Pieces');
    }

    if (apis.activities.count === 0) {
      recommendations.push('📈 No activity data - enable activity tracking in Pieces OS');
    }

    // Recent data freshness
    const now = new Date();
    const checkFreshness = (apiName, lastItem) => {
      if (!lastItem) return;
      const lastDate = new Date(lastItem);
      const hoursAgo = (now - lastDate) / (1000 * 60 * 60);
      
      if (hoursAgo > 24) {
        recommendations.push(`⏰ ${apiName} data is stale (${Math.round(hoursAgo)}h old) - check data collection`);
      }
    };

    checkFreshness('Vision events', apis.visionEvents.lastItem);
    checkFreshness('Activities', apis.activities.lastItem);

    // API errors
    Object.entries(apis).forEach(([name, data]) => {
      if (data.status === 'error') {
        recommendations.push(`❌ ${name} API error: ${data.error?.substring(0, 100)}`);
      }
    });

    return recommendations.length > 0 ? recommendations : ['✅ All systems operational - context quality is good'];
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(apis, overallQuality) {
    const totalItems = Object.values(apis).reduce((sum, api) => sum + (api.count || 0), 0);
    const activeApis = Object.values(apis).filter(a => a.status === 'ok' && a.count > 0).length;
    const totalApis = Object.keys(apis).length;

    let qualityLabel = 'Poor';
    if (overallQuality >= 0.8) qualityLabel = 'Excellent';
    else if (overallQuality >= 0.6) qualityLabel = 'Good';
    else if (overallQuality >= 0.4) qualityLabel = 'Fair';

    return {
      totalItems,
      activeApis,
      totalApis,
      qualityLabel,
      description: `${qualityLabel} context quality with ${totalItems} total items across ${activeApis}/${totalApis} active data sources`
    };
  }

  /**
   * Add health data to history
   */
  addToHistory(health) {
    this.history.push({
      timestamp: health.lastUpdated,
      status: health.status,
      overallContextQuality: health.overallContextQuality,
      totalItems: health.summary?.totalItems || 0
    });

    // Keep history within bounds
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get history summary
   */
  getHistorySummary() {
    if (this.history.length < 2) {
      return { trend: 'insufficient_data', change: 0 };
    }

    const recent = this.history.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const qualityChange = last.overallContextQuality - first.overallContextQuality;
    
    let trend = 'stable';
    if (qualityChange > 0.1) trend = 'improving';
    else if (qualityChange < -0.1) trend = 'declining';

    return {
      trend,
      change: Math.round(qualityChange * 100) / 100,
      dataPoints: this.history.length,
      last24h: recent.filter(h => {
        const hoursAgo = (Date.now() - new Date(h.timestamp)) / (1000 * 60 * 60);
        return hoursAgo < 24;
      }).length
    };
  }

  /**
   * Run additional diagnostics
   */
  async runDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      checks: []
    };

    // Check each API individually with timing
    const apiChecks = [
      { name: 'WellKnown/Health', fn: () => this.wellKnownApi.getWellKnownHealth() },
      { name: 'Assets', fn: () => this.assetsApi.assetsSnapshot({}) },
      { name: 'WorkstreamSummaries', fn: () => this.workstreamSummariesApi.workstreamSummariesSnapshot({}) },
      { name: 'VisionEvents', fn: () => this.workstreamPatternEngineApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({ transferables: false }) },
      { name: 'Activities', fn: () => this.activitiesApi.activitiesSnapshot({}) },
      { name: 'OCRAnalyses', fn: () => this.ocrAnalysesApi.ocrAnalysesSnapshot({ transferables: false }) }
    ];

    for (const check of apiChecks) {
      const startTime = Date.now();
      try {
        await check.fn();
        diagnostics.checks.push({
          name: check.name,
          status: 'ok',
          responseTime: Date.now() - startTime
        });
      } catch (error) {
        diagnostics.checks.push({
          name: check.name,
          status: 'error',
          responseTime: Date.now() - startTime,
          error: error.message
        });
      }
    }

    diagnostics.avgResponseTime = Math.round(
      diagnostics.checks.reduce((sum, c) => sum + c.responseTime, 0) / diagnostics.checks.length
    );

    return diagnostics;
  }

  /**
   * Get default health response when no data available
   */
  getDefaultHealth() {
    return {
      status: 'unknown',
      piecesConnected: false,
      lastUpdated: new Date().toISOString(),
      apis: {},
      overallContextQuality: 0,
      recommendations: ['Initializing health check...'],
      summary: {
        description: 'Health check initializing, please wait...'
      }
    };
  }
}

// Export singleton instance
module.exports = new ContextHealthService();
