/**
 * User-Centered AI Service
 * 
 * This service focuses on understanding the developer's actual needs and pain points,
 * providing contextual, actionable assistance rather than generic suggestions.
 * 
 * Core capabilities:
 * 1. Stuck State Detection - Recognizes when developer is struggling
 * 2. Context Recovery - Helps resume work after interruptions
 * 3. Pattern Recognition - Identifies repetitive tasks
 * 4. Wellness Monitoring - Prevents burnout
 * 5. Action-Oriented Suggestions - Every suggestion has a clear action
 */

const piecesCopilotService = require('./piecesCopilotService');
const aiService = require('./aiService');

// Simple in-memory storage for session tracking
// In production, this should use Redis or database
const sessionStore = new Map();
const suggestionFeedback = [];

// Configuration
const CONFIG = {
  // Stuck detection thresholds
  STUCK_THRESHOLDS: {
    MIN_TIME_ON_TASK: 30 * 60 * 1000,        // 30 minutes
    ERROR_SPIKE_WINDOW: 10 * 60 * 1000,       // 10 minutes
    ERROR_SPIKE_COUNT: 5,                     // 5+ errors
    REPEATED_SEARCH_COUNT: 3,                 // Same search 3+ times
    NO_PROGRESS_WINDOW: 45 * 60 * 1000,       // 45 min no commits/saves
  },
  
  // Wellness thresholds
  WELLNESS_THRESHOLDS: {
    CONTINUOUS_WORK_LIMIT: 2 * 60 * 60 * 1000, // 2 hours
    BREAK_REMINDER_INTERVAL: 60 * 60 * 1000,   // Every hour
    HIGH_ERROR_RATE: 10,                        // Errors per 30 min
  },
  
  // Context recovery
  CONTEXT_THRESHOLDS: {
    AWAY_TIME_SHORT: 15 * 60 * 1000,         // 15 min - brief
    AWAY_TIME_LONG: 2 * 60 * 60 * 1000,      // 2 hours - needs recovery
  },
  
  // Suggestion limits
  MAX_SUGGESTIONS: 3,
  SUGGESTION_COOLDOWN: 30 * 60 * 1000,       // 30 min between same type
};

class UserCenteredAIService {
  constructor() {
    this.sessionData = new Map();
    this.suggestionHistory = [];
    this.userPreferences = {
      quietHours: { start: 22, end: 8 },
      doNotDisturb: false,
      suggestionFrequency: 'normal', // low, normal, high
      dismissedSuggestionTypes: new Set(),
    };
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  /**
   * Get or create session for tracking
   */
  getSession(sessionId = 'default') {
    if (!this.sessionData.has(sessionId)) {
      this.sessionData.set(sessionId, {
        id: sessionId,
        startTime: Date.now(),
        lastActivity: Date.now(),
        currentFile: null,
        fileHistory: [],
        errorLog: [],
        searchHistory: [],
        gitOperations: [],
        suggestionsShown: [],
        wellnessChecks: [],
        contextSnapshots: [],
      });
    }
    return this.sessionData.get(sessionId);
  }

  /**
   * Record activity event
   */
  recordActivity(sessionId, event) {
    const session = this.getSession(sessionId);
    session.lastActivity = Date.now();
    
    switch (event.type) {
      case 'file_open':
      case 'file_edit':
        this.trackFileActivity(session, event);
        break;
      case 'error':
        this.trackError(session, event);
        break;
      case 'search':
        this.trackSearch(session, event);
        break;
      case 'git':
        this.trackGitOperation(session, event);
        break;
      case 'save':
        this.trackSave(session, event);
        break;
    }
    
    return session;
  }

  trackFileActivity(session, event) {
    const { filePath, fileName, language } = event;
    
    // Update current file
    if (session.currentFile && session.currentFile.path !== filePath) {
      // Record time spent on previous file
      const timeSpent = Date.now() - session.currentFile.startTime;
      session.currentFile.duration = timeSpent;
      session.fileHistory.push({ ...session.currentFile });
    }
    
    session.currentFile = {
      path: filePath,
      name: fileName,
      language,
      startTime: Date.now(),
      editCount: 1,
      saveCount: 0,
    };
  }

  trackError(session, event) {
    session.errorLog.push({
      timestamp: Date.now(),
      message: event.message,
      file: event.file,
      line: event.line,
      type: event.errorType || 'unknown',
    });
    
    // Keep only last 50 errors
    if (session.errorLog.length > 50) {
      session.errorLog.shift();
    }
  }

  trackSearch(session, event) {
    session.searchHistory.push({
      timestamp: Date.now(),
      query: event.query,
      source: event.source || 'unknown',
    });
    
    // Keep only last 30 searches
    if (session.searchHistory.length > 30) {
      session.searchHistory.shift();
    }
  }

  trackGitOperation(session, event) {
    session.gitOperations.push({
      timestamp: Date.now(),
      type: event.operation, // commit, push, pull, branch, etc.
      message: event.message,
      files: event.files || [],
    });
    
    // Keep only last 20 operations
    if (session.gitOperations.length > 20) {
      session.gitOperations.shift();
    }
  }

  trackSave(session, event) {
    if (session.currentFile) {
      session.currentFile.saveCount++;
      session.currentFile.lastSave = Date.now();
    }
  }

  // ============================================
  // STUCK STATE DETECTION
  // ============================================

  /**
   * Analyze if the developer appears to be stuck
   */
  async detectStuckState(sessionId = 'default') {
    const session = this.getSession(sessionId);
    const now = Date.now();
    
    const indicators = {
      longTimeOnTask: false,
      errorSpike: false,
      repeatedSearches: false,
      noProgress: false,
    };
    
    const details = {
      timeOnCurrentFile: 0,
      recentErrors: [],
      repeatedQueries: [],
      lastGitOperation: null,
    };

    // Check time on current task
    if (session.currentFile) {
      details.timeOnCurrentFile = now - session.currentFile.startTime;
      indicators.longTimeOnTask = details.timeOnCurrentFile > CONFIG.STUCK_THRESHOLDS.MIN_TIME_ON_TASK;
    }

    // Check for error spike
    const recentErrors = session.errorLog.filter(
      e => now - e.timestamp < CONFIG.STUCK_THRESHOLDS.ERROR_SPIKE_WINDOW
    );
    indicators.errorSpike = recentErrors.length >= CONFIG.STUCK_THRESHOLDS.ERROR_SPIKE_COUNT;
    details.recentErrors = recentErrors.slice(-5);

    // Check for repeated searches (same query multiple times)
    const searchWindow = session.searchHistory.filter(
      s => now - s.timestamp < CONFIG.STUCK_THRESHOLDS.NO_PROGRESS_WINDOW
    );
    const queryCounts = {};
    searchWindow.forEach(s => {
      const normalized = s.query.toLowerCase().trim();
      queryCounts[normalized] = (queryCounts[normalized] || 0) + 1;
      if (queryCounts[normalized] >= CONFIG.STUCK_THRESHOLDS.REPEATED_SEARCH_COUNT) {
        details.repeatedQueries.push(s.query);
      }
    });
    indicators.repeatedSearches = details.repeatedQueries.length > 0;

    // Check for no progress (no git commits, no significant saves)
    const recentGit = session.gitOperations.filter(
      g => g.type === 'commit' && now - g.timestamp < CONFIG.STUCK_THRESHOLDS.NO_PROGRESS_WINDOW
    );
    details.lastGitOperation = recentGit[recentGit.length - 1] || null;
    indicators.noProgress = recentGit.length === 0 && details.timeOnCurrentFile > CONFIG.STUCK_THRESHOLDS.NO_PROGRESS_WINDOW;

    // Calculate stuck score
    const stuckScore = Object.values(indicators).filter(Boolean).length;
    const isStuck = stuckScore >= 2;

    // Determine stuck type
    let stuckType = null;
    if (isStuck) {
      if (indicators.errorSpike && indicators.longTimeOnTask) {
        stuckType = 'debugging_loop';
      } else if (indicators.repeatedSearches) {
        stuckType = 'research_rabbit_hole';
      } else if (indicators.noProgress) {
        stuckType = 'implementation_paralysis';
      } else {
        stuckType = 'general_stuck';
      }
    }

    return {
      isStuck,
      stuckType,
      confidence: Math.min(10, stuckScore * 3 + 2), // 2-10 scale
      indicators,
      details,
      suggestedIntervention: isStuck ? this.getInterventionForStuckType(stuckType, details) : null,
    };
  }

  getInterventionForStuckType(stuckType, details) {
    const interventions = {
      debugging_loop: {
        type: 'offer_help',
        title: 'Stuck on an error?',
        message: `You've been working on ${details.recentErrors[0]?.file || 'this file'} for ${Math.round(details.timeOnCurrentFile / 60000)} minutes with ${details.recentErrors.length} recent errors.`,
        actions: [
          { label: 'Explain this error', type: 'explain_error', payload: details.recentErrors[0]?.message },
          { label: 'Rubber duck debug', type: 'rubber_duck' },
          { label: 'Take a 5-min break', type: 'suggest_break', payload: '5' },
          { label: 'Dismiss', type: 'dismiss' },
        ],
      },
      research_rabbit_hole: {
        type: 'refocus',
        title: 'Research loop detected',
        message: `You've searched for "${details.repeatedQueries[0]}" multiple times. Ready to implement what you found?`,
        actions: [
          { label: 'Show my notes on this', type: 'show_saved_snippets' },
          { label: 'Back to code', type: 'open_last_file' },
          { label: 'Keep researching', type: 'dismiss' },
        ],
      },
      implementation_paralysis: {
        type: 'simplify',
        title: 'Making progress?',
        message: `You've been on this task for ${Math.round(details.timeOnCurrentFile / 60000)} minutes. Want to break it down?`,
        actions: [
          { label: 'Create subtasks', type: 'suggest_breakdown' },
          { label: 'Commit current progress', type: 'suggest_commit' },
          { label: 'I\'m good', type: 'dismiss' },
        ],
      },
      general_stuck: {
        type: 'check_in',
        title: 'How\'s it going?',
        message: 'You\'ve been focused for a while. Need anything?',
        actions: [
          { label: 'Help me debug', type: 'request_help' },
          { label: 'Quick break', type: 'suggest_break', payload: '10' },
          { label: 'All good', type: 'dismiss' },
        ],
      },
    };

    return interventions[stuckType] || interventions.general_stuck;
  }

  // ============================================
  // CONTEXT RECOVERY
  // ============================================

  /**
   * Generate context recovery information when user returns
   */
  async generateContextRecovery(sessionId = 'default', awayDuration = null) {
    const session = this.getSession(sessionId);
    const now = Date.now();
    
    // Calculate away duration if not provided
    const actualAwayDuration = awayDuration || (now - session.lastActivity);
    
    // Only provide recovery for significant away time
    if (actualAwayDuration < CONFIG.CONTEXT_THRESHOLDS.AWAY_TIME_SHORT) {
      return { needsRecovery: false };
    }

    // Get Pieces context
    let piecesContext = null;
    try {
      piecesContext = await piecesCopilotService.getComprehensiveContext();
    } catch (e) {
      console.log('Could not fetch Pieces context for recovery:', e.message);
    }

    // Build recovery context
    const recovery = {
      needsRecovery: true,
      awayDuration: actualAwayDuration,
      awayDurationText: this.formatDuration(actualAwayDuration),
      recoveryPriority: 'continue_work',
      lastKnownState: {
        file: session.currentFile,
        lastEdit: session.fileHistory[session.fileHistory.length - 1] || null,
      },
      contextSummary: '',
      suggestedFirstAction: null,
      todos: [],
      uncommittedChanges: false,
    };

    // Determine recovery priority based on away time
    if (actualAwayDuration > CONFIG.CONTEXT_THRESHOLDS.AWAY_TIME_LONG) {
      recovery.recoveryPriority = 'review_changes';
    }

    // Build context summary
    const summaries = [];
    
    if (session.currentFile) {
      const timeAgo = this.formatDuration(now - session.currentFile.startTime);
      summaries.push(`You were working on ${session.currentFile.name} ${timeAgo} ago`);
    }

    // Check for uncommitted changes
    const lastCommit = session.gitOperations.filter(g => g.type === 'commit').pop();
    if (lastCommit) {
      const timeSinceCommit = now - lastCommit.timestamp;
      if (timeSinceCommit > 30 * 60 * 1000) { // 30 min
        recovery.uncommittedChanges = true;
        summaries.push(`Last commit was ${this.formatDuration(timeSinceCommit)} ago`);
      }
    }

    // Get TODOs from context
    if (piecesContext) {
      recovery.todos = this.extractTODOsFromContext(piecesContext);
      if (recovery.todos.length > 0) {
        summaries.push(`${recovery.todos.length} TODOs in your recent files`);
      }
    }

    recovery.contextSummary = summaries.join('. ') || 'Welcome back!';

    // Suggest first action
    if (recovery.todos.length > 0) {
      recovery.suggestedFirstAction = {
        label: 'Review TODOs',
        type: 'show_todos',
        payload: recovery.todos.slice(0, 3),
      };
    } else if (recovery.uncommittedChanges) {
      recovery.suggestedFirstAction = {
        label: 'Commit changes',
        type: 'suggest_commit',
      };
    } else if (session.currentFile) {
      recovery.suggestedFirstAction = {
        label: `Continue with ${session.currentFile.name}`,
        type: 'open_file',
        payload: session.currentFile.path,
      };
    }

    return recovery;
  }

  extractTODOsFromContext(context) {
    const todos = [];
    
    // Extract from assets
    if (context.assets) {
      context.assets.forEach(asset => {
        if (asset.content) {
          const todoMatches = asset.content.match(/TODO[\s:]*(.+?)(?:\n|$)/gi);
          if (todoMatches) {
            todoMatches.forEach(todo => {
              todos.push({
                text: todo.replace(/TODO[\s:]*/i, '').trim(),
                file: asset.name,
                source: 'asset',
              });
            });
          }
        }
      });
    }

    // Extract from anchors (file locations)
    if (context.anchors) {
      context.anchors.forEach(anchor => {
        if (anchor.description && anchor.description.includes('TODO')) {
          todos.push({
            text: anchor.description,
            file: anchor.fullPath || anchor.name,
            source: 'anchor',
          });
        }
      });
    }

    return todos.slice(0, 10); // Limit to 10
  }

  // ============================================
  // PATTERN RECOGNITION
  // ============================================

  /**
   * Detect repetitive patterns in recent work
   */
  async detectPatterns(sessionId = 'default') {
    const session = this.getSession(sessionId);
    const now = Date.now();
    
    const patterns = [];
    const recentFiles = session.fileHistory.filter(
      f => now - f.startTime < 4 * 60 * 60 * 1000 // 4 hours
    );

    // Pattern 1: Repeated file types
    const fileTypes = {};
    recentFiles.forEach(f => {
      const ext = f.name.split('.').pop();
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    });

    Object.entries(fileTypes).forEach(([ext, count]) => {
      if (count >= 3) {
        patterns.push({
          type: 'repeated_file_type',
          description: `You've worked on ${count} ${ext} files recently`,
          confidence: Math.min(10, count),
          data: { extension: ext, count },
        });
      }
    });

    // Pattern 2: Long session without breaks
    const sessionDuration = now - session.startTime;
    if (sessionDuration > CONFIG.WELLNESS_THRESHOLDS.CONTINUOUS_WORK_LIMIT) {
      patterns.push({
        type: 'long_session',
        description: `You've been coding for ${Math.round(sessionDuration / 3600000)} hours`,
        confidence: 8,
        data: { duration: sessionDuration },
      });
    }

    // Pattern 3: Accumulating TODOs
    const todoPattern = this.analyzeTODOAccumulation(session);
    if (todoPattern.shouldSuggest) {
      patterns.push(todoPattern);
    }

    // Pattern 4: Similar code structures (would need code analysis)
    // This would integrate with a code similarity service

    return patterns;
  }

  analyzeTODOAccumulation(session) {
    // Count TODOs across recent work
    const todoCount = session.fileHistory.reduce((acc, file) => {
      // This is simplified - real implementation would scan file contents
      return acc + (file.todoCount || 0);
    }, 0);

    return {
      type: 'todo_accumulation',
      description: todoCount > 0 ? `You have ${todoCount} TODOs in recent files` : 'No TODO accumulation detected',
      confidence: Math.min(10, todoCount * 2),
      shouldSuggest: todoCount >= 3,
      data: { count: todoCount },
    };
  }

  // ============================================
  // WELLNESS MONITORING
  // ============================================

  /**
   * Check if wellness nudge is needed
   */
  async checkWellness(sessionId = 'default') {
    const session = this.getSession(sessionId);
    const now = Date.now();
    
    const wellness = {
      shouldNudge: false,
      nudgeType: null,
      message: null,
      actions: [],
    };

    const sessionDuration = now - session.startTime;
    const timeSinceLastBreak = this.getTimeSinceLastBreak(session);

    // Check for long continuous work
    if (timeSinceLastBreak > CONFIG.WELLNESS_THRESHOLDS.CONTINUOUS_WORK_LIMIT) {
      wellness.shouldNudge = true;
      wellness.nudgeType = 'break_needed';
      wellness.message = `You've been coding for ${Math.round(timeSinceLastBreak / 3600000)} hours without a break.`;
      wellness.actions = [
        { label: '5-min walk', type: 'suggest_break', payload: '5' },
        { label: 'Stretch break', type: 'suggest_break', payload: '10' },
        { label: 'I\'m fine', type: 'dismiss' },
      ];
      return wellness;
    }

    // Check for frustration spike (high error rate)
    const recentErrors = session.errorLog.filter(
      e => now - e.timestamp < 30 * 60 * 1000
    );
    if (recentErrors.length >= CONFIG.WELLNESS_THRESHOLDS.HIGH_ERROR_RATE) {
      wellness.shouldNudge = true;
      wellness.nudgeType = 'frustration_spike';
      wellness.message = `${recentErrors.length} errors in the last 30 minutes. Frustration detected?`;
      wellness.actions = [
        { label: 'Take a breather', type: 'suggest_break', payload: '5' },
        { label: 'Help me debug', type: 'request_help' },
        { label: 'I\'m good', type: 'dismiss' },
      ];
      return wellness;
    }

    // Regular hourly reminder (only if enabled)
    const timeSinceLastCheck = now - (session.lastWellnessCheck || 0);
    if (timeSinceLastCheck > CONFIG.WELLNESS_THRESHOLDS.BREAK_REMINDER_INTERVAL) {
      session.lastWellnessCheck = now;
      wellness.shouldNudge = true;
      wellness.nudgeType = 'hourly_check';
      wellness.message = `You've been working for an hour. Quick stretch?`;
      wellness.actions = [
        { label: 'Good idea', type: 'suggest_break', payload: '2' },
        { label: 'Remind in 30 min', type: 'snooze', payload: '30' },
        { label: 'Dismiss', type: 'dismiss' },
      ];
    }

    return wellness;
  }

  getTimeSinceLastBreak(session) {
    const breaks = session.wellnessChecks.filter(w => w.tookBreak);
    if (breaks.length === 0) {
      return Date.now() - session.startTime;
    }
    const lastBreak = breaks[breaks.length - 1];
    return Date.now() - lastBreak.timestamp;
  }

  recordBreak(sessionId) {
    const session = this.getSession(sessionId);
    session.wellnessChecks.push({
      timestamp: Date.now(),
      tookBreak: true,
    });
  }

  // ============================================
  // SMART SUGGESTIONS
  // ============================================

  /**
   * Generate prioritized, actionable suggestions
   */
  async generateSmartSuggestions(sessionId = 'default') {
    const session = this.getSession(sessionId);
    const suggestions = [];

    // Priority 1: Stuck state (always show if detected)
    const stuckState = await this.detectStuckState(sessionId);
    if (stuckState.isStuck && stuckState.confidence >= 6) {
      suggestions.push({
        id: `stuck-${Date.now()}`,
        type: 'stuck_help',
        priority: 10,
        title: stuckState.suggestedIntervention.title,
        description: stuckState.suggestedIntervention.message,
        actions: stuckState.suggestedIntervention.actions,
        metadata: {
          stuckType: stuckState.stuckType,
          confidence: stuckState.confidence,
        },
      });
    }

    // Priority 2: Context recovery (if returning after absence)
    const recovery = await this.generateContextRecovery(sessionId);
    if (recovery.needsRecovery && recovery.suggestedFirstAction) {
      suggestions.push({
        id: `recovery-${Date.now()}`,
        type: 'context_recovery',
        priority: 9,
        title: `Welcome back! (${recovery.awayDurationText})`,
        description: recovery.contextSummary,
        actions: [
          recovery.suggestedFirstAction,
          { label: 'Show all TODOs', type: 'show_todos', payload: recovery.todos },
          { label: 'Dismiss', type: 'dismiss' },
        ],
        metadata: {
          awayDuration: recovery.awayDuration,
          todos: recovery.todos.length,
        },
      });
    }

    // Priority 3: Pattern-based suggestions
    const patterns = await this.detectPatterns(sessionId);
    for (const pattern of patterns) {
      if (this.shouldSuggestPattern(pattern, session)) {
        const suggestion = this.patternToSuggestion(pattern);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    // Priority 4: Wellness check (low priority but important)
    const wellness = await this.checkWellness(sessionId);
    if (wellness.shouldNudge && wellness.nudgeType !== 'hourly_check') {
      suggestions.push({
        id: `wellness-${Date.now()}`,
        type: 'wellness',
        priority: wellness.nudgeType === 'frustration_spike' ? 8 : 4,
        title: wellness.nudgeType === 'break_needed' ? 'Time for a break?' : 'How are you doing?',
        description: wellness.message,
        actions: wellness.actions,
        metadata: {
          nudgeType: wellness.nudgeType,
        },
      });
    }

    // Sort by priority and limit
    return this.prioritizeSuggestions(suggestions);
  }

  shouldSuggestPattern(pattern, session) {
    // Check cooldown for this pattern type
    const lastSuggestion = session.suggestionsShown.find(
      s => s.patternType === pattern.type
    );
    
    if (lastSuggestion) {
      const timeSinceLast = Date.now() - lastSuggestion.timestamp;
      if (timeSinceLast < CONFIG.SUGGESTION_COOLDOWN) {
        return false;
      }
    }

    // Check if user dismissed this pattern type recently
    if (this.userPreferences.dismissedSuggestionTypes.has(pattern.type)) {
      return false;
    }

    return pattern.confidence >= 5;
  }

  patternToSuggestion(pattern) {
    const templates = {
      repeated_file_type: {
        title: `Pattern: Multiple ${pattern.data.extension} files`,
        description: pattern.description + '. Are you working on a related feature?',
        actions: [
          { label: 'Show related files', type: 'show_files_by_type', payload: pattern.data.extension },
          { label: 'Dismiss', type: 'dismiss' },
        ],
      },
      long_session: {
        title: 'Long coding session',
        description: pattern.description + '. Consider a break to maintain focus.',
        actions: [
          { label: 'Take a break', type: 'suggest_break', payload: '10' },
          { label: 'Commit progress first', type: 'suggest_commit' },
          { label: 'Dismiss', type: 'dismiss' },
        ],
      },
      todo_accumulation: {
        title: `You have ${pattern.data.count} TODOs building up`,
        description: 'TODOs tend to multiply. Want to tackle one?',
        actions: [
          { label: 'Show TODOs', type: 'show_todos' },
          { label: 'Remind tomorrow', type: 'snooze', payload: '1440' },
          { label: 'Dismiss', type: 'dismiss' },
        ],
      },
    };

    const template = templates[pattern.type];
    if (!template) return null;

    return {
      id: `pattern-${pattern.type}-${Date.now()}`,
      type: pattern.type,
      priority: pattern.confidence,
      title: template.title,
      description: template.description,
      actions: template.actions,
      metadata: {
        patternType: pattern.type,
        confidence: pattern.confidence,
        data: pattern.data,
      },
    };
  }

  prioritizeSuggestions(suggestions) {
    // Sort by priority descending
    const sorted = suggestions.sort((a, b) => b.priority - a.priority);
    
    // Take top N
    const topSuggestions = sorted.slice(0, CONFIG.MAX_SUGGESTIONS);
    
    // Record that these were shown
    topSuggestions.forEach(s => {
      this.suggestionHistory.push({
        id: s.id,
        type: s.type,
        timestamp: Date.now(),
        patternType: s.metadata?.patternType,
      });
    });

    return topSuggestions;
  }

  // ============================================
  // FEEDBACK & LEARNING
  // ============================================

  /**
   * Record feedback on a suggestion
   */
  recordSuggestionFeedback(suggestionId, action, reason = null) {
    const feedback = {
      suggestionId,
      timestamp: Date.now(),
      action, // 'accepted', 'dismissed', 'ignored', 'snoozed'
      reason, // 'not_relevant', 'too_busy', 'already_done', 'bad_timing', 'helpful', 'annoying'
    };

    suggestionFeedback.push(feedback);

    // Learn from feedback
    if (action === 'dismissed' && reason === 'not_relevant') {
      const suggestion = this.suggestionHistory.find(s => s.id === suggestionId);
      if (suggestion) {
        this.userPreferences.dismissedSuggestionTypes.add(suggestion.type);
        
        // Remove from dismissed after 7 days
        setTimeout(() => {
          this.userPreferences.dismissedSuggestionTypes.delete(suggestion.type);
        }, 7 * 24 * 60 * 60 * 1000);
      }
    }

    // Keep only last 100 feedback entries
    if (suggestionFeedback.length > 100) {
      suggestionFeedback.shift();
    }

    return feedback;
  }

  /**
   * Get suggestion effectiveness stats
   */
  getSuggestionStats() {
    const total = suggestionFeedback.length;
    if (total === 0) return { total: 0 };

    const accepted = suggestionFeedback.filter(f => f.action === 'accepted').length;
    const dismissed = suggestionFeedback.filter(f => f.action === 'dismissed').length;
    const snoozed = suggestionFeedback.filter(f => f.action === 'snoozed').length;

    return {
      total,
      accepted,
      dismissed,
      snoozed,
      acceptanceRate: Math.round((accepted / total) * 100),
      byType: this.getStatsByType(),
    };
  }

  getStatsByType() {
    const byType = {};
    
    suggestionFeedback.forEach(f => {
      const suggestion = this.suggestionHistory.find(s => s.id === f.suggestionId);
      if (suggestion) {
        const type = suggestion.type || 'unknown';
        if (!byType[type]) {
          byType[type] = { total: 0, accepted: 0, dismissed: 0 };
        }
        byType[type].total++;
        if (f.action === 'accepted') byType[type].accepted++;
        if (f.action === 'dismissed') byType[type].dismissed++;
      }
    });

    // Calculate rates
    Object.values(byType).forEach(stats => {
      stats.acceptanceRate = Math.round((stats.accepted / stats.total) * 100);
    });

    return byType;
  }

  // ============================================
  // USER PREFERENCES
  // ============================================

  updatePreferences(preferences) {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences,
    };
    return this.userPreferences;
  }

  setQuietHours(start, end) {
    this.userPreferences.quietHours = { start, end };
  }

  setDoNotDisturb(enabled) {
    this.userPreferences.doNotDisturb = enabled;
  }

  /**
   * Check if we should suppress suggestions (quiet hours, DND)
   */
  shouldSuppressSuggestions() {
    if (this.userPreferences.doNotDisturb) {
      return true;
    }

    const now = new Date();
    const hour = now.getHours();
    const { start, end } = this.userPreferences.quietHours;

    if (start < end) {
      // Normal range (e.g., 22:00 - 08:00 doesn't cross midnight)
      return hour >= start && hour < end;
    } else {
      // Crosses midnight (e.g., 22:00 - 08:00)
      return hour >= start || hour < end;
    }
  }

  // ============================================
  // MAIN API
  // ============================================

  /**
   * Main entry point: Get personalized assistance for current context
   */
  async getPersonalizedAssistance(sessionId = 'default') {
    // Check if we should suppress
    if (this.shouldSuppressSuggestions()) {
      return {
        suppressed: true,
        reason: 'quiet_hours_or_dnd',
        suggestions: [],
      };
    }

    const suggestions = await this.generateSmartSuggestions(sessionId);

    return {
      suppressed: false,
      suggestions,
      stats: this.getSuggestionStats(),
      session: {
        duration: this.formatDuration(Date.now() - this.getSession(sessionId).startTime),
        currentFile: this.getSession(sessionId).currentFile?.name || null,
      },
    };
  }

  /**
   * Record user activity (call this whenever user does something)
   */
  async recordUserActivity(sessionId, activity) {
    const session = this.recordActivity(sessionId, activity);
    
    // Check for stuck state after activity
    if (activity.type === 'error' || activity.type === 'save') {
      const stuckCheck = await this.detectStuckState(sessionId);
      
      // If high confidence stuck, maybe trigger immediate help
      if (stuckCheck.isStuck && stuckCheck.confidence >= 8) {
        return {
          ...stuckCheck,
          immediateHelp: stuckCheck.suggestedIntervention,
        };
      }
    }

    return { recorded: true, session };
  }

  /**
   * Handle suggestion action
   */
  async handleSuggestionAction(suggestionId, action, payload = null) {
    const suggestion = this.suggestionHistory.find(s => s.id === suggestionId);
    
    if (!suggestion) {
      return { success: false, error: 'Suggestion not found' };
    }

    // Record feedback
    let reason = null;
    if (action === 'accepted') reason = 'helpful';
    if (action === 'dismissed') reason = payload?.reason || 'not_relevant';
    
    this.recordSuggestionFeedback(suggestionId, action, reason);

    // Handle specific actions
    switch (action) {
      case 'suggest_break':
        this.recordBreak('default');
        return {
          success: true,
          action: 'break_scheduled',
          duration: payload || '10',
          message: `Great! Take a ${payload || '10'}-minute break.`,
        };

      case 'dismiss':
        return {
          success: true,
          action: 'dismissed',
          message: 'Suggestion dismissed.',
        };

      case 'snooze':
        return {
          success: true,
          action: 'snoozed',
          duration: payload || '30',
          message: `Will remind you in ${payload || '30'} minutes.`,
        };

      default:
        return {
          success: true,
          action,
          payload,
          message: 'Action recorded.',
        };
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  /**
   * Get full session report
   */
  getSessionReport(sessionId = 'default') {
    const session = this.getSession(sessionId);
    const now = Date.now();

    return {
      session: {
        id: session.id,
        duration: this.formatDuration(now - session.startTime),
        lastActivity: this.formatDuration(now - session.lastActivity) + ' ago',
      },
      activity: {
        filesWorkedOn: session.fileHistory.length + (session.currentFile ? 1 : 0),
        currentFile: session.currentFile,
        totalErrors: session.errorLog.length,
        totalSearches: session.searchHistory.length,
        gitCommits: session.gitOperations.filter(g => g.type === 'commit').length,
      },
      wellness: {
        timeSinceLastBreak: this.formatDuration(this.getTimeSinceLastBreak(session)),
        wellnessChecks: session.wellnessChecks.length,
      },
      suggestions: {
        shown: session.suggestionsShown.length,
        history: this.suggestionHistory.slice(-10),
        stats: this.getSuggestionStats(),
      },
    };
  }

  /**
   * Reset session
   */
  resetSession(sessionId = 'default') {
    this.sessionData.delete(sessionId);
    return { reset: true };
  }
}

// Export singleton
module.exports = new UserCenteredAIService();
