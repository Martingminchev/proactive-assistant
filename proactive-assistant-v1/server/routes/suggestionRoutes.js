const router = require('express').Router();
const Suggestion = require('../models/Suggestion');
const DismissedSuggestion = require('../models/DismissedSuggestion');
const interruptionManager = require('../services/interruptionManager');

// Get all active suggestions
router.get('/active', async (req, res) => {
  try {
    console.log('📋 GET /suggestions/active');
    
    // Reactivate any snoozed suggestions whose time has passed
    await Suggestion.reactivateSnoozed();
    
    const limit = parseInt(req.query.limit) || 10;
    const suggestions = await Suggestion.getActive(limit);
    
    console.log(`✓ Retrieved ${suggestions.length} active suggestions`);
    res.json({
      suggestions,
      count: suggestions.length
    });
  } catch (error) {
    console.error('✗ Error fetching active suggestions:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch active suggestions',
      details: error.message 
    });
  }
});

// Get suggestion history (all statuses)
router.get('/history', async (req, res) => {
  try {
    console.log('📋 GET /suggestions/history');
    
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    const status = req.query.status; // Optional filter
    
    const query = status ? { status } : {};
    
    const suggestions = await Suggestion.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const count = await Suggestion.countDocuments(query);
    
    console.log(`✓ Retrieved ${suggestions.length} suggestions (total: ${count})`);
    res.json({ 
      suggestions,
      total: count,
      limit,
      skip
    });
  } catch (error) {
    console.error('✗ Error fetching suggestion history:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch suggestion history',
      details: error.message 
    });
  }
});

// Get suggestion stats
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 GET /suggestions/stats');
    
    const stats = await Suggestion.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const categoryStats = await Suggestion.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalSuggestions = await Suggestion.countDocuments();
    const activeSuggestions = await Suggestion.countDocuments({ status: 'active' });
    
    res.json({
      totalSuggestions,
      activeSuggestions,
      byStatus: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byCategory: categoryStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})
    });
  } catch (error) {
    console.error('✗ Error fetching suggestion stats:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch suggestion stats',
      details: error.message 
    });
  }
});

// Get a specific suggestion
router.get('/:id', async (req, res) => {
  try {
    console.log(`📋 GET /suggestions/${req.params.id}`);
    
    const suggestion = await Suggestion.findById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({ 
        error: 'Suggestion not found' 
      });
    }

    console.log(`✓ Retrieved suggestion ${suggestion._id}`);
    res.json(suggestion);
  } catch (error) {
    console.error('✗ Error fetching suggestion:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch suggestion',
      details: error.message 
    });
  }
});

// Dismiss a suggestion
router.post('/:id/dismiss', async (req, res) => {
  try {
    console.log(`🚫 POST /suggestions/${req.params.id}/dismiss`);
    
    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.id,
      { status: 'dismissed' },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({ 
        error: 'Suggestion not found' 
      });
    }

    // Record dismissal for 3-strike rule
    const dismissed = await interruptionManager.recordDismissal(
      suggestion.toObject(),
      'default',
      {
        flowState: suggestion.triggerContext?.flowState,
        interruptionLevel: suggestion.triggerContext?.interruptionLevel
      }
    );

    console.log(`✓ Dismissed suggestion ${suggestion._id} (strike ${dismissed.dismissalCount}/3)`);
    res.json({ 
      message: 'Suggestion dismissed',
      suggestion,
      dismissal: {
        count: dismissed.dismissalCount,
        blacklisted: dismissed.dismissalCount >= 3,
        expiresAt: dismissed.expiresAt
      }
    });
  } catch (error) {
    console.error('✗ Error dismissing suggestion:', error.message);
    res.status(500).json({ 
      error: 'Failed to dismiss suggestion',
      details: error.message 
    });
  }
});

// Snooze a suggestion
router.post('/:id/snooze', async (req, res) => {
  try {
    const minutes = parseInt(req.body.minutes) || 30;
    console.log(`😴 POST /suggestions/${req.params.id}/snooze (${minutes} minutes)`);
    
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
    
    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'snoozed',
        snoozedUntil 
      },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({ 
        error: 'Suggestion not found' 
      });
    }

    console.log(`✓ Snoozed suggestion ${suggestion._id} until ${snoozedUntil.toISOString()}`);
    res.json({ 
      message: `Suggestion snoozed for ${minutes} minutes`,
      suggestion,
      snoozedUntil
    });
  } catch (error) {
    console.error('✗ Error snoozing suggestion:', error.message);
    res.status(500).json({ 
      error: 'Failed to snooze suggestion',
      details: error.message 
    });
  }
});

// Mark suggestion as actioned (user took action)
router.post('/:id/action', async (req, res) => {
  try {
    const actionType = req.body.actionType || 'unknown';
    console.log(`✅ POST /suggestions/${req.params.id}/action (${actionType})`);
    
    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.id,
      { status: 'actioned' },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({ 
        error: 'Suggestion not found' 
      });
    }

    console.log(`✓ Marked suggestion ${suggestion._id} as actioned`);
    res.json({ 
      message: 'Suggestion marked as actioned',
      suggestion 
    });
  } catch (error) {
    console.error('✗ Error marking suggestion as actioned:', error.message);
    res.status(500).json({ 
      error: 'Failed to mark suggestion as actioned',
      details: error.message 
    });
  }
});

// Manually trigger suggestion generation
router.post('/trigger', async (req, res) => {
  try {
    console.log('🚀 POST /suggestions/trigger');
    
    const proactiveAssistantJob = require('../jobs/proactiveAssistantJob');
    
    if (proactiveAssistantJob.isRunning) {
      return res.status(400).json({ 
        message: 'Suggestion generation already in progress',
        status: 'running'
      });
    }

    proactiveAssistantJob.runNow().catch(err => {
      console.error('Error in manual trigger:', err);
    });

    res.json({ 
      message: 'Suggestion generation triggered successfully',
      status: 'started'
    });
  } catch (error) {
    console.error('✗ Error triggering suggestion generation:', error.message);
    res.status(500).json({ 
      error: 'Failed to trigger suggestion generation',
      details: error.message 
    });
  }
});

// Get proactive assistant job status
router.get('/job/status', async (req, res) => {
  try {
    console.log('📊 GET /suggestions/job/status');
    
    const proactiveAssistantJob = require('../jobs/proactiveAssistantJob');
    const status = proactiveAssistantJob.getStatus();
    
    res.json(status);
  } catch (error) {
    console.error('✗ Error fetching job status:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch job status',
      details: error.message 
    });
  }
});

// Get interruption manager status
router.get('/interruption/status', async (req, res) => {
  try {
    console.log('📊 GET /suggestions/interruption/status');
    
    const status = interruptionManager.getStatus();
    const focusMode = await interruptionManager.isFocusModeEnabled();
    const blacklistedHashes = await DismissedSuggestion.getBlacklistedHashes('default');
    
    res.json({
      ...status,
      focusMode,
      blacklistedCount: blacklistedHashes.length,
      blacklistedHashes: req.query.includeHashes ? blacklistedHashes : undefined
    });
  } catch (error) {
    console.error('✗ Error fetching interruption status:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch interruption status',
      details: error.message 
    });
  }
});

// Reset interruption timer (for testing)
router.post('/interruption/reset', async (req, res) => {
  try {
    console.log('🔄 POST /suggestions/interruption/reset');
    
    interruptionManager.resetInterruptionTimer();
    
    res.json({
      message: 'Interruption timer reset',
      nextInterruptionAvailable: 'now'
    });
  } catch (error) {
    console.error('✗ Error resetting interruption timer:', error.message);
    res.status(500).json({ 
      error: 'Failed to reset interruption timer',
      details: error.message 
    });
  }
});

// Toggle focus mode
router.post('/interruption/focus-mode', async (req, res) => {
  try {
    const enabled = req.body.enabled;
    console.log(`🔒 POST /suggestions/interruption/focus-mode (enabled: ${enabled})`);
    
    if (enabled) {
      await interruptionManager.enableFocusMode();
    } else {
      await interruptionManager.disableFocusMode();
    }
    
    res.json({
      message: `Focus mode ${enabled ? 'enabled' : 'disabled'}`,
      focusMode: enabled
    });
  } catch (error) {
    console.error('✗ Error toggling focus mode:', error.message);
    res.status(500).json({ 
      error: 'Failed to toggle focus mode',
      details: error.message 
    });
  }
});

// Check if a suggestion should interrupt (for testing)
router.post('/interruption/check', async (req, res) => {
  try {
    console.log('🔍 POST /suggestions/interruption/check');
    
    const { signals, suggestion } = req.body;
    
    const result = await interruptionManager.shouldInterrupt({
      signals,
      suggestion,
      userId: 'default'
    });
    
    res.json(result);
  } catch (error) {
    console.error('✗ Error checking interruption:', error.message);
    res.status(500).json({ 
      error: 'Failed to check interruption',
      details: error.message 
    });
  }
});

// Get dismissal statistics
router.get('/dismissals/stats', async (req, res) => {
  try {
    console.log('📊 GET /suggestions/dismissals/stats');
    
    const days = parseInt(req.query.days) || 7;
    const stats = await DismissedSuggestion.getStatistics('default', days);
    const blacklistedHashes = await DismissedSuggestion.getBlacklistedHashes('default');
    
    res.json({
      period: `${days} days`,
      totalBlacklisted: blacklistedHashes.length,
      byCategory: stats
    });
  } catch (error) {
    console.error('✗ Error fetching dismissal stats:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch dismissal stats',
      details: error.message 
    });
  }
});

// Clear all dismissals (for testing/reset)
router.delete('/dismissals/clear', async (req, res) => {
  try {
    console.log('🗑 DELETE /suggestions/dismissals/clear');
    
    const result = await DismissedSuggestion.deleteMany({});
    
    console.log(`✓ Deleted ${result.deletedCount} dismissal records`);
    res.json({
      message: 'All dismissal records cleared',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('✗ Error clearing dismissals:', error.message);
    res.status(500).json({ 
      error: 'Failed to clear dismissals',
      details: error.message 
    });
  }
});

// Delete a suggestion
router.delete('/:id', async (req, res) => {
  try {
    console.log(`🗑 DELETE /suggestions/${req.params.id}`);
    
    const suggestion = await Suggestion.findByIdAndDelete(req.params.id);

    if (!suggestion) {
      return res.status(404).json({ 
        error: 'Suggestion not found' 
      });
    }

    console.log(`✓ Deleted suggestion ${suggestion._id}`);
    res.json({ message: 'Suggestion deleted successfully' });
  } catch (error) {
    console.error('✗ Error deleting suggestion:', error.message);
    res.status(500).json({ 
      error: 'Failed to delete suggestion',
      details: error.message 
    });
  }
});

// Clear all suggestions (for testing/reset)
router.delete('/clear/all', async (req, res) => {
  try {
    console.log('🗑 DELETE /suggestions/clear/all');
    
    const result = await Suggestion.deleteMany({});
    
    console.log(`✓ Deleted ${result.deletedCount} suggestions`);
    res.json({ 
      message: 'All suggestions cleared',
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('✗ Error clearing suggestions:', error.message);
    res.status(500).json({ 
      error: 'Failed to clear suggestions',
      details: error.message 
    });
  }
});

module.exports = router;
