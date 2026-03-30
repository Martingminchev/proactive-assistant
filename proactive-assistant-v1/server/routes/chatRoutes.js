const express = require('express');
const router = express.Router();
const UserPreference = require('../models/UserPreference');
const piecesCopilotService = require('../services/piecesCopilotService');
const aiService = require('../services/aiService');
const Settings = require('../models/Settings');

// POST /api/chat - General chat (via Pieces agent)
router.post('/', async (req, res) => {
  try {
    console.log('💬 POST /chat');
    const { message, conversationId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get or create conversation
    const prefs = await UserPreference.getPreferences();
    let conversation;
    
    if (conversationId) {
      conversation = prefs.conversations.id(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = await prefs.getOrCreateConversation(null, null, null);
    }
    
    // Add user message
    await prefs.addMessage(conversation._id, 'user', message);
    
    // Connect to Pieces and get response
    try {
      await piecesCopilotService.connect();
      
      // Build context from recent conversation messages
      const recentMessages = conversation.messages.slice(-10).map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n');
      
      const contextQuery = recentMessages.length > 0 
        ? `Previous conversation:\n${recentMessages}\n\nUser's new message: ${message}`
        : message;
      
      const result = await piecesCopilotService.askCopilot(contextQuery, { iterable: [] });
      
      let responseText;
      if (result && typeof result === 'object') {
        responseText = result.text || result.response || JSON.stringify(result);
      } else if (typeof result === 'string') {
        responseText = result;
      } else {
        responseText = 'I received your message but couldn\'t generate a proper response.';
      }
      
      // Add assistant response
      await prefs.addMessage(conversation._id, 'assistant', responseText);
      
      // Get updated conversation
      const updatedPrefs = await UserPreference.getPreferences();
      const updatedConvo = updatedPrefs.conversations.id(conversation._id);
      
      res.json({
        success: true,
        conversationId: conversation._id,
        response: responseText,
        messages: updatedConvo.messages.slice(-20)
      });
    } catch (piecesError) {
      console.error('Pieces error:', piecesError.message);
      
      // Fallback response
      const fallbackResponse = 'I apologize, but I couldn\'t connect to the AI service. Please try again later.';
      await prefs.addMessage(conversation._id, 'assistant', fallbackResponse);
      
      res.json({
        success: false,
        conversationId: conversation._id,
        response: fallbackResponse,
        error: piecesError.message
      });
    }
  } catch (error) {
    console.error('✗ Error in chat:', error.message);
    res.status(500).json({ error: 'Failed to process chat', details: error.message });
  }
});

// POST /api/chat/contextual - Chat with specific item context
router.post('/contextual', async (req, res) => {
  try {
    console.log('💬 POST /chat/contextual');
    const { message, itemId, itemTitle, itemCategory, itemDescription } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!itemId || !itemTitle) {
      return res.status(400).json({ error: 'itemId and itemTitle are required for contextual chat' });
    }
    
    // Get or create conversation for this item
    const prefs = await UserPreference.getPreferences();
    const conversation = await prefs.getOrCreateConversation(itemId, itemTitle, itemCategory);
    
    // Add user message
    await prefs.addMessage(conversation._id, 'user', message);
    
    // Build contextual prompt
    const contextPrompt = `
The user is asking a follow-up question about a recommendation they received.

**Original Recommendation:**
- Title: ${itemTitle}
- Category: ${itemCategory || 'General'}
${itemDescription ? `- Description: ${itemDescription}` : ''}

**Previous messages in this conversation:**
${conversation.messages.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

**User's question:** ${message}

Please provide a helpful, specific response about this recommendation. Be conversational and helpful.
    `.trim();
    
    try {
      await piecesCopilotService.connect();
      
      const result = await piecesCopilotService.askCopilot(contextPrompt, { iterable: [] });
      
      let responseText;
      if (result && typeof result === 'object') {
        responseText = result.text || result.response || 
          (result.improvements && result.improvements[0]?.description) ||
          JSON.stringify(result);
      } else if (typeof result === 'string') {
        responseText = result;
      } else {
        responseText = 'I can help you learn more about this. What specific aspect would you like to explore?';
      }
      
      // Add assistant response
      await prefs.addMessage(conversation._id, 'assistant', responseText);
      
      // Get updated conversation
      const updatedPrefs = await UserPreference.getPreferences();
      const updatedConvo = updatedPrefs.conversations.id(conversation._id);
      
      res.json({
        success: true,
        conversationId: conversation._id,
        itemId,
        response: responseText,
        messages: updatedConvo.messages
      });
    } catch (piecesError) {
      console.error('Pieces error:', piecesError.message);
      
      // Try using configured AI provider as fallback
      const settings = await Settings.getSettings();
      let responseText = 'I apologize, but I couldn\'t process your request. Please try again.';
      
      try {
        if (settings.aiProvider === 'gemini' && settings.geminiApiKey) {
          const { GoogleGenAI } = require('@google/genai');
          const gemini = new GoogleGenAI({ apiKey: settings.geminiApiKey });
          
          const response = await gemini.models.generateContent({
            model: settings.geminiModel || 'gemini-2.0-flash',
            contents: contextPrompt
          });
          
          responseText = response.text || responseText;
        }
      } catch (aiError) {
        console.error('AI fallback error:', aiError.message);
      }
      
      await prefs.addMessage(conversation._id, 'assistant', responseText);
      
      res.json({
        success: false,
        conversationId: conversation._id,
        itemId,
        response: responseText,
        error: piecesError.message
      });
    }
  } catch (error) {
    console.error('✗ Error in contextual chat:', error.message);
    res.status(500).json({ error: 'Failed to process contextual chat', details: error.message });
  }
});

// GET /api/chat/conversations - Get all conversations
router.get('/conversations', async (req, res) => {
  try {
    console.log('💬 GET /chat/conversations');
    const limit = parseInt(req.query.limit) || 20;
    
    const prefs = await UserPreference.getPreferences();
    const conversations = prefs.getRecentConversations(limit);
    
    // Add summary info to each conversation
    const summaries = conversations.map(c => ({
      _id: c._id,
      title: c.title,
      itemId: c.itemId,
      itemTitle: c.itemTitle,
      itemCategory: c.itemCategory,
      messageCount: c.messages.length,
      lastMessage: c.messages.length > 0 ? c.messages[c.messages.length - 1] : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      pinned: c.pinned
    }));
    
    res.json({
      conversations: summaries,
      total: prefs.conversations.length
    });
  } catch (error) {
    console.error('✗ Error fetching conversations:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
  }
});

// GET /api/chat/conversations/:id - Get full conversation
router.get('/conversations/:id', async (req, res) => {
  try {
    console.log('💬 GET /chat/conversations/:id');
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

// GET /api/chat/item/:itemId - Get conversation for specific item
router.get('/item/:itemId', async (req, res) => {
  try {
    console.log('💬 GET /chat/item/:itemId');
    const { itemId } = req.params;
    
    const prefs = await UserPreference.getPreferences();
    const conversation = prefs.getConversationByItemId(itemId);
    
    res.json({
      exists: !!conversation,
      conversation: conversation || null
    });
  } catch (error) {
    console.error('✗ Error fetching item conversation:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation', details: error.message });
  }
});

// DELETE /api/chat/conversations/:id - Delete conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    console.log('💬 DELETE /chat/conversations/:id');
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

// POST /api/chat/quick - Quick question without saving to conversation
router.post('/quick', async (req, res) => {
  try {
    console.log('💬 POST /chat/quick');
    const { question, context } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    try {
      await piecesCopilotService.connect();
      
      const prompt = context 
        ? `Context: ${context}\n\nQuestion: ${question}`
        : question;
      
      const result = await piecesCopilotService.askCopilot(prompt, { iterable: [] });
      
      let responseText;
      if (result && typeof result === 'object') {
        responseText = result.text || result.response || JSON.stringify(result);
      } else {
        responseText = result || 'No response generated';
      }
      
      res.json({
        success: true,
        response: responseText
      });
    } catch (error) {
      res.json({
        success: false,
        response: 'Unable to process question at this time.',
        error: error.message
      });
    }
  } catch (error) {
    console.error('✗ Error in quick chat:', error.message);
    res.status(500).json({ error: 'Failed to process question', details: error.message });
  }
});

module.exports = router;
