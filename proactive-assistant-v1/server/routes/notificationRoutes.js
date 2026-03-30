/**
 * Notification Routes
 * API endpoints for sending and managing notifications
 */

const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');

/**
 * @route   POST /api/notifications/send
 * @desc    Send a custom notification
 * @access  Public
 */
router.post('/send', async (req, res) => {
  try {
    const { type, title, body, priority, actions, data, sound, timeout } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const notification = {
      type: type || 'custom',
      title,
      body,
      priority: priority || 'normal',
      actions,
      data,
      sound,
      timeout
    };

    const result = await notificationService.send(notification);
    
    res.json({
      success: result.sent,
      notificationId: result.id,
      ...result
    });
  } catch (error) {
    console.error('Error sending notification:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/notifications/stuck
 * @desc    Send "stuck detection" notification
 * @access  Public
 */
router.post('/stuck', async (req, res) => {
  try {
    const { topic, duration, error, file } = req.body;
    
    const result = await notificationService.sendStuckNotification({
      topic,
      duration,
      error,
      file
    });
    
    res.json({
      success: result.sent,
      notificationId: result.id,
      ...result
    });
  } catch (error) {
    console.error('Error sending stuck notification:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/notifications/context-recovery
 * @desc    Send context recovery notification
 * @access  Public
 */
router.post('/context-recovery', async (req, res) => {
  try {
    const { file, todos } = req.body;
    
    const result = await notificationService.sendContextRecovery({
      file,
      todos
    });
    
    res.json({
      success: result.sent,
      notificationId: result.id,
      ...result
    });
  } catch (error) {
    console.error('Error sending context recovery notification:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/notifications/wellness
 * @desc    Send wellness notification
 * @access  Public
 */
router.post('/wellness', async (req, res) => {
  try {
    const { type, duration } = req.body;
    
    const result = await notificationService.sendWellnessNotification(type, {
      duration
    });
    
    res.json({
      success: result.sent,
      notificationId: result.id,
      ...result
    });
  } catch (error) {
    console.error('Error sending wellness notification:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/notifications/celebration
 * @desc    Send celebration notification
 * @access  Public
 */
router.post('/celebration', async (req, res) => {
  try {
    const { text, achievement } = req.body;
    
    const result = await notificationService.sendCelebration({
      text: text || achievement
    });
    
    res.json({
      success: result.sent,
      notificationId: result.id,
      ...result
    });
  } catch (error) {
    console.error('Error sending celebration notification:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/notifications/suggestion
 * @desc    Send suggestion notification
 * @access  Public
 */
router.post('/suggestion', async (req, res) => {
  try {
    const { id, title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await notificationService.sendSuggestionNotification({
      id,
      title,
      description
    });
    
    res.json({
      success: result.sent,
      notificationId: result.id,
      ...result
    });
  } catch (error) {
    console.error('Error sending suggestion notification:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/notifications/focus-complete
 * @desc    Send focus session complete notification
 * @access  Public
 */
router.post('/focus-complete', async (req, res) => {
  try {
    const { duration } = req.body;
    
    const result = await notificationService.sendFocusComplete(duration);
    
    res.json({
      success: result.sent,
      notificationId: result.id,
      ...result
    });
  } catch (error) {
    console.error('Error sending focus complete notification:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/notifications/:id/action
 * @desc    Handle notification action
 * @access  Public
 */
router.post('/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { actionId } = req.body;
    
    if (!actionId) {
      return res.status(400).json({ error: 'actionId is required' });
    }

    const result = await notificationService.handleAction(id, actionId);
    
    // Broadcast to WebSocket clients
    notificationService.broadcastAction(id, actionId, result);
    
    res.json(result);
  } catch (error) {
    console.error('Error handling notification action:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/notifications/history
 * @desc    Get notification history
 * @access  Public
 */
router.get('/history', (req, res) => {
  try {
    const { type, limit } = req.query;
    
    const history = notificationService.getHistory({
      type,
      limit: limit ? parseInt(limit) : undefined
    });
    
    res.json({ history });
  } catch (error) {
    console.error('Error getting notification history:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Public
 */
router.get('/stats', (req, res) => {
  try {
    const stats = notificationService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting notification stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/notifications/settings
 * @desc    Get notification settings
 * @access  Public
 */
router.get('/settings', (req, res) => {
  try {
    const settings = notificationService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error getting notification settings:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   PUT /api/notifications/settings
 * @desc    Update notification settings
 * @access  Public
 */
router.put('/settings', (req, res) => {
  try {
    const newSettings = req.body;
    const settings = notificationService.updateSettings(newSettings);
    res.json(settings);
  } catch (error) {
    console.error('Error updating notification settings:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   DELETE /api/notifications/history
 * @desc    Clear notification history
 * @access  Public
 */
router.delete('/history', (req, res) => {
  try {
    notificationService.clearHistory();
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    console.error('Error clearing notification history:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/notifications/dnd-status
 * @desc    Check Do Not Disturb status
 * @access  Public
 */
router.get('/dnd-status', async (req, res) => {
  try {
    const isDnd = await notificationService.checkDoNotDisturb();
    res.json({ doNotDisturb: isDnd });
  } catch (error) {
    console.error('Error checking DND status:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/notifications/templates
 * @desc    Get available notification templates
 * @access  Public
 */
router.get('/templates', (req, res) => {
  try {
    const templates = {
      stuck: {
        description: 'Sent when user appears stuck on an error',
        parameters: ['topic', 'duration', 'error', 'file']
      },
      contextRecovery: {
        description: 'Sent to help user recover context after absence',
        parameters: ['file', 'todos']
      },
      wellness: {
        description: 'Wellness reminders (breaks, eye strain, etc.)',
        parameters: ['type', 'duration'],
        types: ['break', 'eyeStrain', 'posture', 'hydration']
      },
      celebration: {
        description: 'Celebrate achievements and milestones',
        parameters: ['text', 'achievement']
      },
      suggestion: {
        description: 'Actionable suggestion with apply button',
        parameters: ['id', 'title', 'description']
      },
      focus: {
        description: 'Focus session complete',
        parameters: ['duration']
      }
    };
    
    res.json({ templates });
  } catch (error) {
    console.error('Error getting templates:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
