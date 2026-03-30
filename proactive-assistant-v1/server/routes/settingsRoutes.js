const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

// GET /api/settings - Get current settings (with masked API keys)
router.get('/', async (req, res) => {
  try {
    console.log('📋 GET /settings');
    const settings = await Settings.getSettings();
    res.json(settings.toSafeJSON());
  } catch (error) {
    console.error('✗ Error fetching settings:', error.message);
    res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
  }
});

// GET /api/settings/raw - Get settings with decrypted keys (for internal use)
router.get('/raw', async (req, res) => {
  try {
    console.log('📋 GET /settings/raw');
    const settings = await Settings.getSettings();
    res.json(settings.toObject());
  } catch (error) {
    console.error('✗ Error fetching raw settings:', error.message);
    res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
  }
});

// PUT /api/settings - Update settings
router.put('/', async (req, res) => {
  try {
    console.log('📋 PUT /settings');
    const updates = req.body;
    
    // Validate updates
    const allowedFields = [
      'aiProvider', 'zaiApiKey', 'zaiModel', 'geminiApiKey', 'geminiModel',
      'newsApiKey', 'piecesPort', 'usePiecesSummary', 'briefSchedule',
      'autoGenerate', 'historyDepth', 'maxRecommendations', 'enabledCategories',
      'proactiveInterval', 'proactiveEnabled', 'theme'
    ];
    
    const filteredUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        // Don't update API keys if they're masked (user didn't change them)
        if ((key === 'zaiApiKey' || key === 'geminiApiKey' || key === 'newsApiKey') && 
            value && value.includes('••••')) {
          continue;
        }
        filteredUpdates[key] = value;
      }
    }
    
    const settings = await Settings.updateSettings(filteredUpdates);
    console.log('✓ Settings updated');
    res.json(settings.toSafeJSON());
  } catch (error) {
    console.error('✗ Error updating settings:', error.message);
    res.status(500).json({ error: 'Failed to update settings', details: error.message });
  }
});

// PATCH /api/settings - Partial update settings
router.patch('/', async (req, res) => {
  try {
    console.log('📋 PATCH /settings');
    const updates = req.body;
    
    // Get current settings and merge
    const current = await Settings.getSettings();
    const merged = { ...current.toObject(), ...updates };
    
    // Update
    const settings = await Settings.updateSettings(merged);
    console.log('✓ Settings patched');
    res.json(settings.toSafeJSON());
  } catch (error) {
    console.error('✗ Error patching settings:', error.message);
    res.status(500).json({ error: 'Failed to patch settings', details: error.message });
  }
});

// POST /api/settings/validate-key - Validate an API key
router.post('/validate-key', async (req, res) => {
  try {
    console.log('📋 POST /settings/validate-key');
    const { provider, apiKey } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and apiKey are required' });
    }
    
    let valid = false;
    let message = '';
    
    if (provider === 'zai') {
      // Test z.ai API key
      try {
        const OpenAI = require('openai');
        const zai = new OpenAI({
          apiKey: apiKey,
          baseURL: 'https://api.z.ai/api/coding/paas/v4/'
        });
        
        // Simple test request
        const response = await zai.chat.completions.create({
          model: 'glm-4.7',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        });
        
        valid = !!response.choices;
        message = valid ? 'z.ai API key is valid' : 'Invalid response from z.ai';
      } catch (e) {
        message = e.message || 'Failed to validate z.ai key';
      }
    } else if (provider === 'gemini') {
      // Test Gemini API key
      try {
        const { GoogleGenAI } = require('@google/genai');
        const gemini = new GoogleGenAI({ apiKey: apiKey });
        
        const response = await gemini.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: 'Hi'
        });
        
        valid = !!response.text;
        message = valid ? 'Gemini API key is valid' : 'Invalid response from Gemini';
      } catch (e) {
        message = e.message || 'Failed to validate Gemini key';
      }
    } else if (provider === 'newsapi') {
      // Test News API key
      try {
        const response = await fetch(
          `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${apiKey}`
        );
        const data = await response.json();
        
        valid = data.status === 'ok';
        message = valid ? 'News API key is valid' : data.message || 'Invalid News API key';
      } catch (e) {
        message = e.message || 'Failed to validate News API key';
      }
    } else {
      return res.status(400).json({ error: 'Invalid provider. Use: zai, gemini, or newsapi' });
    }
    
    res.json({ valid, message, provider });
  } catch (error) {
    console.error('✗ Error validating key:', error.message);
    res.status(500).json({ error: 'Failed to validate key', details: error.message });
  }
});

// POST /api/settings/test-pieces - Test Pieces OS connection
router.post('/test-pieces', async (req, res) => {
  try {
    console.log('📋 POST /settings/test-pieces');
    const { port } = req.body;
    const testPort = port || 39300;
    
    try {
      const response = await fetch(`http://localhost:${testPort}/.well-known/health`);
      const health = await response.text();
      
      const connected = health.startsWith('ok');
      res.json({
        connected,
        port: testPort,
        health: health.trim(),
        message: connected ? 'Pieces OS is running' : 'Pieces OS not responding correctly'
      });
    } catch (e) {
      res.json({
        connected: false,
        port: testPort,
        message: `Cannot connect to Pieces OS on port ${testPort}`
      });
    }
  } catch (error) {
    console.error('✗ Error testing Pieces connection:', error.message);
    res.status(500).json({ error: 'Failed to test Pieces connection', details: error.message });
  }
});

// POST /api/settings/reset - Reset settings to defaults
router.post('/reset', async (req, res) => {
  try {
    console.log('📋 POST /settings/reset');
    
    // Delete existing settings
    await Settings.deleteOne({ _id: 'default' });
    
    // Create new default settings
    const settings = await Settings.create({ _id: 'default' });
    
    console.log('✓ Settings reset to defaults');
    res.json(settings.toSafeJSON());
  } catch (error) {
    console.error('✗ Error resetting settings:', error.message);
    res.status(500).json({ error: 'Failed to reset settings', details: error.message });
  }
});

// GET /api/settings/schedule-options - Get available schedule options
router.get('/schedule-options', (req, res) => {
  res.json({
    schedules: [
      { value: '0 6 * * *', label: '6:00 AM Daily' },
      { value: '0 7 * * *', label: '7:00 AM Daily' },
      { value: '0 8 * * *', label: '8:00 AM Daily' },
      { value: '0 9 * * *', label: '9:00 AM Daily' },
      { value: '0 12 * * *', label: '12:00 PM Daily' },
      { value: '0 8 * * 1-5', label: '8:00 AM Weekdays' },
      { value: '0 9 * * 1-5', label: '9:00 AM Weekdays' },
      { value: '0 */4 * * *', label: 'Every 4 hours' },
      { value: '0 */6 * * *', label: 'Every 6 hours' }
    ],
    historyDepths: [
      { value: '1day', label: 'Last 24 hours' },
      { value: '3days', label: 'Last 3 days' },
      { value: '7days', label: 'Last 7 days' },
      { value: '14days', label: 'Last 2 weeks' },
      { value: '30days', label: 'Last 30 days' }
    ],
    providers: [
      { value: 'gemini', label: 'Google Gemini', description: 'Fast and capable' },
      { value: 'zai', label: 'z.ai (GLM-4)', description: 'GLM Coding Plan' },
      { value: 'pieces', label: 'Pieces Copilot', description: 'Local, uses Pieces OS' }
    ],
    themes: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'system', label: 'System Default' }
    ]
  });
});

module.exports = router;
