/**
 * User-Centered AI Routes
 * 
 * API endpoints for the user-centered AI assistant system.
 * Focuses on contextual, actionable assistance rather than generic suggestions.
 */

const express = require('express');
const router = express.Router();
const userCenteredAIService = require('../services/userCenteredAIService');

/**
 * GET /api/assistant/assistance
 * 
 * Get personalized assistance for current context.
 * Returns prioritized suggestions based on stuck detection,
 * context recovery, patterns, and wellness checks.
 */
router.get('/assistance', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || 'default';
    const result = await userCenteredAIService.getPersonalizedAssistance(sessionId);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Error getting personalized assistance:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/assistant/activity
 * 
 * Record user activity for tracking and analysis.
 * Activity types: file_open, file_edit, error, search, git, save
 * 
 * Body: {
 *   sessionId?: string,
 *   type: string,
 *   ...activity-specific fields
 * }
 */
router.post('/activity', async (req, res) => {
  try {
    const { sessionId = 'default', type, ...data } = req.body;
    
    const activity = {
      type,
      ...data,
      timestamp: Date.now(),
    };
    
    const result = await userCenteredAIService.recordUserActivity(sessionId, activity);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Error recording activity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/assistant/suggestions/:suggestionId/action
 * 
 * Handle user action on a suggestion.
 * Actions: accepted, dismissed, snoozed
 * 
 * Body: {
 *   action: string,
 *   payload?: any,
 *   reason?: string  // for dismissals
 * }
 */
router.post('/suggestions/:suggestionId/action', async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { action, payload, reason } = req.body;
    
    const result = await userCenteredAIService.handleSuggestionAction(
      suggestionId,
      action,
      payload || reason
    );
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Error handling suggestion action:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/assistant/context-recovery
 * 
 * Get context recovery information when returning after absence.
 * Returns summary of what user was working on and suggested first action.
 */
router.get('/context-recovery', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || 'default';
    const awayDuration = req.query.awayDuration 
      ? parseInt(req.query.awayDuration) 
      : null;
    
    const recovery = await userCenteredAIService.generateContextRecovery(
      sessionId,
      awayDuration
    );
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...recovery,
    });
  } catch (error) {
    console.error('Error generating context recovery:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/assistant/stuck-check
 * 
 * Check if user appears to be stuck and needs help.
 * Returns stuck state analysis with intervention suggestions.
 */
router.get('/stuck-check', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || 'default';
    const stuckState = await userCenteredAIService.detectStuckState(sessionId);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...stuckState,
    });
  } catch (error) {
    console.error('Error checking stuck state:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/assistant/patterns
 * 
 * Detect patterns in recent work.
 * Returns detected patterns like repeated file types, long sessions, TODO accumulation.
 */
router.get('/patterns', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || 'default';
    const patterns = await userCenteredAIService.detectPatterns(sessionId);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      patterns,
    });
  } catch (error) {
    console.error('Error detecting patterns:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/assistant/wellness
 * 
 * Check wellness status and get nudge if needed.
 */
router.get('/wellness', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || 'default';
    const wellness = await userCenteredAIService.checkWellness(sessionId);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...wellness,
    });
  } catch (error) {
    console.error('Error checking wellness:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/assistant/session-report
 * 
 * Get full session report with activity summary.
 */
router.get('/session-report', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || 'default';
    const report = userCenteredAIService.getSessionReport(sessionId);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...report,
    });
  } catch (error) {
    console.error('Error getting session report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/assistant/stats
 * 
 * Get suggestion effectiveness statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = userCenteredAIService.getSuggestionStats();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/assistant/preferences
 * 
 * Update user preferences.
 * 
 * Body: {
 *   quietHours?: { start: number, end: number },  // 24-hour format
 *   doNotDisturb?: boolean,
 *   suggestionFrequency?: 'low' | 'normal' | 'high'
 * }
 */
router.post('/preferences', async (req, res) => {
  try {
    const preferences = userCenteredAIService.updatePreferences(req.body);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      preferences,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/assistant/quiet-hours
 * 
 * Set quiet hours when suggestions should be suppressed.
 * 
 * Body: {
 *   start: number,  // 0-23 (e.g., 22 for 10 PM)
 *   end: number     // 0-23 (e.g., 8 for 8 AM)
 * }
 */
router.post('/quiet-hours', async (req, res) => {
  try {
    const { start, end } = req.body;
    
    if (typeof start !== 'number' || typeof end !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'start and end must be numbers (0-23)',
      });
    }
    
    userCenteredAIService.setQuietHours(start, end);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      quietHours: { start, end },
    });
  } catch (error) {
    console.error('Error setting quiet hours:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/assistant/do-not-disturb
 * 
 * Enable/disable do not disturb mode.
 * 
 * Body: {
 *   enabled: boolean
 * }
 */
router.post('/do-not-disturb', async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean',
      });
    }
    
    userCenteredAIService.setDoNotDisturb(enabled);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      doNotDisturb: enabled,
    });
  } catch (error) {
    console.error('Error setting DND:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/assistant/reset-session
 * 
 * Reset session data (useful for starting fresh).
 */
router.post('/reset-session', async (req, res) => {
  try {
    const sessionId = req.body.sessionId || 'default';
    const result = userCenteredAIService.resetSession(sessionId);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('Error resetting session:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
