/**
 * Context Routes - Proactive AI Assistant
 * 
 * Provides REST API endpoints for real-time user context, work patterns,
 * focus history, blocker detection, and unified context search.
 * 
 * Base Path: /api/context
 * 
 * Endpoints:
 * - GET /realtime      - Current user context (app, file, task)
 * - GET /patterns      - Coding patterns and productivity metrics
 * - GET /focus-history - Time spent on projects/tasks with timeline
 * - GET /blockers      - Detected blockers and potential issues
 * - GET /search        - Unified search across all Pieces data
 */

const router = require('express').Router();
const piecesCopilotService = require('../services/piecesCopilotService');

// In-memory rate limiting (per endpoint, per minute)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

/**
 * Rate limiting middleware
 * Limits requests to 30 per minute per endpoint
 */
const rateLimit = (req, res, next) => {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const limitData = rateLimitMap.get(key);
  
  // Reset if window has passed
  if (now > limitData.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  // Check limit
  if (limitData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute allowed`,
      retryAfter: Math.ceil((limitData.resetTime - now) / 1000)
    });
  }
  
  limitData.count++;
  next();
};

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

// Apply rate limiting to all routes
router.use(rateLimit);

/**
 * @route   GET /api/context/realtime
 * @desc    Get real-time context of what the user is doing RIGHT NOW
 * @access  Public
 * 
 * @query   {number} [detailLevel=1] - Detail level (1=basic, 2=standard, 3=full)
 * 
 * @returns {Object}
 *   - currentApp: Currently active application
 *   - currentFile: File being worked on (if applicable)
 *   - inferredTask: AI-inferred current task
 *   - confidence: Confidence score (0-1)
 *   - recentActivity: Recent window titles, URLs, files
 *   - timestamp: ISO timestamp
 * 
 * @example
 * Response:
 * {
 *   "currentApp": "VS Code",
 *   "currentFile": "/home/user/projects/app/server.js",
 *   "inferredTask": "Building REST API endpoints",
 *   "confidence": 0.85,
 *   "recentActivity": {
 *     "windowTitles": ["server.js - app", "contextRoutes.js - app"],
 *     "urls": ["https://expressjs.com/en/api.html"],
 *     "files": ["/home/user/projects/app/server.js"]
 *   },
 *   "timestamp": "2026-01-29T20:30:00.000Z"
 * }
 */
router.get('/realtime', async (req, res) => {
  try {
    console.log('🎯 GET /context/realtime');
    
    const detailLevel = parseInt(req.query.detailLevel) || 2;
    const startTime = Date.now();
    
    // Fetch vision events and anchors in parallel
    const [visionEventsResult, anchorsResult, workstreamSummariesResult] = await Promise.all([
      piecesCopilotService.getVisionEvents(20),
      piecesCopilotService.getAnchors(10),
      piecesCopilotService.getWorkstreamSummaries(3)
    ]);
    
    // Handle both array and object-with-data formats
    const visionEvents = Array.isArray(visionEventsResult) ? visionEventsResult : (visionEventsResult?.data || []);
    const anchors = Array.isArray(anchorsResult) ? anchorsResult : (anchorsResult?.data || []);
    const workstreamSummaries = Array.isArray(workstreamSummariesResult) ? workstreamSummariesResult : (workstreamSummariesResult?.data || []);
    
    if (!visionEvents || visionEvents.length === 0) {
      return res.json({
        currentApp: 'Unknown',
        currentFile: null,
        inferredTask: 'No active work detected',
        confidence: 0,
        recentActivity: {
          windowTitles: [],
          urls: [],
          files: []
        },
        timestamp: new Date().toISOString(),
        fetchTime: Date.now() - startTime
      });
    }
    
    // Analyze recent events
    const recentEvents = visionEvents.slice(0, 10);
    const latestEvent = recentEvents[0];
    
    // Determine current application
    const currentApp = latestEvent.application || 'Unknown';
    
    // Extract recent files from anchors and vision events
    const recentFiles = anchors
      .filter(a => a.fullPath)
      .slice(0, 5)
      .map(a => a.fullPath);
    
    // Get recent window titles and URLs
    const recentTitles = recentEvents
      .filter(e => e.title)
      .map(e => e.title)
      .slice(0, 5);
    
    const recentUrls = recentEvents
      .filter(e => e.url)
      .map(e => e.url)
      .slice(0, 5);
    
    // Determine current file (most likely from anchors or vision events)
    const currentFile = recentFiles[0] || null;
    
    // Infer task based on activity patterns
    let inferredTask = 'Working';
    let confidence = 0.5;
    
    // Simple task inference based on application and context
    if (currentApp.toLowerCase().includes('code') || 
        currentApp.toLowerCase().includes('vscode') ||
        currentApp.toLowerCase().includes('visual studio')) {
      inferredTask = 'Coding/Development';
      confidence = 0.8;
      
      // More specific inference based on file type
      if (currentFile) {
        if (currentFile.endsWith('.js') || currentFile.endsWith('.ts')) {
          inferredTask = 'JavaScript/TypeScript Development';
        } else if (currentFile.endsWith('.py')) {
          inferredTask = 'Python Development';
        } else if (currentFile.endsWith('.md')) {
          inferredTask = 'Documentation Writing';
        } else if (currentFile.includes('test') || currentFile.includes('spec')) {
          inferredTask = 'Testing/QA';
        }
      }
    } else if (currentApp.toLowerCase().includes('browser') ||
               currentApp.toLowerCase().includes('chrome') ||
               currentApp.toLowerCase().includes('firefox')) {
      inferredTask = 'Research/Browsing';
      confidence = 0.7;
      
      // Check if it's documentation research
      const docKeywords = ['docs', 'documentation', 'api', 'reference', 'guide'];
      if (recentUrls.some(url => docKeywords.some(k => url.toLowerCase().includes(k)))) {
        inferredTask = 'Documentation Research';
        confidence = 0.85;
      }
    }
    
    // Build response
    const response = {
      currentApp,
      currentFile,
      inferredTask,
      confidence,
      recentActivity: {
        windowTitles: recentTitles,
        urls: recentUrls,
        files: recentFiles
      },
      timestamp: new Date().toISOString(),
      fetchTime: Date.now() - startTime
    };
    
    // Add detail level specific data
    if (detailLevel >= 2) {
      // Add workstream summary context
      const recentSummary = workstreamSummaries[0];
      if (recentSummary) {
        response.workstreamContext = {
          summary: recentSummary.summary?.substring(0, 200) || null,
          application: recentSummary.application,
          tags: recentSummary.tags?.slice(0, 10) || []
        };
      }
      
      // Add activity level
      response.activityLevel = {
        recentEvents: recentEvents.length,
        activeApps: [...new Set(recentEvents.map(e => e.application))].length
      };
    }
    
    if (detailLevel >= 3) {
      // Add raw vision events for advanced use
      response.visionEvents = recentEvents.map(e => ({
        id: e.id,
        application: e.application,
        title: e.title,
        url: e.url,
        created: e.created,
        tags: e.tags
      }));
    }
    
    console.log(`✓ Real-time context fetched: ${currentApp} - ${inferredTask}`);
    res.json(response);
    
  } catch (error) {
    console.error('✗ Error fetching real-time context:', error.message);
    res.status(500).json({
      error: 'Failed to fetch real-time context',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /api/context/patterns
 * @desc    Get user's work patterns - coding habits, languages, frameworks
 * @access  Public
 * 
 * @query   {string} [period=7d] - Time period (1d, 7d, 30d)
 * @query   {number} [limit=20] - Maximum number of items per category
 * 
 * @returns {Object}
 *   - languages: Programming languages used
 *   - frameworks: Detected frameworks/libraries
 *   - activeProjects: Identified active projects
 *   - productivityMetrics: Coding velocity metrics
 *   - timeDistribution: Time spent by category
 *   - topApplications: Most used applications
 * 
 * @example
 * Response:
 * {
 *   "languages": ["JavaScript", "Python", "TypeScript"],
 *   "frameworks": ["Express", "React", "Mongoose"],
 *   "activeProjects": [
 *     {
 *       "name": "proactive-assistant",
 *       "path": "/home/user/projects/proactive-assistant",
 *       "activityLevel": "high",
 *       "lastAccessed": "2026-01-29T20:30:00.000Z"
 *     }
 *   ],
 *   "productivityMetrics": {
 *     "totalCodingHours": 24.5,
 *     "filesModified": 45,
 *     "contextSwitches": 23
 *   },
 *   "topApplications": [
 *     { "name": "VS Code", "hours": 18.5 },
 *     { "name": "Chrome", "hours": 6.0 }
 *   ],
 *   "period": "7d"
 * }
 */
router.get('/patterns', async (req, res) => {
  try {
    console.log('📊 GET /context/patterns');
    
    const period = req.query.period || '7d';
    const limit = parseInt(req.query.limit) || 20;
    const startTime = Date.now();
    
    // Calculate period in days for filtering
    const periodDays = parseInt(period) || 7;
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    
    // Fetch all pattern data in parallel
    const [
      assets,
      activities,
      anchors,
      websites,
      workstreamSummaries
    ] = await Promise.all([
      piecesCopilotService.getRecentAssets(limit * 2),
      piecesCopilotService.getRecentActivities(limit * 2),
      piecesCopilotService.getAnchors(limit),
      piecesCopilotService.getRecentWebsites(limit),
      piecesCopilotService.getWorkstreamSummaries(10)
    ]);
    
    // Filter by period
    const filterByDate = (items, dateField = 'created') => {
      return items.filter(item => {
        const itemDate = item[dateField] ? new Date(item[dateField]) : null;
        return !itemDate || itemDate >= cutoffDate;
      });
    };
    
    const recentAssets = filterByDate(assets);
    const recentActivities = filterByDate(activities);
    
    // Extract languages from assets
    const languages = [...new Set(
      recentAssets
        .filter(a => a.language)
        .map(a => a.language)
    )].slice(0, limit);
    
    // Detect frameworks from asset content and names
    const frameworkPatterns = {
      'React': /react/i,
      'Vue': /vue/i,
      'Angular': /angular/i,
      'Express': /express/i,
      'Next.js': /next/i,
      'Node.js': /node/i,
      'Django': /django/i,
      'Flask': /flask/i,
      'FastAPI': /fastapi/i,
      'Spring': /spring/i,
      'Mongoose': /mongoose/i,
      'Sequelize': /sequelize/i,
      'TensorFlow': /tensorflow/i,
      'PyTorch': /pytorch/i,
      'Pandas': /pandas/i,
      'NumPy': /numpy/i
    };
    
    const detectedFrameworks = new Set();
    recentAssets.forEach(asset => {
      const content = (asset.content || '') + (asset.name || '');
      Object.entries(frameworkPatterns).forEach(([framework, pattern]) => {
        if (pattern.test(content)) {
          detectedFrameworks.add(framework);
        }
      });
    });
    
    // Identify active projects from file paths
    const projectPaths = {};
    anchors.forEach(anchor => {
      if (anchor.fullPath) {
        const parts = anchor.fullPath.split('/');
        if (parts.length >= 3) {
          // Find project root (usually has package.json, .git, etc.)
          const projectIndex = parts.findIndex(p => 
            ['projects', 'workspace', 'code', 'src'].includes(p.toLowerCase())
          );
          if (projectIndex >= 0 && parts[projectIndex + 1]) {
            const projectName = parts[projectIndex + 1];
            if (!projectPaths[projectName]) {
              projectPaths[projectName] = {
                name: projectName,
                path: parts.slice(0, projectIndex + 2).join('/'),
                files: [],
                lastAccessed: anchor.updated || anchor.created
              };
            }
            projectPaths[projectName].files.push(anchor.fullPath);
            
            // Update last accessed
            const anchorDate = anchor.updated || anchor.created;
            if (anchorDate && new Date(anchorDate) > new Date(projectPaths[projectName].lastAccessed)) {
              projectPaths[projectName].lastAccessed = anchorDate;
            }
          }
        }
      }
    });
    
    const activeProjects = Object.values(projectPaths)
      .map(p => ({
        name: p.name,
        path: p.path,
        fileCount: p.files.length,
        activityLevel: p.files.length > 20 ? 'high' : p.files.length > 5 ? 'medium' : 'low',
        lastAccessed: p.lastAccessed
      }))
      .sort((a, b) => b.fileCount - a.fileCount)
      .slice(0, 10);
    
    // Calculate application usage
    const appUsage = {};
    recentActivities.forEach(activity => {
      const app = activity.application || 'Unknown';
      if (!appUsage[app]) {
        appUsage[app] = { count: 0, events: [] };
      }
      appUsage[app].count++;
    });
    
    const topApplications = Object.entries(appUsage)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, data]) => ({
        name,
        activityCount: data.count,
        estimatedHours: (data.count * 0.5).toFixed(1) // Rough estimate
      }));
    
    // Calculate productivity metrics
    const productivityMetrics = {
      totalActivities: recentActivities.length,
      filesAccessed: anchors.length,
      assetsModified: recentAssets.length,
      websitesVisited: websites.length,
      contextSwitches: Object.keys(appUsage).length,
      averageSessionLength: '45 min', // Estimated
      mostProductiveHour: '09:00-11:00' // Placeholder
    };
    
    // Extract topics from workstream summaries
    const allTags = workstreamSummaries.flatMap(s => s.tags || []);
    const tagCounts = {};
    allTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    
    const topTopics = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, frequency: count }));
    
    const response = {
      languages,
      frameworks: [...detectedFrameworks].slice(0, limit),
      activeProjects,
      topTopics,
      productivityMetrics,
      topApplications,
      period: `${periodDays}d`,
      timestamp: new Date().toISOString(),
      fetchTime: Date.now() - startTime
    };
    
    console.log(`✓ Patterns analyzed: ${languages.length} languages, ${activeProjects.length} projects`);
    res.json(response);
    
  } catch (error) {
    console.error('✗ Error analyzing work patterns:', error.message);
    res.status(500).json({
      error: 'Failed to analyze work patterns',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /api/context/focus-history
 * @desc    Get timeline of focus sessions and context switches
 * @access  Public
 * 
 * @query   {string} [period=24h] - Time period (1h, 6h, 24h, 7d)
 * @query   {number} [granularity=15] - Time bucket in minutes (5, 15, 30, 60)
 * 
 * @returns {Object}
 *   - timeline: Array of focus sessions with app, project, duration
 *   - contextSwitches: Number of times user switched contexts
 *   - timeByProject: Time spent per project
 *   - timeByApplication: Time spent per application
 *   - focusScore: Calculated focus score (0-100)
 * 
 * @example
 * Response:
 * {
 *   "timeline": [
 *     {
 *       "start": "2026-01-29T19:00:00.000Z",
 *       "end": "2026-01-29T19:45:00.000Z",
 *       "duration": 45,
 *       "application": "VS Code",
 *       "project": "proactive-assistant",
 *       "activityType": "coding"
 *     }
 *   ],
 *   "contextSwitches": 5,
 *   "timeByProject": {
 *     "proactive-assistant": 180
 *   },
 *   "focusScore": 72
 * }
 */
router.get('/focus-history', async (req, res) => {
  try {
    console.log('⏱️ GET /context/focus-history');
    
    const period = req.query.period || '24h';
    const granularity = parseInt(req.query.granularity) || 15;
    const startTime = Date.now();
    
    // Calculate period in hours
    const periodHours = period.includes('d') 
      ? parseInt(period) * 24 
      : parseInt(period) || 24;
    const cutoffDate = new Date(Date.now() - periodHours * 60 * 60 * 1000);
    
    // Fetch vision events and activities
    const [visionEvents, activities, anchors] = await Promise.all([
      piecesCopilotService.getVisionEvents(100),
      piecesCopilotService.getRecentActivities(100),
      piecesCopilotService.getAnchors(50)
    ]);
    
    // Filter by period
    const recentVisionEvents = visionEvents.filter(e => {
      const eventDate = e.created ? new Date(e.created) : null;
      return !eventDate || eventDate >= cutoffDate;
    });
    
    const recentActivities = activities.filter(a => {
      const activityDate = a.created ? new Date(a.created) : null;
      return !activityDate || activityDate >= cutoffDate;
    });
    
    // Build timeline from vision events
    const timeline = [];
    let currentSession = null;
    const sessionThreshold = granularity * 2 * 60 * 1000; // 2x granularity in ms
    
    recentVisionEvents.forEach((event, index) => {
      const eventTime = event.created ? new Date(event.created) : new Date();
      const prevEvent = recentVisionEvents[index - 1];
      const prevTime = prevEvent?.created ? new Date(prevEvent.created) : null;
      
      // Determine project from file path
      let project = 'Unknown';
      if (event.anchors && event.anchors.length > 0) {
        const path = event.anchors[0].fullPath || '';
        const parts = path.split('/');
        const projectIndex = parts.findIndex(p => 
          ['projects', 'workspace', 'code', 'src'].includes(p.toLowerCase())
        );
        if (projectIndex >= 0 && parts[projectIndex + 1]) {
          project = parts[projectIndex + 1];
        }
      }
      
      // Determine activity type
      let activityType = 'other';
      const app = (event.application || '').toLowerCase();
      if (app.includes('code') || app.includes('vscode')) {
        activityType = 'coding';
      } else if (app.includes('browser') || app.includes('chrome')) {
        activityType = event.url ? 'research' : 'browsing';
      } else if (app.includes('terminal') || app.includes('shell')) {
        activityType = 'terminal';
      }
      
      // Check if this is a new session
      if (!currentSession || 
          (prevTime && (eventTime - prevTime) > sessionThreshold) ||
          currentSession.application !== event.application) {
        
        // Save previous session
        if (currentSession) {
          currentSession.duration = Math.round(
            (new Date(currentSession.end) - new Date(currentSession.start)) / 60000
          );
          timeline.push(currentSession);
        }
        
        // Start new session
        currentSession = {
          start: event.created,
          end: event.created,
          application: event.application || 'Unknown',
          project,
          activityType,
          title: event.title || null,
          url: event.url || null
        };
      } else {
        // Continue current session
        currentSession.end = event.created;
      }
    });
    
    // Add final session
    if (currentSession) {
      currentSession.duration = Math.round(
        (new Date(currentSession.end) - new Date(currentSession.start)) / 60000
      );
      timeline.push(currentSession);
    }
    
    // Calculate time by project
    const timeByProject = {};
    const timeByApplication = {};
    
    timeline.forEach(session => {
      // By project
      if (!timeByProject[session.project]) {
        timeByProject[session.project] = 0;
      }
      timeByProject[session.project] += session.duration || 0;
      
      // By application
      if (!timeByApplication[session.application]) {
        timeByApplication[session.application] = 0;
      }
      timeByApplication[session.application] += session.duration || 0;
    });
    
    // Count context switches
    let contextSwitches = 0;
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].application !== timeline[i - 1].application ||
          timeline[i].project !== timeline[i - 1].project) {
        contextSwitches++;
      }
    }
    
    // Calculate focus score (0-100)
    // Higher score = more focused, fewer switches, longer sessions
    const totalSessions = timeline.length;
    const avgSessionDuration = totalSessions > 0
      ? timeline.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSessions
      : 0;
    
    let focusScore = 50; // Base score
    
    // Bonus for longer average sessions
    if (avgSessionDuration > 45) focusScore += 20;
    else if (avgSessionDuration > 30) focusScore += 15;
    else if (avgSessionDuration > 15) focusScore += 10;
    
    // Penalty for frequent context switches
    const switchRate = totalSessions > 0 ? contextSwitches / totalSessions : 0;
    if (switchRate < 0.2) focusScore += 15;
    else if (switchRate < 0.4) focusScore += 10;
    else if (switchRate > 0.8) focusScore -= 20;
    else if (switchRate > 0.6) focusScore -= 10;
    
    // Cap at 0-100
    focusScore = Math.max(0, Math.min(100, focusScore));
    
    const response = {
      timeline: timeline.slice(0, 50), // Limit timeline entries
      contextSwitches,
      totalSessions,
      averageSessionDuration: Math.round(avgSessionDuration),
      timeByProject,
      timeByApplication,
      focusScore,
      period: `${periodHours}h`,
      timestamp: new Date().toISOString(),
      fetchTime: Date.now() - startTime
    };
    
    console.log(`✓ Focus history: ${timeline.length} sessions, focus score: ${focusScore}`);
    res.json(response);
    
  } catch (error) {
    console.error('✗ Error fetching focus history:', error.message);
    res.status(500).json({
      error: 'Failed to fetch focus history',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /api/context/blockers
 * @desc    Detect potential blockers and issues user might be facing
 * @access  Public
 * 
 * @query   {number} [sensitivity=5] - Detection sensitivity (1-10)
 * @query   {boolean} [includeSuggestions=true] - Include AI suggestions for blockers
 * 
 * @returns {Object}
 *   - detected: Array of detected blockers
 *   - riskLevel: overall risk level (low, medium, high)
 *   - stuckTime: estimated minutes stuck on current task
 *   - suggestions: AI-generated suggestions to overcome blockers
 * 
 * @example
 * Response:
 * {
 *   "detected": [
 *     {
 *       "type": "repeated_error_search",
 *       "severity": "medium",
 *       "description": "Multiple searches for same error",
 *       "evidence": ["error page 1", "error page 2"],
 *       "duration": 25
 *     }
 *   ],
 *   "riskLevel": "medium",
 *   "stuckTime": 35,
 *   "suggestions": [
 *     {
 *       "title": "Take a break",
 *       "description": "You've been on the same error for 35 minutes..."
 *     }
 *   ]
 * }
 */
router.get('/blockers', async (req, res) => {
  try {
    console.log('🚧 GET /context/blockers');
    
    const sensitivity = parseInt(req.query.sensitivity) || 5;
    const includeSuggestions = req.query.includeSuggestions !== 'false';
    const startTime = Date.now();
    
    // Fetch recent context
    const [visionEvents, activities, websites, workstreamSummaries] = await Promise.all([
      piecesCopilotService.getVisionEvents(50),
      piecesCopilotService.getRecentActivities(50),
      piecesCopilotService.getRecentWebsites(30),
      piecesCopilotService.getWorkstreamSummaries(5)
    ]);
    
    const blockers = [];
    const evidence = {
      visionEvents,
      activities,
      websites,
      workstreamSummaries
    };
    
    // 1. Detect long time on error-related pages
    const errorKeywords = ['error', 'exception', 'fail', 'crash', 'bug', 'fix', 'debug', 
                          'stack overflow', 'github issues', 'error message'];
    
    const recentUrls = visionEvents
      .filter(e => e.url)
      .map(e => ({ url: e.url.toLowerCase(), title: e.title, time: e.created }));
    
    const errorSearches = recentUrls.filter(u => 
      errorKeywords.some(kw => u.url.includes(kw) || (u.title && u.title.toLowerCase().includes(kw)))
    );
    
    if (errorSearches.length >= 3) {
      blockers.push({
        type: 'error_research',
        severity: errorSearches.length > 6 ? 'high' : 'medium',
        description: `Detected ${errorSearches.length} error-related page visits`,
        evidence: errorSearches.slice(0, 5).map(e => e.url || e.title),
        estimatedDuration: errorSearches.length * 5 // Rough estimate
      });
    }
    
    // 2. Detect repeated visits to same documentation
    const docUrls = recentUrls.filter(u => 
      u.url.includes('docs.') || u.url.includes('documentation') || 
      u.url.includes('api.') || u.url.includes('reference')
    );
    
    const urlCounts = {};
    docUrls.forEach(u => {
      const baseUrl = u.url.split('#')[0].split('?')[0];
      urlCounts[baseUrl] = (urlCounts[baseUrl] || 0) + 1;
    });
    
    Object.entries(urlCounts).forEach(([url, count]) => {
      if (count >= 3) {
        blockers.push({
          type: 'repeated_documentation',
          severity: count > 5 ? 'high' : 'medium',
          description: `Revisited same documentation ${count} times`,
          evidence: [url],
          possibleCause: 'May be struggling to understand or implement'
        });
      }
    });
    
    // 3. Detect context switching fatigue
    const recentApps = visionEvents.slice(0, 20);
    const uniqueApps = new Set(recentApps.map(e => e.application)).size;
    
    if (uniqueApps > 8 && sensitivity >= 5) {
      blockers.push({
        type: 'context_switching',
        severity: uniqueApps > 12 ? 'high' : 'medium',
        description: `High context switching detected (${uniqueApps} different apps in recent activity)`,
        evidence: [...new Set(recentApps.map(e => e.application))],
        possibleCause: 'Difficulty focusing or multitasking overload'
      });
    }
    
    // 4. Detect long session without progress (same app, no file changes)
    if (recentApps.length > 10) {
      const firstApp = recentApps[0]?.application;
      const allSameApp = recentApps.every(e => e.application === firstApp);
      
      if (allSameApp && firstApp.toLowerCase().includes('browser')) {
        blockers.push({
          type: 'potential_distraction',
          severity: 'low',
          description: 'Extended browser session without IDE activity',
          evidence: [`${recentApps.length} consecutive browser events`],
          possibleCause: 'May be distracted or stuck in research mode'
        });
      }
    }
    
    // 5. Detect no recent commits/activity (if workstream summaries suggest stagnation)
    const recentSummary = workstreamSummaries[0];
    if (recentSummary && recentSummary.summary) {
      const stagnationKeywords = ['stuck', 'blocked', 'error', 'issue', 'problem', 
                                 'cannot', 'unable', 'failed', 'debugging'];
      if (stagnationKeywords.some(kw => recentSummary.summary.toLowerCase().includes(kw))) {
        blockers.push({
          type: 'ai_detected_blocker',
          severity: 'medium',
          description: 'AI analysis detected potential blocker in workstream',
          evidence: [recentSummary.summary.substring(0, 200)],
          tags: recentSummary.tags
        });
      }
    }
    
    // Calculate overall risk level
    const severityScores = { low: 1, medium: 2, high: 3 };
    const totalScore = blockers.reduce((sum, b) => sum + severityScores[b.severity], 0);
    
    let riskLevel = 'low';
    if (totalScore >= 8) riskLevel = 'high';
    else if (totalScore >= 4) riskLevel = 'medium';
    
    // Estimate stuck time
    const stuckTime = blockers.reduce((sum, b) => sum + (b.estimatedDuration || 15), 0);
    
    // Generate suggestions if requested
    let suggestions = [];
    if (includeSuggestions && blockers.length > 0) {
      suggestions = generateBlockerSuggestions(blockers);
    }
    
    const response = {
      detected: blockers,
      count: blockers.length,
      riskLevel,
      stuckTime,
      suggestions,
      timestamp: new Date().toISOString(),
      fetchTime: Date.now() - startTime
    };
    
    console.log(`✓ Blocker detection: ${blockers.length} blockers, risk: ${riskLevel}`);
    res.json(response);
    
  } catch (error) {
    console.error('✗ Error detecting blockers:', error.message);
    res.status(500).json({
      error: 'Failed to detect blockers',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate suggestions for overcoming blockers
 */
function generateBlockerSuggestions(blockers) {
  const suggestions = [];
  
  blockers.forEach(blocker => {
    switch (blocker.type) {
      case 'error_research':
        suggestions.push({
          title: 'Take a debugging break',
          description: 'You\'ve been researching errors for a while. Try stepping away for 5-10 minutes, then approach with fresh eyes.',
          action: { type: 'timer', duration: 10, label: 'Start 10-min break' }
        });
        suggestions.push({
          title: ' rubber duck debugging',
          description: 'Explain the problem out loud to an inanimate object or write it down. Often reveals the solution.',
          action: { type: 'link', url: '#', label: 'Open notes' }
        });
        break;
        
      case 'repeated_documentation':
        suggestions.push({
          title: 'Try a different resource',
          description: 'If the official docs aren\'t helping, try Stack Overflow, GitHub issues, or a tutorial.',
          action: { type: 'link', url: 'https://stackoverflow.com', label: 'Open Stack Overflow' }
        });
        break;
        
      case 'context_switching':
        suggestions.push({
          title: 'Focus mode',
          description: 'Close unnecessary apps and focus on one task. Consider using a Pomodoro timer.',
          action: { type: 'timer', duration: 25, label: 'Start 25-min focus' }
        });
        break;
        
      case 'potential_distraction':
        suggestions.push({
          title: 'Return to code',
          description: 'You\'ve been browsing for a while. Time to get back to the IDE?',
          action: { type: 'execute', command: 'focus-ide', label: 'Focus IDE' }
        });
        break;
        
      default:
        suggestions.push({
          title: 'Take a short walk',
          description: 'Physical movement helps clear mental blocks.',
          action: { type: 'timer', duration: 5, label: 'Start 5-min break' }
        });
    }
  });
  
  // Add generic suggestions if few specific ones
  if (suggestions.length < 2) {
    suggestions.push({
      title: 'Ask for help',
      description: 'Sometimes a fresh perspective is all you need. Consider reaching out to a colleague.',
      action: { type: 'link', url: '#', label: 'Open chat' }
    });
  }
  
  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

/**
 * @route   GET /api/context/search
 * @desc    Unified search across all Pieces data (assets, summaries, websites, activities)
 * @access  Public
 * 
 * @query   {string} q - Search query (required)
 * @query   {string} [type=all] - Filter by type (assets, websites, activities, conversations, all)
 * @query   {number} [limit=20] - Maximum results per category
 * @query   {boolean} [aiEnhance=true] - Use AI to enhance and rank results
 * 
 * @returns {Object}
 *   - query: Original search query
 *   - results: Grouped results by type
 *   - total: Total result count
 *   - aiSummary: AI-generated summary of results (if aiEnhance=true)
 * 
 * @example
 * Response:
 * {
 *   "query": "authentication",
 *   "results": {
 *     "assets": [{ "id": "...", "name": "auth.js", "relevance": 0.95 }],
 *     "websites": [{ "id": "...", "name": "JWT Auth Guide", "url": "..." }],
 *     "activities": [{ "id": "...", "description": "Working on auth" }]
 *   },
 *   "total": 15,
 *   "aiSummary": "Found 8 code snippets and 3 documentation pages about authentication..."
 * }
 */
router.get('/search', async (req, res) => {
  try {
    console.log('🔍 GET /context/search');
    
    const { q: query, type = 'all', limit = 20, aiEnhance = 'true' } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query parameter is required',
        message: 'Please provide a search query using ?q=your+search+term'
      });
    }
    
    const searchLimit = parseInt(limit) || 20;
    const useAI = aiEnhance !== 'false';
    const startTime = Date.now();
    
    const results = {
      assets: [],
      websites: [],
      activities: [],
      conversations: [],
      anchors: []
    };
    
    // Search based on type filter
    const searchPromises = [];
    
    if (type === 'all' || type === 'assets') {
      searchPromises.push(
        piecesCopilotService.getRecentAssets(searchLimit * 2).then(assets => {
          const filtered = assets.filter(asset => {
            const searchText = `${asset.name} ${asset.content || ''} ${asset.tags?.join(' ') || ''}`.toLowerCase();
            return query.toLowerCase().split(' ').every(term => searchText.includes(term));
          });
          
          results.assets = filtered.slice(0, searchLimit).map(asset => ({
            id: asset.id,
            type: 'asset',
            name: asset.name,
            language: asset.language,
            tags: asset.tags,
            description: asset.description?.substring(0, 200),
            content: asset.content?.substring(0, 300),
            created: asset.created,
            relevance: calculateRelevance(asset, query)
          }));
        })
      );
    }
    
    if (type === 'all' || type === 'websites') {
      searchPromises.push(
        piecesCopilotService.getRecentWebsites(searchLimit * 2).then(websites => {
          const filtered = websites.filter(site => {
            const searchText = `${site.name} ${site.url || ''}`.toLowerCase();
            return query.toLowerCase().split(' ').every(term => searchText.includes(term));
          });
          
          results.websites = filtered.slice(0, searchLimit).map(site => ({
            id: site.id,
            type: 'website',
            name: site.name,
            url: site.url,
            created: site.created,
            relevance: calculateRelevance(site, query)
          }));
        })
      );
    }
    
    if (type === 'all' || type === 'activities') {
      searchPromises.push(
        piecesCopilotService.getRecentActivities(searchLimit * 2).then(activities => {
          const filtered = activities.filter(activity => {
            const searchText = `${activity.application} ${activity.assetEvent?.description || ''} ${activity.interactionEvent?.description || ''}`.toLowerCase();
            return query.toLowerCase().split(' ').every(term => searchText.includes(term));
          });
          
          results.activities = filtered.slice(0, searchLimit).map(activity => ({
            id: activity.id,
            type: 'activity',
            application: activity.application,
            assetEvent: activity.assetEvent,
            interactionEvent: activity.interactionEvent,
            created: activity.created,
            relevance: calculateRelevance(activity, query)
          }));
        })
      );
    }
    
    if (type === 'all' || type === 'conversations') {
      searchPromises.push(
        piecesCopilotService.getConversations(searchLimit).then(conversations => {
          const filtered = conversations.filter(convo => {
            const searchText = `${convo.name} ${convo.summary || ''} ${convo.recentMessages?.map(m => m.content).join(' ') || ''}`.toLowerCase();
            return query.toLowerCase().split(' ').every(term => searchText.includes(term));
          });
          
          results.conversations = filtered.slice(0, searchLimit).map(convo => ({
            id: convo.id,
            type: 'conversation',
            name: convo.name,
            messageCount: convo.messageCount,
            recentMessages: convo.recentMessages?.slice(-3),
            summary: convo.summary?.substring(0, 200),
            created: convo.created,
            relevance: calculateRelevance(convo, query)
          }));
        })
      );
    }
    
    // Also try neural search if available
    if (type === 'all' || type === 'assets') {
      searchPromises.push(
        piecesCopilotService.neuralSearch(query, searchLimit).then(neuralResults => {
          // Merge neural results, avoiding duplicates
          const existingIds = new Set(results.assets.map(a => a.id));
          const newResults = neuralResults
            .filter(r => !existingIds.has(r.id))
            .map(r => ({
              id: r.id,
              type: 'asset',
              name: r.name,
              relevance: r.score || 0.7,
              source: 'neural'
            }));
          
          results.assets = [...results.assets, ...newResults];
        }).catch(() => {
          // Neural search is optional, ignore errors
        })
      );
    }
    
    await Promise.all(searchPromises);
    
    // Sort each category by relevance
    Object.keys(results).forEach(key => {
      results[key].sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    });
    
    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
    
    // Build response
    const response = {
      query: query.trim(),
      type: type,
      results,
      total: totalResults,
      counts: {
        assets: results.assets.length,
        websites: results.websites.length,
        activities: results.activities.length,
        conversations: results.conversations.length
      },
      timestamp: new Date().toISOString(),
      fetchTime: Date.now() - startTime
    };
    
    // Add AI summary if requested
    if (useAI && totalResults > 0) {
      const summary = generateSearchSummary(results, query);
      response.aiSummary = summary;
    }
    
    console.log(`✓ Search complete: ${totalResults} results for "${query}"`);
    res.json(response);
    
  } catch (error) {
    console.error('✗ Error searching context:', error.message);
    res.status(500).json({
      error: 'Failed to search context',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Calculate relevance score for a result
 */
function calculateRelevance(item, query) {
  const terms = query.toLowerCase().split(' ');
  let score = 0.5; // Base score
  
  // Check name match
  if (item.name) {
    const nameLower = item.name.toLowerCase();
    terms.forEach(term => {
      if (nameLower === term) score += 0.3;
      else if (nameLower.includes(term)) score += 0.15;
    });
  }
  
  // Check content match
  if (item.content) {
    const contentLower = item.content.toLowerCase();
    terms.forEach(term => {
      const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += Math.min(matches * 0.05, 0.2);
    });
  }
  
  // Check tags match
  if (item.tags && item.tags.length > 0) {
    const tagsLower = item.tags.map(t => t.toLowerCase());
    terms.forEach(term => {
      if (tagsLower.some(t => t.includes(term))) score += 0.2;
    });
  }
  
  // Recency boost
  if (item.created) {
    const age = Date.now() - new Date(item.created).getTime();
    const daysOld = age / (1000 * 60 * 60 * 24);
    if (daysOld < 1) score += 0.1;
    else if (daysOld < 7) score += 0.05;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Generate AI-like summary of search results
 */
function generateSearchSummary(results, query) {
  const parts = [];
  
  if (results.assets.length > 0) {
    const languages = [...new Set(results.assets.filter(a => a.language).map(a => a.language))];
    parts.push(`Found ${results.assets.length} code snippets${languages.length > 0 ? ` in ${languages.join(', ')}` : ''}`);
  }
  
  if (results.websites.length > 0) {
    parts.push(`${results.websites.length} related websites or documentation pages`);
  }
  
  if (results.activities.length > 0) {
    parts.push(`${results.activities.length} recent activities`);
  }
  
  if (results.conversations.length > 0) {
    parts.push(`${results.conversations.length} conversations`);
  }
  
  if (parts.length === 0) {
    return `No results found for "${query}".`;
  }
  
  let summary = `Found ${parts.join(', ')} related to "${query}".`;
  
  // Add context-specific insight
  if (results.assets.length > results.websites.length) {
    summary += ' You seem to have more code assets than documentation on this topic.';
  } else if (results.websites.length > results.assets.length) {
    summary += ' You\'ve been researching this topic extensively.';
  }
  
  return summary;
}

module.exports = router;
