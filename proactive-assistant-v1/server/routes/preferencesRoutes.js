const express = require('express');
const router = express.Router();
const UserPreference = require('../models/UserPreference');

// GET /api/preferences - Get user preferences
router.get('/', async (req, res) => {
  try {
    console.log('📋 GET /preferences');
    const prefs = await UserPreference.getPreferences();
    res.json(prefs);
  } catch (error) {
    console.error('✗ Error fetching preferences:', error.message);
    res.status(500).json({ error: 'Failed to fetch preferences', details: error.message });
  }
});

// GET /api/preferences/summary - Get preference summary for AI context
router.get('/summary', async (req, res) => {
  try {
    console.log('📋 GET /preferences/summary');
    const prefs = await UserPreference.getPreferences();
    const summary = prefs.getPreferenceSummary();
    res.json(summary);
  } catch (error) {
    console.error('✗ Error fetching preference summary:', error.message);
    res.status(500).json({ error: 'Failed to fetch summary', details: error.message });
  }
});

// ============================================
// FEEDBACK ENDPOINTS
// ============================================

// POST /api/preferences/feedback - Submit feedback (like/dislike)
router.post('/feedback', async (req, res) => {
  try {
    console.log('📋 POST /preferences/feedback');
    const { itemId, itemTitle, category, format, liked } = req.body;
    
    if (!itemId || !itemTitle || typeof liked !== 'boolean') {
      return res.status(400).json({ 
        error: 'itemId, itemTitle, and liked (boolean) are required' 
      });
    }
    
    const prefs = await UserPreference.getPreferences();
    await prefs.addFeedback({
      itemId,
      itemTitle,
      category,
      format,
      liked,
      timestamp: new Date()
    });
    
    console.log(`✓ Feedback recorded: ${liked ? 'liked' : 'disliked'} "${itemTitle}"`);
    res.json({ 
      success: true, 
      message: `Feedback recorded`,
      preferredCategories: prefs.preferredCategories,
      dislikedCategories: prefs.dislikedCategories
    });
  } catch (error) {
    console.error('✗ Error recording feedback:', error.message);
    res.status(500).json({ error: 'Failed to record feedback', details: error.message });
  }
});

// GET /api/preferences/feedback - Get feedback history
router.get('/feedback', async (req, res) => {
  try {
    console.log('📋 GET /preferences/feedback');
    const limit = parseInt(req.query.limit) || 50;
    
    const prefs = await UserPreference.getPreferences();
    const feedback = prefs.feedback.slice(-limit);
    
    res.json({
      feedback,
      total: prefs.feedback.length,
      preferredCategories: prefs.preferredCategories,
      dislikedCategories: prefs.dislikedCategories
    });
  } catch (error) {
    console.error('✗ Error fetching feedback:', error.message);
    res.status(500).json({ error: 'Failed to fetch feedback', details: error.message });
  }
});

// DELETE /api/preferences/feedback/:id - Remove specific feedback
router.delete('/feedback/:id', async (req, res) => {
  try {
    console.log('📋 DELETE /preferences/feedback/:id');
    const { id } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    const feedback = prefs.feedback.id(id);
    
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    feedback.deleteOne();
    await prefs.save();
    
    res.json({ success: true, message: 'Feedback removed' });
  } catch (error) {
    console.error('✗ Error removing feedback:', error.message);
    res.status(500).json({ error: 'Failed to remove feedback', details: error.message });
  }
});

// ============================================
// GOALS ENDPOINTS
// ============================================

// GET /api/preferences/goals - Get all goals
router.get('/goals', async (req, res) => {
  try {
    console.log('📋 GET /preferences/goals');
    const activeOnly = req.query.active === 'true';
    
    const prefs = await UserPreference.getPreferences();
    const goals = activeOnly ? prefs.getActiveGoals() : prefs.goals;
    
    res.json({
      goals,
      activeCount: prefs.getActiveGoals().length,
      totalCount: prefs.goals.length
    });
  } catch (error) {
    console.error('✗ Error fetching goals:', error.message);
    res.status(500).json({ error: 'Failed to fetch goals', details: error.message });
  }
});

// POST /api/preferences/goals - Add a new goal
router.post('/goals', async (req, res) => {
  try {
    console.log('📋 POST /preferences/goals');
    const { title, description, priority } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const prefs = await UserPreference.getPreferences();
    const goal = await prefs.addGoal({
      title,
      description: description || '',
      priority: priority || 1,
      active: true,
      createdAt: new Date()
    });
    
    console.log(`✓ Goal added: "${title}"`);
    res.json({ success: true, goal });
  } catch (error) {
    console.error('✗ Error adding goal:', error.message);
    res.status(500).json({ error: 'Failed to add goal', details: error.message });
  }
});

// PUT /api/preferences/goals/:id - Update a goal
router.put('/goals/:id', async (req, res) => {
  try {
    console.log('📋 PUT /preferences/goals/:id');
    const { id } = req.params;
    const updates = req.body;
    
    const prefs = await UserPreference.getPreferences();
    const goal = await prefs.updateGoal(id, updates);
    
    console.log(`✓ Goal updated: ${goal.title}`);
    res.json({ success: true, goal });
  } catch (error) {
    console.error('✗ Error updating goal:', error.message);
    res.status(500).json({ error: 'Failed to update goal', details: error.message });
  }
});

// DELETE /api/preferences/goals/:id - Remove a goal
router.delete('/goals/:id', async (req, res) => {
  try {
    console.log('📋 DELETE /preferences/goals/:id');
    const { id } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    await prefs.removeGoal(id);
    
    console.log('✓ Goal removed');
    res.json({ success: true, message: 'Goal removed' });
  } catch (error) {
    console.error('✗ Error removing goal:', error.message);
    res.status(500).json({ error: 'Failed to remove goal', details: error.message });
  }
});

// POST /api/preferences/goals/:id/complete - Mark goal as completed
router.post('/goals/:id/complete', async (req, res) => {
  try {
    console.log('📋 POST /preferences/goals/:id/complete');
    const { id } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    const goal = await prefs.updateGoal(id, {
      active: false,
      completedAt: new Date()
    });
    
    console.log(`✓ Goal completed: ${goal.title}`);
    res.json({ success: true, goal });
  } catch (error) {
    console.error('✗ Error completing goal:', error.message);
    res.status(500).json({ error: 'Failed to complete goal', details: error.message });
  }
});

// POST /api/preferences/goals/:id/reactivate - Reactivate a completed goal
router.post('/goals/:id/reactivate', async (req, res) => {
  try {
    console.log('📋 POST /preferences/goals/:id/reactivate');
    const { id } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    const goal = await prefs.updateGoal(id, {
      active: true,
      completedAt: null
    });
    
    console.log(`✓ Goal reactivated: ${goal.title}`);
    res.json({ success: true, goal });
  } catch (error) {
    console.error('✗ Error reactivating goal:', error.message);
    res.status(500).json({ error: 'Failed to reactivate goal', details: error.message });
  }
});

// ============================================
// CONVERSATION ENDPOINTS
// ============================================

// GET /api/preferences/conversations - Get all conversations
router.get('/conversations', async (req, res) => {
  try {
    console.log('📋 GET /preferences/conversations');
    const limit = parseInt(req.query.limit) || 20;
    
    const prefs = await UserPreference.getPreferences();
    const conversations = prefs.getRecentConversations(limit);
    
    res.json({
      conversations,
      total: prefs.conversations.length
    });
  } catch (error) {
    console.error('✗ Error fetching conversations:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
  }
});

// GET /api/preferences/conversations/:id - Get a specific conversation
router.get('/conversations/:id', async (req, res) => {
  try {
    console.log('📋 GET /preferences/conversations/:id');
    const { id } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    const conversation = prefs.conversations.id(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('✗ Error fetching conversation:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation', details: error.message });
  }
});

// GET /api/preferences/conversations/item/:itemId - Get conversation by item ID
router.get('/conversations/item/:itemId', async (req, res) => {
  try {
    console.log('📋 GET /preferences/conversations/item/:itemId');
    const { itemId } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    const conversation = prefs.getConversationByItemId(itemId);
    
    res.json({ conversation: conversation || null });
  } catch (error) {
    console.error('✗ Error fetching conversation:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation', details: error.message });
  }
});

// DELETE /api/preferences/conversations/:id - Delete a conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    console.log('📋 DELETE /preferences/conversations/:id');
    const { id } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    const conversation = prefs.conversations.id(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    conversation.deleteOne();
    await prefs.save();
    
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('✗ Error deleting conversation:', error.message);
    res.status(500).json({ error: 'Failed to delete conversation', details: error.message });
  }
});

// POST /api/preferences/conversations/:id/pin - Toggle pin status
router.post('/conversations/:id/pin', async (req, res) => {
  try {
    console.log('📋 POST /preferences/conversations/:id/pin');
    const { id } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    const conversation = prefs.conversations.id(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    conversation.pinned = !conversation.pinned;
    await prefs.save();
    
    res.json({ success: true, pinned: conversation.pinned });
  } catch (error) {
    console.error('✗ Error toggling pin:', error.message);
    res.status(500).json({ error: 'Failed to toggle pin', details: error.message });
  }
});

module.exports = router;
